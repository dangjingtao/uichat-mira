export type ThreadMessageLike = {
  id?: string;
  role?: string;
  content?: unknown;
  createdAt?: string | Date;
  metadata?: {
    rag?: {
      sources?: RagSourceLike[];
    };
  };
};

export type RagSourceProviderMetadata = {
  rag?: {
    chunkId?: string | number | null;
    documentId?: string | null;
    score?: number | null;
    content?: string;
    matchType?: string | null;
    hitModes?: string[] | null;
  };
};

export type RagSourceLike = {
  chunkId: string | number;
  documentId?: string;
  documentName: string;
  score: number;
  content: string;
  matchType?: string;
  hitModes?: string[];
};

export type RagSourceDataPartLike = {
  type?: string;
  name?: string;
  data?: unknown;
};

export type RagProgressStatus = "start" | "done" | "error";

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

export type RagNodeType =
  | "rewrite"
  | "embed"
  | "retrieve"
  | "rerank"
  | "generate"
  | string;

export type RagNodeLike = {
  nodeId: string;
  nodeType: RagNodeType;
  phase: RagProgressStatus;
  label: string;
  summary?: string;
  details?: Record<string, unknown>;
  environment?: RagNodeEnvironment;
};

export type RagNodeRow = RagNodeLike & {
  clickable: boolean;
};

export type SelectedRagProgressKey = {
  messageId: string;
  nodeId: string;
};

export type RagProgressDataPartLike = {
  type?: string;
  name?: string;
  data?: unknown;
};

export type SourcePartLike = {
  type?: string;
  sourceType?: string;
  id?: string;
  title?: string;
  filename?: string;
  providerMetadata?: RagSourceProviderMetadata;
};
