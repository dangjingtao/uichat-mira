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

export const summarizeRagProgress = (steps: RagNodeLike[]) => {
  if (steps.length === 0) {
    return "";
  }

  const runningStep = steps.find((step) => step.phase === "start");
  if (runningStep) {
    return runningStep.summary || `${runningStep.label}中`;
  }

  const errorStep = steps.find((step) => step.phase === "error");
  if (errorStep) {
    return errorStep.summary || `${errorStep.label}失败`;
  }

  const completedCount = steps.filter((step) => step.phase === "done").length;
  return `已完成 ${completedCount} 个节点`;
};

export const getRagProgressRow = (step: RagNodeLike): RagNodeRow => ({
  ...step,
  clickable:
    step.phase !== "start" &&
    ((!!step.details && Object.keys(step.details).length > 0) ||
      (!!step.environment && Object.keys(step.environment).length > 0)),
});
