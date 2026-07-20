import type { McpToolDefinition } from "../../mcp/core/definitions.js";
import type { HarnessExposurePolicyInput } from "./types.js";

const SAFE_CHAT_DOMAINS = new Set(["read", "web_search"]);
const INTERNAL_READ_PRIMITIVE_TOOL_IDS = new Set([
  "read",
  "read_list",
  "read_locate",
  "read_extract",
  "read_slice",
]);
const INTERNAL_EDIT_COMPAT_TOOL_IDS = new Set([
  "edit_file",
  "workspace_mutation",
]);

const COMPUTER_USE_TOOL_IDS = new Set([
  "browser_observe",
  "browser_act",
  "browser_assert",
]);

export const isInternalIntentOnlyTool = (definition: McpToolDefinition) =>
  definition.source === "internal" &&
  (INTERNAL_READ_PRIMITIVE_TOOL_IDS.has(definition.id) ||
    INTERNAL_EDIT_COMPAT_TOOL_IDS.has(definition.id));

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
) => !getDefinitionBlockReason(definition, input);

export const getDefinitionBlockReason = (
  definition: McpToolDefinition,
  input: HarnessExposurePolicyInput,
): string | undefined => {
  if (input.source === "chat_surface" && definition.source === "external") {
    return "External MCP capabilities are hidden from chat_surface.";
  }

  if (definition.source === "external") {
    if (!input.allowExternal) {
      return "External MCP capabilities are disabled for this exposure request.";
    }
    if (!input.allowedExternalToolIds?.includes(definition.id)) {
      return "External capability is not in the explicit eligible allowlist.";
    }
  }

  if (input.source === "chat_surface" && !isSafeChatSurfaceTool(definition)) {
    return "Capability is outside the chat_surface safe domain policy.";
  }

  if (input.source === "agent_intent" && COMPUTER_USE_TOOL_IDS.has(definition.id)) {
    if (!definition.capabilities.networkAccess) {
      return "Computer Use requires network access metadata for agent_intent exposure.";
    }
  }

  if (
    (input.source === "agent_intent" || input.source === "chat_surface") &&
    !isSandboxAvailableForDefinition(definition, input)
  ) {
    return "Sandbox-required capability is unavailable for this exposure request.";
  }

  if (!shouldExposeTerminalForAgentIntent(definition, input)) {
    return "Terminal capability is not eligible for agent_intent exposure.";
  }

  if (input.source === "agent_intent" && isInternalIntentOnlyTool(definition)) {
    return "Internal compatibility primitive is hidden behind the public tool contract.";
  }

  return undefined;
};
