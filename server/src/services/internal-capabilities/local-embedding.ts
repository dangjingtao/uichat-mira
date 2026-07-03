import { localEmbeddingSharedNode } from "@/services/shared-nodes/local-embedding.node.js";
import { badRequest } from "@/utils/route-errors.js";

const normalizeTexts = (args: Record<string, unknown>) => {
  const text = typeof args.text === "string" ? args.text.trim() : "";
  const texts = Array.isArray(args.texts)
    ? args.texts
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    : [];

  const merged = texts.length > 0 ? texts : text ? [text] : [];
  if (merged.length === 0) {
    throw badRequest("text or texts is required");
  }

  return merged;
};

export interface ExecuteLocalEmbeddingResult {
  embeddings?: number[][];
  embedding?: number[];
  embeddingDimensions?: number;
  embeddingModel?: string;
  embeddingModelConfigId?: string;
  observation?: unknown;
}

export const executeLocalEmbedding = async (
  args: Record<string, unknown>,
): Promise<ExecuteLocalEmbeddingResult> => {
  const texts = normalizeTexts(args);
  const result = await localEmbeddingSharedNode.runNode({
    state: {
      embeddingTexts: texts,
    },
  });

  return {
    ...result.state,
    observation: result.observation,
  };
};
