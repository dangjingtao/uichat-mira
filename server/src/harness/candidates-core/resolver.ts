import { executeLocalEmbedding } from "@/services/internal-capabilities/local-embedding.js";
import { toCapabilityIntentDocuments } from "@/agent/intent/capability-documents.js";
import { resolveHarnessToolExposure } from "../exposure-core/index.js";
import { resolveHarnessCapabilityProfiles } from "../profiles/index.js";
import { expandHarnessToolCandidates } from "./expand-tool-candidates.js";
import {
  DEFAULT_MAX_TOOLS,
  DEFAULT_MIN_SCORE,
  DEFAULT_TOP_K,
  computeRuleScore,
  cosineSimilarity,
} from "./scoring.js";
import { rerankHarnessCapabilityMatches } from "./rerank.js";
import type {
  HarnessToolExposure,
  ResolveHarnessToolCandidatesForTurnInput,
  ResolveHarnessToolCandidatesForTurnResult,
  ResolvedHarnessCapabilityMatch,
} from "./types.js";

export const resolveHarnessToolCandidatesForTurn = async (
  input: ResolveHarnessToolCandidatesForTurnInput,
): Promise<ResolveHarnessToolCandidatesForTurnResult> => {
  const source = input.source ?? "agent_intent";
  const topK = Math.max(1, input.topK ?? DEFAULT_TOP_K);
  const minScore = input.minScore ?? DEFAULT_MIN_SCORE;
  const maxTools = Math.max(1, input.maxTools ?? DEFAULT_MAX_TOOLS);

  const exposureDecision = resolveHarnessToolExposure({
    source,
    query: input.query,
    allowExternal: input.allowExternal,
    sandboxProfiles: input.sandboxProfiles,
  });
  const visibleDefinitions = exposureDecision.exposedDefinitions;
  const profiles = resolveHarnessCapabilityProfiles(visibleDefinitions);
  const initialToolExposure: HarnessToolExposure = {
    exposedToolIds: visibleDefinitions.map((definition) => definition.id),
    exposedDefinitions: visibleDefinitions,
    reason: exposureDecision.reason,
    blockedCapabilityIds: exposureDecision.blockedCapabilityIds,
  };

  if (!input.query.trim() || profiles.length === 0) {
    return {
      query: input.query,
      source,
      toolCandidates: [],
      toolExposure: initialToolExposure,
    };
  }

  const documents = toCapabilityIntentDocuments(profiles);
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

  let embeddingResult:
    | Awaited<ReturnType<typeof executeLocalEmbedding>>
    | undefined;
  let queryEmbedding: number[] | undefined;
  let documentEmbeddings: number[][] = [];
  let retrievalError: string | undefined;

  try {
    embeddingResult = await executeLocalEmbedding({
      texts: [input.query, ...documents.map((document) => document.text)],
    });
    [queryEmbedding, ...documentEmbeddings] = embeddingResult.embeddings ?? [];
  } catch (error) {
    retrievalError = error instanceof Error ? error.message : String(error);
  }

  let matches: ResolvedHarnessCapabilityMatch[] = documents
    .map((document, index) => {
      const profile = profileMap.get(document.capabilityId);
      if (!profile) {
        return null;
      }

      const documentEmbedding = documentEmbeddings[index];
      const embeddingScore =
        queryEmbedding && documentEmbedding
          ? cosineSimilarity(queryEmbedding, documentEmbedding)
          : 0;
      const ruleScore = computeRuleScore({
        query: input.query,
        capabilityId: profile.id,
        title: profile.title,
        tags: profile.tags,
        domain: profile.domain,
      });
      const score =
        queryEmbedding && documentEmbedding
          ? embeddingScore * 0.8 + ruleScore * 0.2
          : ruleScore;

      return {
        capabilityId: profile.id,
        title: profile.title,
        score,
        embeddingScore,
        ruleScore,
        rerankScore: 0,
        finalScore: score,
        candidateToolIds: profile.supportingToolIds,
        preferredToolId: profile.preferredToolId,
      } satisfies ResolvedHarnessCapabilityMatch;
    })
    .filter(
      (
        match,
      ): match is NonNullable<typeof match> =>
        match !== null && match.finalScore >= minScore,
    )
    .sort((left, right) => right.finalScore - left.finalScore);

  let rerankModel:
    | {
        model?: string;
        modelConfigId?: string;
      }
    | undefined;

  if (matches.length > 0) {
    try {
      const reranked = await rerankHarnessCapabilityMatches({
        query: input.query,
        matches,
        hasEmbeddingSignal: Boolean(queryEmbedding && documentEmbeddings.length > 0),
      });
      matches = reranked.matches;
      rerankModel = reranked.rerankModel;
    } catch {
      // Keep pre-rerank order when local rerank is unavailable.
    }
  }

  const rankedMatches = matches.slice(0, topK);
  const rankedToolCandidates = expandHarnessToolCandidates({
    matches: rankedMatches,
    definitions: visibleDefinitions,
  }).sort((left, right) => right.finalScore - left.finalScore);
  const toolCandidates = rankedToolCandidates.slice(0, maxTools);
  const definitionMap = new Map(visibleDefinitions.map((definition) => [definition.id, definition]));
  const exposedDefinitions = toolCandidates
    .map((candidate) => definitionMap.get(candidate.toolId))
    .filter((definition): definition is NonNullable<typeof definition> => Boolean(definition));
  const toolExposure: HarnessToolExposure = {
    exposedToolIds: exposedDefinitions.map((definition) => definition.id),
    exposedDefinitions,
    reason: exposureDecision.reason,
    blockedCapabilityIds: exposureDecision.blockedCapabilityIds,
  };

  return {
    query: input.query,
    source,
    toolCandidates,
    toolExposure,
    ...(retrievalError ? { retrievalError } : {}),
    ...(embeddingResult
      ? {
          retrievalModel: {
            provider: "local",
            model: embeddingResult.embeddingModel,
            modelConfigId: embeddingResult.embeddingModelConfigId,
          },
        }
      : {}),
    ...(rerankModel ? { rerankModel } : {}),
  };
};
