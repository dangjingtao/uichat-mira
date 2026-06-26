import type { McpToolDefinition } from "@/mcp/core/definitions.js";
import { listCapabilityDefinitions } from "@/mcp/harness/registry.js";

export interface ChatToolSurfaceDefinition {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  tags: string[];
  domain: McpToolDefinition["domain"];
  mode: McpToolDefinition["mode"];
}

export interface ResolveChatToolSurfaceInput {
  allowlist?: string[];
  maxTools?: number;
}

const DEFAULT_CHAT_TOOL_ALLOWLIST = ["web_search"] as const;
const DEFAULT_MAX_CHAT_TOOLS = 8;

const toChatToolSurfaceDefinition = (
  definition: McpToolDefinition,
): ChatToolSurfaceDefinition => ({
  id: definition.id,
  name: definition.id,
  description: definition.description,
  inputSchema: definition.inputSchema,
  tags: definition.tags,
  domain: definition.domain,
  mode: definition.mode,
});

/**
 * Resolves the model-visible chat tool surface from the Harness registry.
 *
 * Important:
 * - This resolver is intentionally narrow for Phase 1.
 * - It does not execute tools.
 * - It only exposes explicitly allowlisted capabilities.
 * - It filters out approval-heavy / destructive tools by default via allowlist.
 */
export const resolveChatToolSurface = (
  input: ResolveChatToolSurfaceInput = {},
): ChatToolSurfaceDefinition[] => {
  const allowlist = new Set(input.allowlist ?? DEFAULT_CHAT_TOOL_ALLOWLIST);
  const maxTools = Math.max(1, input.maxTools ?? DEFAULT_MAX_CHAT_TOOLS);

  return listCapabilityDefinitions()
    .filter((definition) => allowlist.has(definition.id))
    .slice(0, maxTools)
    .map(toChatToolSurfaceDefinition);
};

export const __chatToolSurfaceTestUtils = {
  DEFAULT_CHAT_TOOL_ALLOWLIST,
  DEFAULT_MAX_CHAT_TOOLS,
};
