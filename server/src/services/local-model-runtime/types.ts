export interface LocalModelFile {
  path: string;
  bytes: number;
  sha256: string;
}

export interface LocalModelManifestEntry {
  id: string;
  family: "embedding" | "rerank";
  source: string;
  runtime: "onnxruntime-web/wasm";
  dimensions: number | null;
  path: string;
  files: LocalModelFile[];
  totalBytes: number;
  archive?: string;
  archiveBytes?: number;
  archiveSha256?: string;
}

export interface LocalModelManifest {
  schemaVersion: number;
  generatedAt: string;
  runtime: {
    default: "onnxruntime-web/wasm";
    native: "optional";
  };
  packaging?: {
    format: "tar.br";
    schemaVersion: number;
  };
  models: LocalModelManifestEntry[];
}

export interface LocalEmbeddingResult {
  embeddings: number[][];
  dimensions: number;
  model: string;
  modelConfigId: string;
  providerCode: "local";
  runtime: "onnxruntime-web/wasm";
}

export interface LocalRerankCandidate<TMeta = unknown> {
  id: string;
  text: string;
  metadata?: TMeta;
}

export interface LocalRerankResult<TMeta = unknown> {
  candidates: Array<LocalRerankCandidate<TMeta> & {
    score: number;
    probability: number;
    rank: number;
  }>;
  model: string;
  modelConfigId: string;
  providerCode: "local";
  runtime: "onnxruntime-web/wasm";
}
