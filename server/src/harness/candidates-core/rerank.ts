import { executeLocalRerank } from "@/services/internal-capabilities/local-rerank.js";
import type { ResolvedHarnessCapabilityMatch } from "./types.js";

export const rerankHarnessCapabilityMatches = async (input: {
  query: string;
  matches: ResolvedHarnessCapabilityMatch[];
}) => {
  if (input.matches.length === 0) {
    return {
      matches: input.matches,
      rerankModel: undefined,
    };
  }

  const rerankResult = await executeLocalRerank({
    query: input.query,
    topN: input.matches.length,
    candidates: input.matches.map((match) => ({
      id: match.capabilityId,
      text: [
        match.title,
        match.candidateToolIds.join(" "),
      ]
        .filter(Boolean)
        .join("\n"),
    })),
  });

  const rerankModel = {
    model: rerankResult.rerankModel,
    modelConfigId: rerankResult.rerankModelConfigId,
  };

  const rerankMap = new Map(
    (rerankResult.rerankedCandidates ?? []).map((candidate) => [
      candidate.id,
      candidate.probability,
    ]),
  );

  const matches = input.matches
    .map((match) => {
      const rerankScore = rerankMap.get(match.capabilityId) ?? 0;

      return {
        ...match,
        rerankScore,
        finalScore: rerankScore,
      };
    })
    .sort(
      (left, right) =>
        right.rerankScore - left.rerankScore ||
        right.embeddingScore - left.embeddingScore,
    );

  return {
    matches,
    rerankModel,
  };
};
