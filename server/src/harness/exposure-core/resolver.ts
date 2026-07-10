import type { McpToolDefinition } from "../../mcp/core/definitions.js";
import { getSandboxProfileCoverage } from "../sandbox/index.js";
import { listCapabilityDefinitions } from "../registry.js";
import {
  shouldIncludeDefinition,
} from "./filters.js";
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
};
