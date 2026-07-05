import type { McpToolDefinition } from "../core/definitions.js";
import { listCapabilityDefinitions } from "./registry.js";

export type HarnessExposureSource =
  | "tools_list"
  | "agent_intent"
  | "chat_surface";

export interface HarnessExposurePolicyInput {
  source: HarnessExposureSource;
  query?: string;
  allowExternal?: boolean;
}

export interface HarnessExposureDecision {
  exposedToolIds: string[];
  exposedDefinitions: McpToolDefinition[];
  reason: string[];
  visibleDefinitions: McpToolDefinition[];
  blockedCapabilityIds: string[];
  reasons: string[];
}

const SAFE_CHAT_DOMAINS = new Set<McpToolDefinition["domain"]>([
  "read",
  "web_search",
]);

const INTERNAL_INTENT_ONLY_TOOL_IDS = new Set(["read", "read_slice"]);

const normalizeQuery = (value: string | undefined) => value?.trim().toLowerCase() ?? "";

const GREETING_TOKENS = new Set([
  "hi",
  "hello",
  "hey",
  "yo",
  "你好",
  "您好",
  "嗨",
  "哈喽",
]);

const SMALL_TALK_TOKENS = new Set([
  "thanks",
  "thank you",
  "谢谢",
  "谢了",
  "ok",
  "okay",
]);

const isLowIntentGreeting = (query: string) => {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return false;
  }

  if (GREETING_TOKENS.has(normalized) || SMALL_TALK_TOKENS.has(normalized)) {
    return true;
  }

  const compact = normalized.replace(/[!,.?。，！？\s]+/g, " ").trim();
  if (!compact) {
    return false;
  }

  const tokens = compact.split(" ").filter(Boolean);
  if (tokens.length === 0 || tokens.length > 3) {
    return false;
  }

  return tokens.every((token) => GREETING_TOKENS.has(token) || SMALL_TALK_TOKENS.has(token));
};

const WORKSPACE_READ_HINTS = [
  "workspace",
  "工作区",
  "工作空间",
  "file",
  "files",
  "folder",
  "folders",
  "directory",
  "directories",
  "path",
  "paths",
  "read_list",
  "read_locate",
  "read_open",
  "文件",
  "文件夹",
  "目录",
  "路径",
  "列出",
  "看看",
] as const;

const WEB_SEARCH_INTENT_HINTS = [
  "今天",
  "当前",
  "现在",
  "实时",
  "最新",
  "联网",
  "日期",
  "时间",
  "news",
  "latest",
  "current",
  "today",
  "weather",
  "price",
] as const;

const DIRECTORY_LISTING_HINTS = [
  "folder",
  "folders",
  "directory",
  "directories",
  "list",
  "listing",
  "tree",
  "文件夹",
  "目录",
  "列出",
  "下面有",
  "有哪些",
] as const;

const querySuggestsWorkspaceRead = (query: string | undefined) => {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return false;
  }

  return WORKSPACE_READ_HINTS.some((token) => normalized.includes(token));
};

const querySuggestsWebSearch = (query: string | undefined) => {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return false;
  }

  return WEB_SEARCH_INTENT_HINTS.some((token) => normalized.includes(token));
};

const querySuggestsDirectoryListing = (query: string | undefined) => {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return false;
  }

  return DIRECTORY_LISTING_HINTS.some((token) => normalized.includes(token));
};

const shouldExposeWebSearchForQuery = (query: string | undefined) => {
  if (!query?.trim()) {
    return true;
  }

  if (querySuggestsWorkspaceRead(query)) {
    return false;
  }

  return querySuggestsWebSearch(query);
};

const shouldHideWebSearchForWorkspaceLocalAgentIntent = (
  input: HarnessExposurePolicyInput,
) => {
  if (input.source !== "agent_intent") {
    return false;
  }

  if (!querySuggestsWorkspaceRead(input.query)) {
    return false;
  }

  if (querySuggestsWebSearch(input.query)) {
    return false;
  }

  return true;
};

const shouldIncludeDefinition = (
  definition: McpToolDefinition,
  input: HarnessExposurePolicyInput,
) => {
  if (!input.allowExternal && definition.source === "external") {
    return false;
  }

  if (input.source === "chat_surface" && definition.source === "external") {
    return false;
  }

  if (input.source === "chat_surface" && !SAFE_CHAT_DOMAINS.has(definition.domain)) {
    return false;
  }

  if (
    (input.source === "agent_intent" || input.source === "chat_surface") &&
    definition.source === "internal" &&
    INTERNAL_INTENT_ONLY_TOOL_IDS.has(definition.id)
  ) {
    return false;
  }

  if (
    (input.source === "chat_surface" || shouldHideWebSearchForWorkspaceLocalAgentIntent(input)) &&
    definition.id === "web_search" &&
    !shouldExposeWebSearchForQuery(input.query)
  ) {
    return false;
  }

  return true;
};

const applyExposureSchema = (
  definition: McpToolDefinition,
  source: HarnessExposureSource,
): McpToolDefinition => {
  const exposedInputSchema = definition.inputSchemaByExposure?.[source];
  if (!exposedInputSchema) {
    return definition;
  }

  return {
    ...definition,
    inputSchema: exposedInputSchema,
  };
};

export const resolveHarnessToolExposure = (
  input: HarnessExposurePolicyInput,
): HarnessExposureDecision => {
  const definitions = listCapabilityDefinitions();
  const blockedCapabilityIds: string[] = [];
  const reasons: string[] = [];

  if (input.source === "agent_intent" && isLowIntentGreeting(input.query ?? "")) {
    return {
      exposedToolIds: [],
      exposedDefinitions: [],
      reason: ["Greeting or low-intent input should stay in pure conversation mode."],
      visibleDefinitions: [],
      blockedCapabilityIds: definitions.map((definition) => definition.id),
      reasons: ["Greeting or low-intent input should stay in pure conversation mode."],
    };
  }

  const visibleDefinitions = definitions
    .filter((definition) => {
      const allowed = shouldIncludeDefinition(definition, input);
      if (!allowed) {
        blockedCapabilityIds.push(definition.id);
      }
      return allowed;
    })
    .map((definition) => applyExposureSchema(definition, input.source));

  if (input.source === "chat_surface") {
    reasons.push("Chat-visible tool surface is restricted to safe built-in domains.");
  }
  if (shouldHideWebSearchForWorkspaceLocalAgentIntent(input)) {
    reasons.push(
      "Workspace-local query hides web_search for agent_intent; local read evidence should be preferred.",
    );
  }
  if (!input.allowExternal) {
    reasons.push("External MCP capabilities are hidden unless explicitly enabled.");
  }

  return {
    exposedToolIds: visibleDefinitions.map((definition) => definition.id),
    exposedDefinitions: visibleDefinitions,
    reason: reasons,
    visibleDefinitions,
    blockedCapabilityIds,
    reasons,
  };
};

export const __exposureTestUtils = {
  isLowIntentGreeting,
  querySuggestsWorkspaceRead,
  querySuggestsWebSearch,
  querySuggestsDirectoryListing,
  shouldExposeWebSearchForQuery,
  shouldHideWebSearchForWorkspaceLocalAgentIntent,
};
