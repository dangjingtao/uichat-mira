import { listCapabilityDefinitions } from "@/mcp/harness/registry.js";
import { providerProxyService } from "@/services/provider-proxy.service/index.js";
import {
  toCapabilityIntentDocuments,
} from "./capability-documents.js";
import type {
  AgentIntentEmbeddingConfig,
  CapabilityIntentCandidate,
  CapabilityIntentResult,
} from "./types.js";

const DEFAULT_TOP_K = 10;
const DEFAULT_MIN_SCORE = -1;

const magnitude = (vector: number[]) =>
  Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

export const cosineSimilarity = (left: number[], right: number[]) => {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return -1;
  }

  const leftMagnitude = magnitude(left);
  const rightMagnitude = magnitude(right);
  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return -1;
  }

  let dotProduct = 0;
  for (let index = 0; index < left.length; index += 1) {
    dotProduct += (left[index] ?? 0) * (right[index] ?? 0);
  }

  return dotProduct / (leftMagnitude * rightMagnitude);
};

export const matchCapabilitiesByEmbedding = async (input: {
  query: string;
  config?: AgentIntentEmbeddingConfig;
}): Promise<CapabilityIntentResult> => {
  const definitions = listCapabilityDefinitions();
  const documents = toCapabilityIntentDocuments(definitions);
  const topK = Math.max(1, input.config?.topK ?? DEFAULT_TOP_K);
  const minScore = input.config?.minScore ?? DEFAULT_MIN_SCORE;
  const requestedProvider = input.config?.requestedProvider ?? "default";

  if (!input.query.trim() || documents.length === 0) {
    return {
      query: input.query,
      topCandidates: [],
      selectedCapabilityIds: [],
    };
  }

  const embeddingResult = await providerProxyService.createEmbeddings(
    requestedProvider,
    [input.query, ...documents.map((document) => document.text)],
  );
  const [queryEmbedding, ...documentEmbeddings] = embeddingResult.embeddings;

  const candidates = documents
    .map<CapabilityIntentCandidate | null>((document, index) => {
      const documentEmbedding = documentEmbeddings[index];
      if (!queryEmbedding || !documentEmbedding) {
        return null;
      }

      const score = cosineSimilarity(queryEmbedding, documentEmbedding);
      return {
        capabilityId: document.capabilityId,
        title: document.title,
        score,
        source: document.source,
        domain: document.domain,
        tags: document.tags,
      };
    })
    .filter((candidate): candidate is CapabilityIntentCandidate => candidate !== null)
    .filter((candidate) => candidate.score >= minScore)
    .sort((left, right) => right.score - left.score)
    .slice(0, topK);

  return {
    query: input.query,
    topCandidates: candidates,
    selectedCapabilityIds: candidates.map((candidate) => candidate.capabilityId),
    retrievalModel: {
      provider: embeddingResult.providerCode,
      model: embeddingResult.model,
      modelConfigId: embeddingResult.modelConfigId,
    },
  };
};
