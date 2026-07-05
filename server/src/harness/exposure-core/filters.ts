import type { McpToolDefinition } from "../../mcp/core/definitions.js";
import {
  SAFE_CHAT_DOMAINS,
  querySuggestsWebSearch,
  querySuggestsWorkspaceRead,
} from "./intent-hints.js";
import type { HarnessExposurePolicyInput } from "./types.js";

const INTERNAL_INTENT_ONLY_TOOL_IDS = new Set(["read", "read_slice"]);

export const shouldExposeWebSearchForQuery = (query: string | undefined) => {
  if (!query?.trim()) {
    return true;
  }

  if (querySuggestsWorkspaceRead(query)) {
    return false;
  }

  return querySuggestsWebSearch(query);
};

export const shouldHideWebSearchForWorkspaceLocalAgentIntent = (
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

export const isInternalIntentOnlyTool = (definition: McpToolDefinition) =>
  definition.source === "internal" && INTERNAL_INTENT_ONLY_TOOL_IDS.has(definition.id);

export const isSafeChatSurfaceTool = (definition: McpToolDefinition) =>
  SAFE_CHAT_DOMAINS.has(definition.domain);

export const shouldIncludeDefinition = (
  definition: McpToolDefinition,
  input: HarnessExposurePolicyInput,
) => {
  if (!input.allowExternal && definition.source === "external") {
    return false;
  }

  if (input.source === "chat_surface" && definition.source === "external") {
    return false;
  }

  if (input.source === "chat_surface" && !isSafeChatSurfaceTool(definition)) {
    return false;
  }

  if (
    (input.source === "agent_intent" || input.source === "chat_surface") &&
    isInternalIntentOnlyTool(definition)
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
