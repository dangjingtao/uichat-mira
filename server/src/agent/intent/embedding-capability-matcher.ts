import { resolveHarnessCapabilityDiagnostics } from "@/mcp/harness/capability-diagnostics.js";
import type {
  AgentIntentEmbeddingConfig,
  CapabilityIntentResult,
} from "./types.js";

export const cosineSimilarity = (left: number[], right: number[]) => {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return -1;
  }
  const leftMagnitude = Math.sqrt(left.reduce((sum, value) => sum + value * value, 0));
  const rightMagnitude = Math.sqrt(right.reduce((sum, value) => sum + value * value, 0));
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
  const diagnostics = await resolveHarnessCapabilityDiagnostics({
    query: input.query,
    source: "agent_intent",
    topK: input.config?.topK,
    minScore: input.config?.minScore,
    selectedTopK: input.config?.selectedTopK,
    selectedMinScore: input.config?.selectedMinScore,
  });

  return {
    query: diagnostics.query,
    topCandidates: diagnostics.candidates,
    selectedCapabilityIds: diagnostics.selectedCapabilityIds,
    selectedToolIds: [],
    exposureReasons: diagnostics.exposureReasons,
    retrievalModel: diagnostics.retrievalModel,
  };
};
