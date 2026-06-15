import type {
  RagProgressDataPartLike,
  RagNodeLike,
  RagNodeRow,
  RagProgressStatus,
  RagSourceDataPartLike,
  RagSourceLike,
  SourcePartLike,
  ThreadMessageLike,
} from "./thread.types";

const isRagSourceLike = (value: unknown): value is RagSourceLike => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RagSourceLike>;
  return (
    (typeof candidate.chunkId === "string" ||
      typeof candidate.chunkId === "number") &&
    typeof candidate.documentName === "string" &&
    typeof candidate.score === "number" &&
    typeof candidate.content === "string"
  );
};

const toRagSourceLike = (value: unknown): RagSourceLike | null => {
  if (isRagSourceLike(value)) {
    return value;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    chunkId?: string | number;
    documentId?: string;
    documentName?: string;
    score?: number;
    content?: string;
    matchType?: string;
    hitModes?: string[];
  };

  if (
    (typeof candidate.chunkId !== "string" &&
      typeof candidate.chunkId !== "number") ||
    typeof candidate.documentName !== "string"
  ) {
    return null;
  }

  return {
    chunkId: candidate.chunkId,
    documentId: candidate.documentId,
    documentName: candidate.documentName,
    score: typeof candidate.score === "number" ? candidate.score : 0,
    content: typeof candidate.content === "string" ? candidate.content : "",
    matchType:
      typeof candidate.matchType === "string" ? candidate.matchType : undefined,
    hitModes: Array.isArray(candidate.hitModes)
      ? candidate.hitModes.filter((item): item is string => typeof item === "string")
      : undefined,
  };
};

const isRagNodeLike = (value: unknown): value is RagNodeLike => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RagNodeLike>;
  return (
    typeof candidate.nodeId === "string" &&
    typeof candidate.nodeType === "string" &&
    typeof candidate.phase === "string" &&
    typeof candidate.label === "string"
  );
};

const toRagNodeLike = (value: unknown): RagNodeLike | null => {
  if (!isRagNodeLike(value)) {
    return null;
  }

  const candidate = value as Partial<RagNodeLike>;
  if (
    !["start", "done", "error"].includes(candidate.phase as RagProgressStatus)
  ) {
    return null;
  }

  return {
    nodeId: candidate.nodeId ?? "",
    nodeType: candidate.nodeType ?? "unknown",
    phase: candidate.phase as RagProgressStatus,
    label: candidate.label ?? "未命名节点",
    summary:
      typeof candidate.summary === "string" ? candidate.summary : undefined,
    details:
      candidate.details && typeof candidate.details === "object"
        ? (candidate.details as Record<string, unknown>)
        : undefined,
    environment:
      candidate.environment && typeof candidate.environment === "object"
        ? (candidate.environment as RagNodeLike["environment"])
        : undefined,
  };
};

export const getMessageText = (message: ThreadMessageLike | undefined) => {
  if (!message) {
    return "";
  }

  if (typeof message.content === "string") {
    return message.content.trim();
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (
          part &&
          typeof part === "object" &&
          "type" in part &&
          (part as { type?: string }).type === "text" &&
          "text" in part &&
          typeof (part as { text?: string }).text === "string"
        ) {
          return (part as { text: string }).text;
        }

        return "";
      })
      .join("")
      .trim();
  }

  return "";
};

export const getRagSourcesFromContentParts = (content: unknown): RagSourceLike[] => {
  if (!Array.isArray(content)) {
    return [];
  }

  const inlineSources = content
    .filter(
      (part): part is SourcePartLike =>
        !!part &&
        typeof part === "object" &&
        "type" in part &&
        (part as { type?: string }).type === "source" &&
        "sourceType" in part &&
        (part as { sourceType?: string }).sourceType === "document",
    )
    .map((part, index) => {
      const rag = part.providerMetadata?.rag;
      return {
        chunkId: rag?.chunkId ?? part.id ?? index,
        documentId: rag?.documentId ?? undefined,
        documentName:
          part.filename || part.title || `Knowledge Base Document ${index + 1}`,
        score: typeof rag?.score === "number" ? rag.score : 0,
        content: rag?.content || "",
        matchType:
          typeof rag?.matchType === "string" ? rag.matchType : undefined,
        hitModes: Array.isArray(rag?.hitModes)
          ? rag.hitModes.filter((item): item is string => typeof item === "string")
          : undefined,
      };
    });

  if (inlineSources.length > 0) {
    return inlineSources;
  }

  return content
    .filter(
      (part): part is RagSourceDataPartLike =>
        !!part &&
        typeof part === "object" &&
        "type" in part &&
        (part as { type?: string }).type === "data" &&
        "name" in part &&
        (part as { name?: string }).name === "rag-sources",
    )
    .reduce<RagSourceLike[]>((allSources, part) => {
      if (!Array.isArray(part.data)) {
        return allSources;
      }

      const nextSources = part.data
        .map((source) => toRagSourceLike(source))
        .filter((source): source is RagSourceLike => source !== null);

      allSources.push(...nextSources);
      return allSources;
    }, []);
};

