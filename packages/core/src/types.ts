export type ModelProvider = "deepseek" | "local";
export type VectorStoreProvider = "sqlite-vec" | "pgvector";

export interface RagSettings {
  modelProvider: ModelProvider;
  modelName: string;
  apiBaseUrl: string;
  vectorStoreProvider: VectorStoreProvider;
  databaseUrl?: string;
}

export * from "./chat-core";
