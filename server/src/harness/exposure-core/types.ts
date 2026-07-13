import type { McpSandboxProfile, McpToolDefinition } from "../../mcp/core/definitions.js";
import type { HarnessTurnSource } from "../shared/types.js";

export type HarnessExposureSource = HarnessTurnSource;

export interface HarnessExposurePolicyInput {
  source: HarnessExposureSource;
  query?: string;
  allowExternal?: boolean;
  allowedExternalToolIds?: string[];
  sandboxProfiles?: Partial<Record<McpSandboxProfile, boolean>>;
}

export interface HarnessExposureDecision {
  exposedToolIds: string[];
  exposedDefinitions: McpToolDefinition[];
  reason: string[];
  visibleDefinitions: McpToolDefinition[];
  blockedCapabilityIds: string[];
  reasons: string[];
  blockedCapabilityReasons: Record<string, string>;
}

export type HarnessToolExposureResult = HarnessExposureDecision;
