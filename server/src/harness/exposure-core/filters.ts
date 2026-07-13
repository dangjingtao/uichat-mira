import type { McpToolDefinition } from "../../mcp/core/definitions.js";
import type { HarnessExposurePolicyInput } from "./types.js";

const SAFE_CHAT_DOMAINS = new Set(["read", "web_search"]);
const INTERNAL_INTENT_ONLY_TOOL_IDS = new Set([
  "read",
  "read_list",
  "read_locate",
  "read_extract",
  "read_slice",
]);

export const isInternalIntentOnlyTool = (definition: McpToolDefinition) =>
  definition.source === "internal" && INTERNAL_INTENT_ONLY_TOOL_IDS.has(definition.id);

export const isSafeChatSurfaceTool = (definition: McpToolDefinition) =>
  SAFE_CHAT_DOMAINS.has(definition.domain);

export const isSandboxAvailableForDefinition = (
  definition: McpToolDefinition,
  input: HarnessExposurePolicyInput,
) => {
  if (!definition.capabilities.sandboxRequired) {
    return true;
  }

  const profile = definition.capabilities.sandboxProfile;
  if (!profile) {
    return false;
  }

  return input.sandboxProfiles?.[profile] === true;
};

export const shouldExposeTerminalForAgentIntent = (
  definition: McpToolDefinition,
  input: HarnessExposurePolicyInput,
) => {
  if (input.source !== "agent_intent" || definition.domain !== "terminal") {
    return true;
  }

  if (definition.capabilities.requiresApproval !== true) {
    return false;
  }

  return isSandboxAvailableForDefinition(definition, input);
};

export const shouldIncludeDefinition = (
  definition: McpToolDefinition,
  input: HarnessExposurePolicyInput,
) => {
  if (definition.source === "external") {
    if (!input.allowExternal) {
      return false;
    }
    if (!input.allowedExternalToolIds?.includes(definition.id)) {
      return false;
    }
  }

  if (input.source === "chat_surface" && definition.source === "external") {
    return false;
  }

  if (input.source === "chat_surface" && !isSafeChatSurfaceTool(definition)) {
    return false;
  }

  if (
    (input.source === "agent_intent" || input.source === "chat_surface") &&
    !isSandboxAvailableForDefinition(definition, input)
  ) {
    return false;
  }

  if (!shouldExposeTerminalForAgentIntent(definition, input)) {
    return false;
  }

  if (input.source === "agent_intent" && isInternalIntentOnlyTool(definition)) {
    return false;
  }

  return true;
};
