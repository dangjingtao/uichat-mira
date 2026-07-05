import type { McpToolDefinition } from "../../mcp/core/definitions.js";
import { getSandboxProfileCoverage } from "../sandbox/index.js";
import { listCapabilityDefinitions } from "../registry.js";
import {
  shouldExposeWebSearchForQuery,
  shouldHideWebSearchForWorkspaceLocalAgentIntent,
  shouldIncludeDefinition,
} from "./filters.js";
import {
  isLowIntentQuery,
  querySuggestsDirectoryListing,
  querySuggestsTerminalCommand,
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
  const sandboxCoverage = getSandboxProfileCoverage();
  const policyInput: HarnessExposurePolicyInput = {
    ...input,
    sandboxProfiles:
      input.sandboxProfiles ??
      Object.fromEntries(
        Object.entries(sandboxCoverage).map(([profile, status]) => [
          profile,
          status === "implemented",
        ]),
      ),
  };

  if (policyInput.source === "agent_intent" && isLowIntentQuery(policyInput.query ?? "")) {
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
      const allowed = shouldIncludeDefinition(definition, policyInput);
      if (!allowed) {
        blockedCapabilityIds.push(definition.id);
      }
      return allowed;
    })
    .map((definition) => applyExposureSchema(definition, policyInput.source));

  if (policyInput.source === "chat_surface") {
    reasons.push("Chat-visible tool surface is restricted to safe built-in domains.");
  }
  if (shouldHideWebSearchForWorkspaceLocalAgentIntent(policyInput)) {
    reasons.push(
      "Workspace-local query hides web_search for agent_intent; local read evidence should be preferred.",
    );
  }
  if (
    policyInput.source === "agent_intent" &&
    !querySuggestsTerminalCommand(policyInput.query) &&
    definitions.some((definition) => definition.domain === "terminal")
  ) {
    reasons.push("Terminal tools are hidden unless the turn clearly asks to run a command.");
  }
  if (
    definitions.some(
      (definition) =>
        definition.capabilities.sandboxRequired &&
        definition.capabilities.sandboxProfile &&
        policyInput.sandboxProfiles?.[definition.capabilities.sandboxProfile] !== true,
    )
  ) {
    reasons.push("Sandbox-required tools are hidden when their sandbox profile is unavailable.");
  }
  if (!policyInput.allowExternal) {
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
  querySuggestsTerminalCommand,
  shouldExposeWebSearchForQuery,
  shouldHideWebSearchForWorkspaceLocalAgentIntent,
};
