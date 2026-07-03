import { resolveHarnessCapabilityProfiles } from "./capability-profiles.js";
import { resolveHarnessActionProfiles } from "./action-profiles.js";
import { resolveHarnessToolExposure } from "./exposure.js";
import { executeLocalEmbedding } from "@/services/internal-capabilities/local-embedding.js";
import { executeLocalRerank } from "@/services/internal-capabilities/local-rerank.js";
import { toCapabilityIntentDocuments } from "@/agent/intent/capability-documents.js";
import type { CapabilityIntentCandidate } from "@/agent/intent/types.js";

export interface HarnessCapabilityDiagnosticsInput {
  query: string;
  source?: "tools_list" | "agent_intent" | "chat_surface";
  topK?: number;
  minScore?: number;
  selectedTopK?: number;
  selectedMinScore?: number;
}

export interface HarnessCapabilityDiagnosticsResult {
  query: string;
  source: "tools_list" | "agent_intent" | "chat_surface";
  exposureReasons: string[];
  blockedCapabilityIds: string[];
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
  candidates: CapabilityIntentCandidate[];
  selectedCapabilityIds: string[];
}

const DEFAULT_TOP_K = 10;
const DEFAULT_MIN_SCORE = 0.15;
const DEFAULT_SELECTED_TOP_K = 1;
const DEFAULT_SELECTED_MIN_SCORE = 0.3;

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

export const resolveHarnessCapabilityDiagnostics = async (
  input: HarnessCapabilityDiagnosticsInput,
): Promise<HarnessCapabilityDiagnosticsResult> => {
  const source = input.source ?? "agent_intent";
  const topK = Math.max(1, input.topK ?? DEFAULT_TOP_K);
  const minScore = input.minScore ?? DEFAULT_MIN_SCORE;
  const selectedTopK = Math.max(0, input.selectedTopK ?? DEFAULT_SELECTED_TOP_K);
  const selectedMinScore = input.selectedMinScore ?? DEFAULT_SELECTED_MIN_SCORE;

  const exposure = resolveHarnessToolExposure({
    source,
    query: input.query,
  });
  const profiles = resolveHarnessCapabilityProfiles(exposure.visibleDefinitions);
  const actionProfiles = resolveHarnessActionProfiles(exposure.visibleDefinitions);

  if (!input.query.trim() || profiles.length === 0) {
    return {
      query: input.query,
      source,
      exposureReasons: exposure.reasons,
      blockedCapabilityIds: exposure.blockedCapabilityIds,
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
      candidates: [],
      selectedCapabilityIds: [],
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

  let candidates = documents
    .map<CapabilityIntentCandidate | null>((document, index) => {
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
        preferredToolId: profile.preferredToolId,
        supportingToolIds: profile.supportingToolIds,
        source: profile.source,
        domain: profile.domain,
        tags: profile.tags,
        actionProfileId: profile.actionProfileId,
      };
    })
    .filter((candidate): candidate is CapabilityIntentCandidate => candidate !== null)
    .filter((candidate) => candidate.score >= minScore)
    .sort((left, right) => right.score - left.score)
    .slice(0, topK);

  let rerankModel:
    | {
        model?: string;
        modelConfigId?: string;
      }
    | undefined;

  if (candidates.length > 0) {
    try {
      const rerankResult = await executeLocalRerank({
        query: input.query,
        topN: candidates.length,
        candidates: candidates.map((candidate) => ({
          id: candidate.capabilityId,
          text: [
            candidate.title,
            candidate.domain,
            candidate.tags.join(" "),
            candidate.supportingToolIds.join(" "),
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

      candidates = candidates
        .map((candidate) => {
          const rerankScore = rerankMap.get(candidate.capabilityId) ?? 0;
          const finalScore =
            queryEmbedding && documentEmbeddings.length > 0
              ? candidate.embeddingScore * 0.65 +
                candidate.ruleScore * 0.15 +
                rerankScore * 0.2
              : candidate.ruleScore * 0.4 + rerankScore * 0.6;
          return {
            ...candidate,
            rerankScore,
            score: finalScore,
            finalScore,
          };
        })
        .sort((left, right) => right.finalScore! - left.finalScore!);
    } catch {
      candidates = candidates.map((candidate) => ({
        ...candidate,
        rerankScore: 0,
        finalScore: candidate.score,
      }));
    }
  }

  const selectedCapabilityIds = candidates
    .filter((candidate) => (candidate.finalScore ?? candidate.score) >= selectedMinScore)
    .slice(0, selectedTopK)
    .map((candidate) => candidate.capabilityId);

  return {
    query: input.query,
    source,
    exposureReasons: retrievalError
      ? [
          ...exposure.reasons,
          `Local embedding capability is unavailable for intent recall: ${retrievalError}`,
        ]
      : exposure.reasons,
    blockedCapabilityIds: exposure.blockedCapabilityIds,
    ...(embeddingResult
      ? {
          retrievalModel: {
            provider: "local",
            model: embeddingResult.embeddingModel,
            modelConfigId: embeddingResult.embeddingModelConfigId,
          },
        }
      : {}),
    ...(retrievalError ? { retrievalError } : {}),
    rerankModel,
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
    selectedCapabilityIds,
  };
};
