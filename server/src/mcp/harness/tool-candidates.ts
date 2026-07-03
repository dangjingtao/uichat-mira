import type { McpToolDefinition } from "../core/definitions.js";
import { resolveHarnessCapabilityProfiles } from "./capability-profiles.js";
import {
  resolveHarnessToolExposure,
  type HarnessExposurePolicyInput,
} from "./exposure.js";
import { executeLocalEmbedding } from "@/services/internal-capabilities/local-embedding.js";
import { executeLocalRerank } from "@/services/internal-capabilities/local-rerank.js";
import { toCapabilityIntentDocuments } from "@/agent/intent/capability-documents.js";

export interface HarnessCapabilityMatch {
  capabilityId: string;
  score: number;
  embeddingScore: number;
  ruleScore: number;
  rerankScore: number;
  finalScore: number;
  reason?: string;
  candidateToolIds: string[];
  preferredToolId?: string;
}

export interface HarnessToolCandidate {
  toolId: string;
  title: string;
  description: string;
  domain: McpToolDefinition["domain"];
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
}

export interface HarnessToolExposure {
  exposedToolIds: string[];
  exposedDefinitions: McpToolDefinition[];
  reason: string[];
  blockedCapabilityIds: string[];
}

export interface ResolveHarnessToolCandidatesForTurnInput {
  query: string;
  source?: HarnessExposurePolicyInput["source"];
  maxTools?: number;
  topK?: number;
  minScore?: number;
}

export interface ResolveHarnessToolCandidatesForTurnResult {
  query: string;
  source: HarnessExposurePolicyInput["source"];
  toolCandidates: HarnessToolCandidate[];
  toolExposure: HarnessToolExposure;
  retrievalError?: string;
  retrievalModel?: {
    provider?: string;
    model?: string;
    modelConfigId?: string;
  };
  rerankModel?: {
    model?: string;
    modelConfigId?: string;
  };
}

const DEFAULT_TOP_K = 10;
const DEFAULT_MIN_SCORE = 0.15;
const DEFAULT_MAX_TOOLS = 8;

const normalizeQueryText = (value: string) => value.trim().toLowerCase();

const tokenize = (value: string) =>
  normalizeQueryText(value)
    .split(/[\s,.;:!?，。；：！？/\\()\-_\[\]{}]+/g)
    .map((token) => token.trim())
    .filter(Boolean);

const RULE_HINTS: Record<string, string[]> = {
  workspace_lookup: [
    "file",
    "files",
    "folder",
    "directory",
    "read",
    "open",
    "locate",
    "find",
    "文档",
    "文件",
    "文件夹",
    "目录",
    "打开",
    "查找",
    "定位",
    "列出",
    "看看",
  ],
  workspace_edit: ["edit", "write", "replace", "modify", "patch", "修改", "编辑", "写入", "替换"],
  web_research: ["latest", "current", "news", "web", "search", "today", "最新", "当前", "搜索", "联网"],
  terminal_execution: ["terminal", "command", "shell", "run", "cmd", "powershell", "命令", "终端", "执行"],
};

const computeRuleScore = (input: {
  query: string;
  capabilityId: string;
  title: string;
  tags: string[];
  domain: string;
}) => {
  const query = normalizeQueryText(input.query);
  if (!query) {
    return 0;
  }

  const queryTokens = new Set(tokenize(query));
  const surfaceTokens = new Set([
    ...tokenize(input.title),
    ...input.tags.flatMap((tag) => tokenize(tag)),
    ...tokenize(input.domain),
    ...(RULE_HINTS[input.capabilityId] ?? []),
  ]);

  let score = 0;
  for (const token of queryTokens) {
    if (surfaceTokens.has(token)) {
      score += 0.18;
    }
  }

  if (query.includes("最新") || query.includes("current") || query.includes("today")) {
    if (input.domain === "web_search" || input.capabilityId === "web_research") {
      score += 0.2;
    }
  }

  if (query.includes("文件") || query.includes("readme") || query.includes("workspace")) {
    if (input.domain === "read") {
      score += 0.15;
    }
  }

  if (
    query.includes("文件夹") ||
    query.includes("目录") ||
    query.includes("folder") ||
    query.includes("directory")
  ) {
    if (input.domain === "read") {
      score += 0.22;
    }
  }

  if (query.includes("修改") || query.includes("edit") || query.includes("patch")) {
    if (input.domain === "edit") {
      score += 0.2;
    }
  }

  return Math.max(0, Math.min(score, 1));
};