export const getRagProgressFromContentParts = (
  content: unknown,
): RagNodeLike[] => {
  if (!Array.isArray(content)) {
    return [];
  }

  const events = content
    .filter(
      (part): part is RagProgressDataPartLike =>
        !!part &&
        typeof part === "object" &&
        "type" in part &&
        (part as { type?: string }).type === "data" &&
        "name" in part &&
        (part as { name?: string }).name === "rag-node",
    )
    .map((part) => toRagNodeLike(part.data))
    .filter((part): part is RagNodeLike => part !== null);

  if (events.length === 0) {
    return [];
  }

  const deduped = new Map<string, RagNodeLike>();
  for (const event of events) {
    deduped.set(event.nodeId, event);
  }

  return Array.from(deduped.values());
};

export const normalizeInlineText = (value: string) =>
  value.replace(/\s+/g, " ").trim();

const lexicalModeSet = new Set(["lexical", "keyword", "fts"]);
const vectorModeSet = new Set(["vector", "semantic", "embedding"]);

export const getRagSourceAttribution = (source: RagSourceLike) => {
  const normalizedModes = new Set(
    (source.hitModes ?? [])
      .filter((mode) => typeof mode === "string")
      .map((mode) => mode.trim().toLowerCase())
      .filter(Boolean),
  );
  const normalizedMatchType = source.matchType?.trim().toLowerCase();
  const hasVectorMode = Array.from(normalizedModes).some((mode) =>
    vectorModeSet.has(mode),
  );
  const hasLexicalMode = Array.from(normalizedModes).some((mode) =>
    lexicalModeSet.has(mode),
  );

  if (
    normalizedMatchType === "hybrid" ||
    (hasVectorMode && hasLexicalMode)
  ) {
    return {
      label: "双重命中",
      toneClassName:
        "border-emerald-200/80 bg-emerald-50/90 text-emerald-700",
    };
  }

  if (
    normalizedMatchType &&
    lexicalModeSet.has(normalizedMatchType)
  ) {
    return {
      label: "关键词命中",
      toneClassName: "border-sky-200/80 bg-sky-50/90 text-sky-700",
    };
  }

  if (
    normalizedMatchType &&
    vectorModeSet.has(normalizedMatchType)
  ) {
    return {
      label: "语义命中",
      toneClassName:
        "border-amber-200/80 bg-amber-50/90 text-amber-700",
    };
  }

  return {
    label: "知识库命中",
    toneClassName:
      "border-primary-3/80 bg-primary-2/95 text-primary-8",
  };
};

export const getDisplayRagStep = (step: RagNodeLike) => {
  const summary = step.summary ? normalizeInlineText(step.summary) : undefined;

  switch (step.nodeType) {
    case "rewrite":
      return {
        label: "整理检索问题",
        summary: summary ?? "正在将问题改写成更适合检索的表达",
      };
    case "embed":
      return {
        label: "生成语义向量",
        summary: summary ?? "正在准备语义检索所需的查询向量",
      };
    case "retrieve":
      return {
        label: "召回候选片段",
        summary: summary ?? "正在从知识库中筛出相关内容",
      };
    case "rerank":
      return {
        label: "整理结果优先级",
        summary: summary ?? "正在对候选片段做进一步排序",
      };
    case "generate":
      return {
        label: "组织最终回答",
        summary: summary ?? "正在结合来源生成最终回复",
      };
    default:
      return {
        label: step.label,
        summary,
      };
  }
};

export const summarizeRagProgress = (steps: RagNodeLike[]) => {
  if (steps.length === 0) {
    return "";
  }

  const runningStep = steps.find((step) => step.phase === "start");
  if (runningStep) {
    const display = getDisplayRagStep(runningStep);
    return display.summary || `${display.label}中`;
  }

  const errorStep = steps.find((step) => step.phase === "error");
  if (errorStep) {
    const display = getDisplayRagStep(errorStep);
    return display.summary || `${display.label}失败`;
  }

  return "已完成检索与回答组织，可展开查看来源和过程";
};

export const getRagProgressRow = (step: RagNodeLike): RagNodeRow => ({
  ...step,
  ...getDisplayRagStep(step),
  clickable:
    step.phase !== "start" &&
    ((!!step.details && Object.keys(step.details).length > 0) ||
      (!!step.environment && Object.keys(step.environment).length > 0)),
});
