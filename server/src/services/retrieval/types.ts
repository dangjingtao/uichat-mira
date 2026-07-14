export type RetrievalHitMode = "keyword" | "vector" | "rerank";

export type RetrievalCandidate<TMetadata extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  title: string;
  content: string;
  metadata: TMetadata;
  score: number;
  rawScore?: number;
  hitModes?: RetrievalHitMode[];
};

export type RetrievalStageCounts = {
  keyword: number;
  vector: number;
  fused: number;
  reranked: number;
};

export type RetrievalDiagnostics = RetrievalStageCounts & {
  embedding: "used" | "unavailable" | "not_configured";
  rerank: "used" | "unavailable" | "not_configured";
};
