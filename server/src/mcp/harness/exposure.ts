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
  visibleDefinitions: McpToolDefinition[];
  blockedCapabilityIds: string[];
  reasons: string[];
}

const SAFE_CHAT_DOMAINS = new Set<McpToolDefinition["domain"]>([
  "read",
  "web_search",
]);

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

  return true;
};

export const resolveHarnessToolExposure = (
  input: HarnessExposurePolicyInput,
): HarnessExposureDecision => {
  const definitions = listCapabilityDefinitions();
  const blockedCapabilityIds: string[] = [];
  const reasons: string[] = [];

  if (input.source === "agent_intent" && isLowIntentGreeting(input.query ?? "")) {
    return {
      visibleDefinitions: [],
      blockedCapabilityIds: definitions.map((definition) => definition.id),
      reasons: ["Greeting or low-intent input should stay in pure conversation mode."],
    };
  }

  const visibleDefinitions = definitions.filter((definition) => {
    const allowed = shouldIncludeDefinition(definition, input);
    if (!allowed) {
      blockedCapabilityIds.push(definition.id);
    }
    return allowed;
  });

  if (input.source === "chat_surface") {
    reasons.push("Chat-visible tool surface is restricted to safe built-in domains.");
  }
  if (!input.allowExternal) {
    reasons.push("External MCP capabilities are hidden unless explicitly enabled.");
  }

  return {
    visibleDefinitions,
    blockedCapabilityIds,
    reasons,
  };
};

export const __exposureTestUtils = {
  isLowIntentGreeting,
};
