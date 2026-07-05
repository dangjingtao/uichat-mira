import type { McpToolDefinition } from "../../mcp/core/definitions.js";
import { resolveHarnessCapabilityProfiles } from "../profiles/index.js";
import { toReason } from "./scoring.js";
import type { HarnessToolCandidate, ResolvedHarnessCapabilityMatch } from "./types.js";

export const expandHarnessToolCandidates = (input: {
  matches: ResolvedHarnessCapabilityMatch[];
  definitions: McpToolDefinition[];
}) => {
  const definitionMap = new Map(input.definitions.map((definition) => [definition.id, definition]));
  const profiles = resolveHarnessCapabilityProfiles(input.definitions);
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const candidates: HarnessToolCandidate[] = [];

  for (const match of input.matches) {
    const profile = profileMap.get(match.capabilityId);
    const preferredToolId = match.preferredToolId ?? profile?.preferredToolId;
    const reason = toReason({
      title: match.title,
      embeddingScore: match.embeddingScore,
      ruleScore: match.ruleScore,
      rerankScore: match.rerankScore,
      finalScore: match.finalScore,
    });

    for (const toolId of match.candidateToolIds) {
      const definition = definitionMap.get(toolId);
      if (!definition) {
        continue;
      }

      candidates.push({
        toolId,
        title: definition.title,
        description: definition.description,
        domain: definition.domain,
        source: definition.source,
        tags: definition.tags,
        score: match.finalScore,
        embeddingScore: match.embeddingScore,
        ruleScore: match.ruleScore,
        rerankScore: match.rerankScore,
        finalScore: match.finalScore,
        reason,
        ...(profile?.actionProfileId
          ? {
              actionProfileId: profile.actionProfileId,
              actionProfileTitle: profile.actionProfileTitle,
              actionProfileDescription: profile.actionProfileDescription,
            }
          : {}),
        ...(preferredToolId === toolId ? { preferredForQuery: true } : {}),
      });
    }
  }

  return candidates;
};
