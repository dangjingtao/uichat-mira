import i18n from "@/shared/i18n";
import type { ChatMessage } from "../core";
import type { RagNodeLike, RagProgressStatus, RagSourceLike } from "./ragTypes";

// UChatRenderablePart is the small adapter shape used to derive RAG trace
// metadata from canonical uchat message parts.
type UChatRenderablePart =
  | { type: "text"; text: string }
  | { type: "data"; name: string; data: unknown };

// UChatRagProgressDetail is the payload shown in the execution detail drawer.
export type UChatRagProgressDetail = {
  messageId: string;
  nodeId: string;
  nodeType: string;
  label: string;
  status: RagProgressStatus;
  summary?: string;
  details?: Record<string, unknown>;
  environment?: RagNodeLike["environment"];
};

// UChatRagSourceDetail is the payload shown in the source drawer.
export type UChatRagSourceDetail = {
  messageId?: string;
  sources: RagSourceLike[];
};

export type UChatRagFailurePresentation = {
  title: string;
  detail?: string;
  rawErrorMessage?: string;
};

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

const toRagNodeLike = (value: unknown): RagNodeLike | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<RagNodeLike>;
  if (
    typeof candidate.nodeId !== "string" ||
    typeof candidate.nodeType !== "string" ||
    typeof candidate.phase !== "string" ||
    typeof candidate.label !== "string"
  ) {
    return null;
  }

  if (
    !["start", "done", "error"].includes(candidate.phase as RagProgressStatus)
  ) {
    return null;
  }

  return {
    nodeId: candidate.nodeId,
    nodeType: candidate.nodeType,
    phase: candidate.phase as RagProgressStatus,
    label: candidate.label,
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

// toUChatRenderableParts converts canonical uchat parts into the smaller UI
// parser format used by the shared RAG visualization rules.
export const toUChatRenderableParts = (message: ChatMessage): UChatRenderablePart[] =>
  message.parts.flatMap<UChatRenderablePart>((part) => {
    if (part.type === "text") {
      return [{ type: "text", text: part.text }];
    }

    if (part.type === "data") {
      return [{ type: "data", name: part.name, data: part.value }];
    }

    return [];
  });

// getRagProgressFromRenderableParts reconstructs pipeline progress rows from
// canonical `data` parts emitted by the run driver.
export const getRagProgressFromRenderableParts = (
  content: UChatRenderablePart[],
): RagNodeLike[] => {
  const events = content
    .filter(
      (part): part is Extract<UChatRenderablePart, { type: "data" }> =>
        part.type === "data" && part.name === "rag-node",
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

// normalizeInlineText keeps drawer content compact by collapsing whitespace.
export const normalizeInlineText = (value: string) =>
  value.replace(/\s+/g, " ").trim();

const lexicalModeSet = new Set(["lexical", "keyword", "fts"]);
const vectorModeSet = new Set(["vector", "semantic", "embedding"]);

// getRagSourceAttribution computes the displayed retrieval attribution label.
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

  if (normalizedMatchType === "hybrid" || (hasVectorMode && hasLexicalMode)) {
    return {
      label: i18n.t("chat.parsers.doubleHit"),
      toneClassName: "border-emerald-200/70 bg-emerald-50/70 text-emerald-700",
    };
  }

  if (normalizedMatchType && lexicalModeSet.has(normalizedMatchType)) {
    return {
      label: i18n.t("chat.parsers.keywordHit"),
      toneClassName: "border-sky-200/70 bg-sky-50/70 text-sky-700",
    };
  }

  if (normalizedMatchType && vectorModeSet.has(normalizedMatchType)) {
    return {
      label: i18n.t("chat.parsers.semanticHit"),
      toneClassName: "border-amber-200/70 bg-amber-50/70 text-amber-700",
    };
  }

  return {
    label: i18n.t("chat.parsers.knowledgeBaseHit"),
    toneClassName: "border-border/70 bg-surface-secondary/80 text-text-secondary",
  };
};

// getDisplayRagStep maps backend node identifiers to localized labels and
// fallback summaries for the inline trace row.
export const getDisplayRagStep = (step: RagNodeLike) => {
  const summary = step.summary ? normalizeInlineText(step.summary) : undefined;

  switch (step.nodeType) {
    case "rewrite":
      return {
        label: i18n.t("chat.parsers.rewriteLabel"),
        summary: summary ?? i18n.t("chat.parsers.rewriteSummary"),
      };
    case "embed":
      return {
        label: i18n.t("chat.parsers.embedLabel"),
        summary: summary ?? i18n.t("chat.parsers.embedSummary"),
      };
    case "retrieve":
      return {
        label: i18n.t("chat.parsers.retrieveLabel"),
        summary: summary ?? i18n.t("chat.parsers.retrieveSummary"),
      };
    case "rerank":
      return {
        label: i18n.t("chat.parsers.rerankLabel"),
        summary: summary ?? i18n.t("chat.parsers.rerankSummary"),
      };
    case "generate":
      return {
        label: i18n.t("chat.parsers.generateLabel"),
        summary: summary ?? i18n.t("chat.parsers.generateSummary"),
      };
    default:
      return {
        label: step.label,
        summary,
      };
  }
};

// summarizeRagProgress condenses the pipeline state into one inline sentence.
export const summarizeRagProgress = (steps: RagNodeLike[]) => {
  if (steps.length === 0) {
    return "";
  }

  const runningStep = steps.find((step) => step.phase === "start");
  if (runningStep) {
    const display = getDisplayRagStep(runningStep);
    return (
      display.summary ||
      i18n.t("chat.parsers.inProgress", { label: display.label })
    );
  }

  const errorStep = steps.find((step) => step.phase === "error");
  if (errorStep) {
    const display = getDisplayRagStep(errorStep);
    return (
      display.summary || i18n.t("chat.parsers.failed", { label: display.label })
    );
  }

  return i18n.t("chat.parsers.completed");
};

export const getRagFailurePresentation = (
  steps: RagNodeLike[],
  errorMessage?: string,
): UChatRagFailurePresentation => {
  const errorStep = [...steps].reverse().find((step) => step.phase === "error");
  if (errorStep) {
    const display = getDisplayRagStep(errorStep);
    const normalizedErrorMessage = errorMessage?.trim();
    const explicitStepSummary = errorStep.summary
      ? normalizeInlineText(errorStep.summary)
      : undefined;
    return {
      title: i18n.t("chat.thread.errors.ragPhaseFailed", {
        label: display.label,
      }),
      detail:
        explicitStepSummary ||
        normalizedErrorMessage ||
        i18n.t("chat.thread.errors.ragPhaseFailedDetail", {
          label: display.label,
        }),
      rawErrorMessage: normalizedErrorMessage,
    };
  }

  const normalizedErrorMessage = errorMessage?.trim();
  return {
    title: i18n.t("chat.thread.errors.generationFailed"),
    detail:
      normalizedErrorMessage || i18n.t("chat.thread.errors.generationFailedDetail"),
    rawErrorMessage: normalizedErrorMessage,
  };
};

const getRagReturnedCount = (step: RagNodeLike) => {
  const resultReturnedCount = step.environment?.result?.metrics?.returnedCount;
  if (
    typeof resultReturnedCount === "number" &&
    Number.isFinite(resultReturnedCount) &&
    resultReturnedCount > 0
  ) {
    return resultReturnedCount;
  }

  const retrievalReturnedCount = step.environment?.retrieval?.returnedCount;
  if (
    typeof retrievalReturnedCount === "number" &&
    Number.isFinite(retrievalReturnedCount) &&
    retrievalReturnedCount > 0
  ) {
    return retrievalReturnedCount;
  }

  return null;
};

// getVisibleRagSources trims the rendered source list to the count reported by
// the latest successful retrieval or rerank node.
export const getVisibleRagSources = (
  sources: RagSourceLike[],
  steps: RagNodeLike[],
) => {
  if (sources.length === 0) {
    return [];
  }

  const preferredStep =
    [...steps]
      .reverse()
      .find((step) => step.nodeType === "rerank" && step.phase === "done") ??
    [...steps]
      .reverse()
      .find((step) => step.nodeType === "retrieve" && step.phase === "done");
  const returnedCount = preferredStep ? getRagReturnedCount(preferredStep) : null;

  if (!returnedCount) {
    return sources;
  }

  return sources.slice(0, Math.min(returnedCount, sources.length));
};
