import { executeLocalRerank } from "@/services/internal-capabilities/local-rerank.js";
import type { RetrievalCandidate, RetrievalDiagnostics } from "./types.js";

const RRF_K = 60;

export const fuseRetrievalCandidates = <TMetadata extends Record<string, unknown>>(
  input: {
    keywordCandidates: RetrievalCandidate<TMetadata>[];
    vectorCandidates: RetrievalCandidate<TMetadata>[];
    maxResults: number;
  },
) => {
  const merged = new Map<string, RetrievalCandidate<TMetadata>>();
  const add = (candidate: RetrievalCandidate<TMetadata>, rank: number, mode: "keyword" | "vector") => {
    const previous = merged.get(candidate.id);
    const nextScore = (previous?.score ?? 0) + 1 / (RRF_K + rank + 1);
    merged.set(candidate.id, {
      ...(previous ?? candidate),
      score: nextScore,
      rawScore: Math.max(previous?.rawScore ?? 0, candidate.rawScore ?? candidate.score),
      hitModes: Array.from(new Set([...(previous?.hitModes ?? []), mode])),
    });
  };

  input.keywordCandidates.forEach((candidate, index) => add(candidate, index, "keyword"));
  input.vectorCandidates.forEach((candidate, index) => add(candidate, index, "vector"));

  return [...merged.values()]
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, Math.max(1, input.maxResults));
};

export const rerankRetrievalCandidates = async <TMetadata extends Record<string, unknown>>(
  input: {
    query: string;
    candidates: RetrievalCandidate<TMetadata>[];
    maxResults: number;
  },
): Promise<{ candidates: RetrievalCandidate<TMetadata>[]; status: RetrievalDiagnostics["rerank"] }> => {
  if (input.candidates.length === 0) {
    return { candidates: [], status: "not_configured" };
  }

  try {
    const result = await executeLocalRerank({
      query: input.query,
      topN: input.maxResults,
      candidates: input.candidates.map((candidate) => ({
        id: candidate.id,
        text: `${candidate.title}\n${candidate.content}`,
        metadata: candidate.metadata,
      })),
    });
    const scores = new Map(
      (result.rerankedCandidates ?? []).map((candidate) => [candidate.id, candidate.probability]),
    );
    if (scores.size === 0) {
      return {
        candidates: input.candidates.slice(0, input.maxResults),
        status: "unavailable",
      };
    }
    return {
      candidates: input.candidates
        .map((candidate) => ({
          ...candidate,
          score: scores.get(candidate.id) ?? candidate.score,
          hitModes: scores.has(candidate.id)
            ? [...new Set([...(candidate.hitModes ?? []), "rerank" as const])]
            : candidate.hitModes,
        }))
        .sort((left, right) => right.score - left.score)
        .slice(0, input.maxResults),
      status: "used",
    };
  } catch {
    return {
      candidates: input.candidates.slice(0, input.maxResults),
      status: "unavailable",
    };
  }
};
