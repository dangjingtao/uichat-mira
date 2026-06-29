import type { LocalRerankCandidate } from "@/services/local-model-runtime/index.js";
import { localRerankSharedNode } from "@/services/shared-nodes/local-rerank.node.js";
import { badRequest } from "@/utils/route-errors.js";

const normalizeQuery = (args: Record<string, unknown>) => {
  const query = typeof args.query === "string" ? args.query.trim() : "";
  if (!query) {
    throw badRequest("query is required");
  }
  return query;
};

const normalizeCandidates = (
  args: Record<string, unknown>,
): Array<LocalRerankCandidate<Record<string, unknown> | undefined>> => {
  if (!Array.isArray(args.candidates) || args.candidates.length === 0) {
    throw badRequest("candidates is required");
  }

  const candidates = args.candidates.flatMap((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return [];
    }

    const candidate = value as Record<string, unknown>;
    const text = typeof candidate.text === "string" ? candidate.text.trim() : "";
    if (!text) {
      return [];
    }

    const id =
      typeof candidate.id === "string" && candidate.id.trim()
        ? candidate.id.trim()
        : `candidate-${index + 1}`;

    const metadata =
      candidate.metadata &&
      typeof candidate.metadata === "object" &&
      !Array.isArray(candidate.metadata)
        ? (candidate.metadata as Record<string, unknown>)
        : undefined;

    return [
      {
        id,
        text,
        ...(metadata ? { metadata } : {}),
      },
    ];
  });

  if (candidates.length === 0) {
    throw badRequest("candidates must include at least one item with text");
  }

  return candidates;
};

const normalizeTopN = (args: Record<string, unknown>) => {
  if (args.topN === undefined) {
    return undefined;
  }

  if (typeof args.topN !== "number" || !Number.isFinite(args.topN)) {
    throw badRequest("topN must be a finite number");
  }

  return Math.max(1, Math.trunc(args.topN));
};

export interface ExecuteLocalRerankResult {
  rerankedCandidates?: Array<
    LocalRerankCandidate<Record<string, unknown> | undefined> & {
      score: number;
      probability: number;
      rank: number;
    }
  >;
  rerankModel?: string;
  rerankModelConfigId?: string;
  observation?: unknown;
}

export const executeLocalRerank = async (
  args: Record<string, unknown>,
): Promise<ExecuteLocalRerankResult> => {
  const query = normalizeQuery(args);
  const candidates = normalizeCandidates(args);
  const topN = normalizeTopN(args);

  const result = await localRerankSharedNode.runNode({
    state: {
      rerankQuery: query,
      rerankCandidates: candidates,
    },
    ...(topN ? { topN } : {}),
  });

  return {
    ...result.state,
    observation: result.observation,
  };
};
