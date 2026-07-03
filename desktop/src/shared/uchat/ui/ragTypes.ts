// These types describe the structured RAG trace and source payloads rendered
// by the shared uchat UI layer on top of canonical uchat messages.
export type RagSourceLike = {
  chunkId: string | number;
  documentId?: string;
  documentName: string;
  score: number;
  content: string;
  matchType?: string;
  hitModes?: string[];
};

// RagProgressStatus represents the lifecycle of one RAG pipeline node.
export type RagProgressStatus = "start" | "done" | "error";

// RagNodeEnvironment keeps the structured execution metadata shown in the
// detail drawer for debugging and observability.
export type RagNodeEnvironment = {
  model?: {
    role?: string;
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
};

// RagNodeLike is the normalized pipeline event shape rendered inline above
// assistant messages.
export type RagNodeLike = {
  nodeId: string;
  traceDomain?: "rag" | "agent" | "tool" | "generic";
  slotKey?: string;
  attemptKey?: string;
  iteration?: number;
  nodeType:
    | "rewrite"
    | "embed"
    | "retrieve"
    | "rerank"
    | "generate"
    | "plan"
    | "approval"
    | "error"
    | "tool"
    | "reason"
    | "memory"
    | "context"
    | string;
  phase: RagProgressStatus;
  label: string;
  summary?: string;
  details?: Record<string, unknown>;
  environment?: RagNodeEnvironment;
};
