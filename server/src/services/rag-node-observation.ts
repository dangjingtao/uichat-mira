import type { RagNodeEnvironment, RagNodeObservation } from "./rag-node-contract";

export const createTiming = (startedAtMs: number) => {
  const finishedAtMs = Date.now();
  return {
    startedAt: new Date(startedAtMs).toISOString(),
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
  };
};

export const withTiming = (
  startedAtMs: number,
  environment?: RagNodeEnvironment,
): RagNodeEnvironment => ({
  ...(environment ?? {}),
  timing: createTiming(startedAtMs),
});

export const createTimedEnvironment = (
  startedAtMs: number,
  input?: Omit<RagNodeEnvironment, "timing">,
): RagNodeEnvironment =>
  withTiming(startedAtMs, input);

export const createResultEnvironment = (input: NonNullable<RagNodeEnvironment["result"]>): RagNodeEnvironment => ({
  result: input,
});

export const createModelEnvironment = (input: {
  role: "task" | "llm" | "embedding" | "rerank" | string;
  providerCode?: string;
  providerLabel?: string;
  protocol?: string;
  operation?: string;
  endpoint?: string;
  model?: string;
  modelConfigId?: string;
  params?: Record<string, unknown>;
  request?: {
    method?: string;
    url?: string;
    body?: Record<string, unknown>;
  };
}): RagNodeEnvironment => ({
  model: {
    role: input.role,
    ...(input.providerCode ? { providerCode: input.providerCode } : {}),
    ...(input.providerLabel ? { providerLabel: input.providerLabel } : {}),
    ...(input.protocol ? { protocol: input.protocol } : {}),
    ...(input.operation ? { operation: input.operation } : {}),
    ...(input.endpoint ? { endpoint: input.endpoint } : {}),
    ...(input.model ? { model: input.model } : {}),
    ...(input.modelConfigId ? { modelConfigId: input.modelConfigId } : {}),
    ...(input.params ? { params: input.params } : {}),
    ...(input.request ? { request: input.request } : {}),
  },
});

export const createObservation = (input: {
  label: string;
  summary?: string;
  details?: Record<string, unknown>;
  artifacts?: Record<string, unknown>;
  environment?: RagNodeEnvironment;
  sources?: RagNodeObservation["sources"];
}): RagNodeObservation => ({
  label: input.label,
  ...(input.summary ? { summary: input.summary } : {}),
  ...(input.details ? { details: input.details } : {}),
  ...(input.artifacts ? { artifacts: input.artifacts } : {}),
  ...(input.environment ? { environment: input.environment } : {}),
  ...("sources" in input ? { sources: input.sources } : {}),
});

export const createModelCallObservation = (input: {
  startedAtMs: number;
  label: string;
  summary?: string;
  details?: Record<string, unknown>;
  artifacts?: Record<string, unknown>;
  role: "task" | "llm" | "embedding" | "rerank" | string;
  providerCode?: string;
  providerLabel?: string;
  protocol?: string;
  operation?: string;
  endpoint?: string;
  model?: string;
  modelConfigId?: string;
  params?: Record<string, unknown>;
  request?: {
    method?: string;
    url?: string;
    body?: Record<string, unknown>;
  };
  result?: RagNodeEnvironment["result"];
  retrieval?: RagNodeEnvironment["retrieval"];
  context?: RagNodeEnvironment["context"];
  sources?: RagNodeObservation["sources"];
}): RagNodeObservation =>
  createObservation({
    label: input.label,
    ...(input.summary ? { summary: input.summary } : {}),
    ...(input.details ? { details: input.details } : {}),
    ...(input.artifacts ? { artifacts: input.artifacts } : {}),
    ...("sources" in input ? { sources: input.sources } : {}),
    environment: createTimedEnvironment(input.startedAtMs, {
      ...createModelEnvironment({
        role: input.role,
        ...(input.providerCode ? { providerCode: input.providerCode } : {}),
        ...(input.providerLabel ? { providerLabel: input.providerLabel } : {}),
        ...(input.protocol ? { protocol: input.protocol } : {}),
        ...(input.operation ? { operation: input.operation } : {}),
        ...(input.endpoint ? { endpoint: input.endpoint } : {}),
        ...(input.model ? { model: input.model } : {}),
        ...(input.modelConfigId ? { modelConfigId: input.modelConfigId } : {}),
        ...(input.params ? { params: input.params } : {}),
        ...(input.request ? { request: input.request } : {}),
      }),
      ...(input.result ? { result: input.result } : {}),
      ...(input.retrieval ? { retrieval: input.retrieval } : {}),
      ...(input.context ? { context: input.context } : {}),
    }),
  });

export const createRetrievalObservation = (input: {
  startedAtMs: number;
  label: string;
  summary?: string;
  details?: Record<string, unknown>;
  artifacts?: Record<string, unknown>;
  knowledgeBaseId?: string | null;
  topK?: number | null;
  topN?: number | null;
  candidateCount?: number | null;
  returnedCount?: number | null;
  result?: RagNodeEnvironment["result"];
  context?: RagNodeEnvironment["context"];
  sources?: RagNodeObservation["sources"];
}): RagNodeObservation =>
  createObservation({
    label: input.label,
    ...(input.summary ? { summary: input.summary } : {}),
    ...(input.details ? { details: input.details } : {}),
    ...(input.artifacts ? { artifacts: input.artifacts } : {}),
    ...("sources" in input ? { sources: input.sources } : {}),
    environment: createTimedEnvironment(input.startedAtMs, {
      retrieval: {
        ...(input.knowledgeBaseId !== undefined
          ? { knowledgeBaseId: input.knowledgeBaseId }
          : {}),
        ...(input.topK !== undefined ? { topK: input.topK } : {}),
        ...(input.topN !== undefined ? { topN: input.topN } : {}),
        ...(input.candidateCount !== undefined
          ? { candidateCount: input.candidateCount }
          : {}),
        ...(input.returnedCount !== undefined
          ? { returnedCount: input.returnedCount }
          : {}),
      },
      ...(input.result ? { result: input.result } : {}),
      ...(input.context ? { context: input.context } : {}),
    }),
  });