const magnitude = (vector: number[]) =>
  Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

const cosineSimilarity = (left: number[], right: number[]) => {
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

const toReason = (input: {
  title: string;
  embeddingScore: number;
  ruleScore: number;
  rerankScore: number;
  finalScore: number;
}) =>
  [
    `matched ${input.title}`,
    `final=${input.finalScore.toFixed(4)}`,
    `embedding=${input.embeddingScore.toFixed(4)}`,
    `rule=${input.ruleScore.toFixed(4)}`,
    `rerank=${input.rerankScore.toFixed(4)}`,
  ].join("; ");

const toToolCandidates = (input: {
  query: string;
  matches: Array<{
    capabilityId: string;
    title: string;
    embeddingScore: number;
    ruleScore: number;
    rerankScore: number;
    finalScore: number;
    candidateToolIds: string[];
    preferredToolId?: string;
  }>;
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
  });
  const exposedDefinitions = exposureDecision.exposedDefinitions.slice(0, maxTools);
  const profiles = resolveHarnessCapabilityProfiles(exposedDefinitions);
  const toolExposure: HarnessToolExposure = {
    exposedToolIds: exposedDefinitions.map((definition) => definition.id),
    exposedDefinitions: exposedDefinitions,
    reason: exposureDecision.reason,
    blockedCapabilityIds: exposureDecision.blockedCapabilityIds,
  };

  if (!input.query.trim() || profiles.length === 0) {
    return {
      query: input.query,
      source,
      toolCandidates: [],
      toolExposure,
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

  let matches = documents
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
        embeddingScore,
        ruleScore,
        rerankScore: 0,
        finalScore: score,
        candidateToolIds: profile.supportingToolIds,
        preferredToolId: profile.preferredToolId,
      };
    })
    .filter(
      (
        match,
      ): match is NonNullable<typeof match> =>
        match !== null && match.finalScore >= minScore,
    )
    .sort((left, right) => right.finalScore - left.finalScore)
    .slice(0, topK);

  let rerankModel:
    | {
        model?: string;
        modelConfigId?: string;
      }
    | undefined;

  if (matches.length > 0) {
    try {
      const rerankResult = await executeLocalRerank({
        query: input.query,
        topN: matches.length,
        candidates: matches.map((match) => ({
          id: match.capabilityId,
          text: [
            match.title,
            match.candidateToolIds.join(" "),
          ]
            .filter(Boolean)
            .join("\n"),
        })),
      });

      rerankModel = {
        model: rerankResult.rerankModel,
        modelConfigId: rerankResult.rerankModelConfigId,
      };

      const rerankMap = new Map(
        (rerankResult.rerankedCandidates ?? []).map((candidate) => [
          candidate.id,
          candidate.probability,
        ]),
      );

      matches = matches
        .map((match) => {
          const rerankScore = rerankMap.get(match.capabilityId) ?? 0;
          const finalScore =
            queryEmbedding && documentEmbeddings.length > 0
              ? match.embeddingScore * 0.65 +
                match.ruleScore * 0.15 +
                rerankScore * 0.2
              : match.ruleScore * 0.4 + rerankScore * 0.6;

          return {
            ...match,
            rerankScore,
            finalScore,
          };
        })
        .sort((left, right) => right.finalScore - left.finalScore);
    } catch {
      // Keep pre-rerank order when local rerank is unavailable.
    }
  }

  return {
    query: input.query,
    source,
    toolCandidates: toToolCandidates({
      query: input.query,
      matches,
      definitions: exposedDefinitions,
    }),
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
