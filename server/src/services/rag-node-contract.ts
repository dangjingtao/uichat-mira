import type { RetrievedChunk } from "./rag-nodes";

export interface RagNodeEnvironment {
  model?: {
    role?: "task" | "llm" | "embedding" | "rerank" | string;
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
  };
  result?: {
    success?: boolean;
    finishReason?: string;
    statusCode?: number;
    error?: {
      code?: string;
      type?: string;
      message: string;
    };
    usage?: {
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
    };
    metrics?: {
      inputCount?: number;
      outputCount?: number;
      returnedCount?: number;
      candidateCount?: number;
    };
    response?: {
      requestId?: string;
      model?: string;
      summary?: Record<string, unknown>;
    };
  };
  retrieval?: {
    knowledgeBaseId?: string | null;
    topK?: number | null;
    topN?: number | null;
    candidateCount?: number | null;
    returnedCount?: number | null;
  };
  timing?: {
    startedAt: string;
    finishedAt: string;
    durationMs: number;
  };
  context?: Record<string, unknown>;
}

export interface RagNodeObservation {
  label: string;
  summary?: string;
  details?: Record<string, unknown>;
  artifacts?: Record<string, unknown>;
  sources?: RetrievedChunk[];
  environment?: RagNodeEnvironment;
}

export interface RagNodeResult<TStatePatch> {
  state: TStatePatch;
  observation: RagNodeObservation;
}
