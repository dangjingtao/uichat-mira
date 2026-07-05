import { buildContextReadPlanResult } from "./builder.js";
import { normalizeContextReadBudget } from "./budget.js";
import type {
  ContextReadDecisionReason,
  ContextReadPlan,
  ContextReadPlannerInput,
  ContextReadPlanResult,
} from "./contract.js";

const DIRECTORY_INTENT_PATTERN =
  /\b(list|ls|dir|tree|folder|directory|files?)\b|目录|文件夹|列出|看看.*目录|有哪些文件/u;
const INSPECT_INTENT_PATTERN =
  /\b(inspect|understand|analyze|analyse|review|trace|check|explain|module|flow|implementation)\b|检查|理解|分析|看看.*实现|模块|调用链|流程/u;
const LOCATE_INTENT_PATTERN =
  /\b(find|locate|search|grep|keyword|match|where|lookup)\b|查找|定位|搜索|关键词|匹配|哪里|哪儿/u;
const PATH_PATTERN =
  /([A-Za-z]:[\\/][^\s"'`]+|[.~]?[\\/][^\s"'`]+|[\w.-]+(?:[\\/][\w .-]+)+|\b[\w.-]+\.[A-Za-z0-9_-]+\b)/u;

const normalizeQuery = (query: string): string => query.trim().replace(/\s+/g, " ");

const extractPath = (query: string, explicitPath?: string): string | undefined => {
  const normalizedPath = explicitPath?.trim();
  if (normalizedPath) {
    return normalizedPath;
  }

  const match = query.match(PATH_PATTERN);
  return match?.[1]?.trim();
};

const looksLikeDirectoryPath = (path: string): boolean =>
  /[\\/]$/.test(path) || !/[.][A-Za-z0-9_-]+$/.test(path);

const hasDirectoryIntent = (query: string, path?: string): boolean =>
  DIRECTORY_INTENT_PATTERN.test(query) || (Boolean(path) && looksLikeDirectoryPath(path as string));

const hasInspectIntent = (query: string): boolean => INSPECT_INTENT_PATTERN.test(query);

const hasLocateIntent = (query: string): boolean => LOCATE_INTENT_PATTERN.test(query);

const buildOpenPlan = (path: string): ContextReadPlan => ({ kind: "open", path });

const buildListPlan = (path: string, maxDepth: number): ContextReadPlan => ({
  kind: "list",
  path,
  maxDepth,
});

const buildLocatePlan = (query: string, maxFiles: number): ContextReadPlan => ({
  kind: "locate",
  query,
  maxFiles,
});

const buildInspectPlan = (
  query: string,
  maxFiles: number,
  maxChars: number,
): ContextReadPlan => ({
  kind: "inspect",
  query,
  maxFiles,
  maxChars,
});

export const planContextRead = (input: ContextReadPlannerInput): ContextReadPlanResult => {
  const budget = normalizeContextReadBudget(input.budget);
  const normalizedQuery = normalizeQuery(input.query);
  const inferredPath = extractPath(normalizedQuery, input.path);
  const reasons: ContextReadDecisionReason[] = [];

  if (inferredPath && hasDirectoryIntent(normalizedQuery, inferredPath)) {
    reasons.push({
      code: "directory_intent",
      message: "Detected directory intent, so the planner selected list for bounded discovery.",
    });
    if (input.path || inferredPath) {
      reasons.push({
        code: "explicit_path",
        message: `Using path target ${JSON.stringify(inferredPath)} for directory listing.`,
      });
    }

    return buildContextReadPlanResult({
      plan: buildListPlan(inferredPath, budget.maxDepth),
      budget,
      normalizedQuery,
      inferredPath,
      reasons,
    });
  }

  if (inferredPath) {
    reasons.push({
      code: "explicit_path",
      message: `Detected an explicit path target ${JSON.stringify(inferredPath)}, so the planner selected open.`,
    });

    return buildContextReadPlanResult({
      plan: buildOpenPlan(inferredPath),
      budget,
      normalizedQuery,
      inferredPath,
      reasons,
    });
  }

  if (hasInspectIntent(normalizedQuery)) {
    reasons.push({
      code: "inspect_intent",
      message: "Detected inspect or understanding intent, so the planner selected inspect.",
    });

    return buildContextReadPlanResult({
      plan: buildInspectPlan(normalizedQuery, budget.maxFiles, budget.maxChars),
      budget,
      normalizedQuery,
      reasons,
    });
  }

  if (hasLocateIntent(normalizedQuery)) {
    reasons.push({
      code: "fuzzy_lookup",
      message: "Detected fuzzy lookup intent without a stable path target, so the planner selected locate.",
    });

    return buildContextReadPlanResult({
      plan: buildLocatePlan(normalizedQuery, budget.maxFiles),
      budget,
      normalizedQuery,
      reasons,
    });
  }

  reasons.push({
    code: "default_locate",
    message: "No explicit path or inspect intent was detected, so the planner defaulted to locate.",
  });

  return buildContextReadPlanResult({
    plan: buildLocatePlan(normalizedQuery, budget.maxFiles),
    budget,
    normalizedQuery,
    reasons,
  });
};
