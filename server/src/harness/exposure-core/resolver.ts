import type { McpToolDefinition } from "../../mcp/core/definitions.js";
import { listCapabilityDefinitions } from "../registry.js";
import {
  shouldExposeWebSearchForQuery,
  shouldHideWebSearchForWorkspaceLocalAgentIntent,
  shouldIncludeDefinition,
} from "./filters.js";
import {
  isLowIntentQuery,
  querySuggestsDirectoryListing,
  querySuggestsWebSearch,
  querySuggestsWorkspaceRead,
} from "./intent-hints.js";
import type { HarnessExposureDecision, HarnessExposurePolicyInput, HarnessExposureSource } from "./types.js";

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

  if (input.source === "agent_intent" && isLowIntentQuery(input.query ?? "")) {
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
  isLowIntentGreeting: isLowIntentQuery,
  querySuggestsWorkspaceRead,
  querySuggestsWebSearch,
  querySuggestsDirectoryListing,
  shouldExposeWebSearchForQuery,
  shouldHideWebSearchForWorkspaceLocalAgentIntent,
};
