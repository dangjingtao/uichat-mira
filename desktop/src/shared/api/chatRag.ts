import { post } from "../lib/request";

export interface RagRetrievedChunk {
  chunkId: number;
  documentId: string;
  documentName: string;
  content: string;
  score: number;
  matchType?: "vector" | "lexical" | "hybrid";
  hitModes?: Array<"vector" | "lexical">;
}

export interface RetrieveRagSourcesPayload {
  question: string;
  knowledgeBaseId?: string;
  evolvingKnowledgeEnabled?: boolean;
  topK?: number;
  topN?: number;
}

export async function retrieveRagSources(
  payload: RetrieveRagSourcesPayload,
): Promise<RagRetrievedChunk[]> {
  return post<RagRetrievedChunk[]>("/chat/rag/retrieve", payload);
}
