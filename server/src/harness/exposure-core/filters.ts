import type { McpToolDefinition } from "../../mcp/core/definitions.js";
import type { HarnessExposurePolicyInput } from "./types.js";

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

export const isInternalIntentOnlyTool = (definition: McpToolDefinition) =>
  definition.source === "internal" && INTERNAL_READ_PRIMITIVE_TOOL_IDS.has(definition.id);

export const isInternalEditCompatibilityTool = (definition: McpToolDefinition) =>
  definition.source === "internal" && INTERNAL_EDIT_COMPAT_TOOL_IDS.has(definition.id);

export const shouldIncludeDefinition = (
  definition: McpToolDefinition,
  input: HarnessExposurePolicyInput,
) => !getDefinitionBlockReason(definition, input);

export const getDefinitionBlockReason = (
  definition: McpToolDefinition,
  input?: HarnessExposurePolicyInput,
): string | undefined => {
  // These are implementation/compatibility primitives, not public Agent tools.
  if (isInternalIntentOnlyTool(definition)) {
    return "Internal read primitive is not part of the public Read contract.";
  }

  if (isInternalEditCompatibilityTool(definition)) {
    return "Legacy edit wrapper is not part of the public Edit contract.";
  }

  // A runtime boundary (for example an active Skill) may narrow the already
  // public surface. It never overrides the normal Harness visibility rules.
  if (input?.allowedToolIds && !input.allowedToolIds.includes(definition.id)) {
    return "Capability is outside the caller-provided runtime tool boundary.";
  }

  // External MCP exposure follows the user's explicit Agent Access switch only.
  // Harness does not apply semantic, domain, sandbox, browser, or terminal heuristics.
  if (definition.source === "external") {
    if (!input?.allowExternal || !input.allowedExternalToolIds?.includes(definition.id)) {
      return "External MCP capability is not explicitly enabled for Agent access.";
    }
  }

  return undefined;
};
