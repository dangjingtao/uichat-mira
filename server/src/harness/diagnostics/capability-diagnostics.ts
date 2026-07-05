import { resolveHarnessActionProfiles } from "../action-profiles.js";
import { resolveHarnessCapabilityProfiles } from "../profiles/index.js";
import { resolveHarnessToolCandidatesForTurn } from "../candidates-core/index.js";
import type { ToolIntentCandidate } from "@/agent/intent/types.js";
import type { HarnessTurnSource } from "../shared/types.js";

export interface HarnessCapabilityDiagnosticsInput {
  query: string;
  source?: HarnessTurnSource;
  topK?: number;
  minScore?: number;
  selectedTopK?: number;
  selectedMinScore?: number;
}

export interface HarnessCapabilityDiagnosticsResult {
  query: string;
  source: HarnessTurnSource;
  exposureReasons: string[];
  blockedCapabilityIds: string[];
  toolExposure: {
    exposedToolIds: string[];
    exposedDefinitions: Array<{
      id: string;
      title: string;
      description: string;
      domain: string;
      source: "internal" | "external";
      mode: string;
      tags: string[];
    }>;
    reason: string[];
    blockedCapabilityIds: string[];
  };
  toolCandidates: Array<{
    toolId: string;
    title: string;
    description: string;
    domain: string;
    source: "internal" | "external";
    tags: string[];
    score: number;
    embeddingScore: number;
    ruleScore: number;
    rerankScore: number;
    finalScore: number;
    reason?: string;
    actionProfileId?: string;
    actionProfileTitle?: string;
    actionProfileDescription?: string;
    preferredForQuery?: boolean;
  }>;
  retrievalModel?: {
    provider?: string;
    model?: string;
    modelConfigId?: string;
  };
  retrievalError?: string;
  rerankModel?: {
    model?: string;
    modelConfigId?: string;
  };
  profiles: Array<{
    capabilityId: string;
    preferredToolId: string;
    supportingToolIds: string[];
    actionProfileId?: string;
    actionProfileTitle?: string;
    actionProfileDescription?: string;
    title: string;
    description: string;
    domain: string;
    source: "internal" | "external";
    tags: string[];
  }>;
  actionProfiles: Array<{
    actionProfileId: string;
    runtimeToolId: string;
    title: string;
    description: string;
    domain: string;
    source: "internal";
    tags: string[];
  }>;
  candidates: ToolIntentCandidate[];
  selectedToolIds: string[];
}

const DEFAULT_SELECTED_TOP_K = 1;
const DEFAULT_SELECTED_MIN_SCORE = 0.3;

export const resolveHarnessCapabilityDiagnostics = async (
  input: HarnessCapabilityDiagnosticsInput,
): Promise<HarnessCapabilityDiagnosticsResult> => {
  const source = input.source ?? "agent_intent";
  const selectedTopK = Math.max(0, input.selectedTopK ?? DEFAULT_SELECTED_TOP_K);
  const selectedMinScore = input.selectedMinScore ?? DEFAULT_SELECTED_MIN_SCORE;

  const candidateResolution = await resolveHarnessToolCandidatesForTurn({
    query: input.query,
    source,
    topK: input.topK,
    minScore: input.minScore,
  });
  const profiles = resolveHarnessCapabilityProfiles(
    candidateResolution.toolExposure.exposedDefinitions,
  );
  const actionProfiles = resolveHarnessActionProfiles(
    candidateResolution.toolExposure.exposedDefinitions,
  );
  const candidates: ToolIntentCandidate[] = candidateResolution.toolCandidates.map((candidate) => ({
    toolId: candidate.toolId,
    title: candidate.title,
    description: candidate.description,
    score: candidate.score,
    embeddingScore: candidate.embeddingScore,
    ruleScore: candidate.ruleScore,
    rerankScore: candidate.rerankScore,
    finalScore: candidate.finalScore,
    source: candidate.source,
    domain: candidate.domain,
    tags: candidate.tags,
    ...(candidate.actionProfileId
      ? {
          actionProfileId: candidate.actionProfileId,
          actionProfileTitle: candidate.actionProfileTitle,
          actionProfileDescription: candidate.actionProfileDescription,
        }
      : {}),
    ...(candidate.preferredForQuery === true ? { preferredForQuery: true } : {}),
    ...(candidate.reason ? { reason: candidate.reason } : {}),
  }));

  const selectedToolIds = candidates
    .filter((candidate) => (candidate.finalScore ?? candidate.score) >= selectedMinScore)
    .slice(0, selectedTopK)
    .map((candidate) => candidate.toolId);

  return {
    query: input.query,
    source,
    exposureReasons: candidateResolution.retrievalError
      ? [
          ...candidateResolution.toolExposure.reason,
          `Local embedding capability is unavailable for intent recall: ${candidateResolution.retrievalError}`,
        ]
      : candidateResolution.toolExposure.reason,
    blockedCapabilityIds: candidateResolution.toolExposure.blockedCapabilityIds,
    toolExposure: {
      exposedToolIds: candidateResolution.toolExposure.exposedToolIds,
      exposedDefinitions: candidateResolution.toolExposure.exposedDefinitions.map((definition) => ({
        id: definition.id,
        title: definition.title,
        description: definition.description,
        domain: definition.domain,
        source: definition.source,
        mode: definition.mode,
        tags: definition.tags,
      })),
      reason: candidateResolution.toolExposure.reason,
      blockedCapabilityIds: candidateResolution.toolExposure.blockedCapabilityIds,
    },
    toolCandidates: candidateResolution.toolCandidates.map((candidate) => ({
      toolId: candidate.toolId,
      title: candidate.title,
      description: candidate.description,
      domain: candidate.domain,
      source: candidate.source,
      tags: candidate.tags,
      score: candidate.score,
      embeddingScore: candidate.embeddingScore,
      ruleScore: candidate.ruleScore,
      rerankScore: candidate.rerankScore,
      finalScore: candidate.finalScore,
      ...(candidate.reason ? { reason: candidate.reason } : {}),
      ...(candidate.actionProfileId
        ? {
            actionProfileId: candidate.actionProfileId,
            actionProfileTitle: candidate.actionProfileTitle,
            actionProfileDescription: candidate.actionProfileDescription,
          }
        : {}),
      ...(candidate.preferredForQuery === true ? { preferredForQuery: true } : {}),
    })),
    ...(candidateResolution.retrievalModel
      ? { retrievalModel: candidateResolution.retrievalModel }
      : {}),
    ...(candidateResolution.retrievalError
      ? { retrievalError: candidateResolution.retrievalError }
      : {}),
    ...(candidateResolution.rerankModel
      ? { rerankModel: candidateResolution.rerankModel }
      : {}),
    profiles: profiles.map((profile) => ({
      capabilityId: profile.id,
      preferredToolId: profile.preferredToolId,
      supportingToolIds: profile.supportingToolIds,
      ...(profile.actionProfileId
        ? {
            actionProfileId: profile.actionProfileId,
            actionProfileTitle: profile.actionProfileTitle,
            actionProfileDescription: profile.actionProfileDescription,
          }
        : {}),
      title: profile.title,
      description: profile.description,
      domain: profile.domain,
      source: profile.source,
      tags: profile.tags,
    })),
    actionProfiles: actionProfiles.map((profile) => ({
      actionProfileId: profile.id,
      runtimeToolId: profile.runtimeToolId,
      title: profile.title,
      description: profile.description,
      domain: profile.domain,
      source: profile.source,
      tags: profile.tags,
    })),
    candidates,
    selectedToolIds,
  };
};
