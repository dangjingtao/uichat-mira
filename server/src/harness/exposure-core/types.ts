import type { McpSandboxProfile, McpToolDefinition } from "../../mcp/core/definitions.js";
import type { HarnessTurnSource } from "../shared/types.js";

export type HarnessExposureSource = HarnessTurnSource;

export interface HarnessExposurePolicyInput {
  source: HarnessExposureSource;
  query?: string;
  allowExternal?: boolean;
  allowedExternalToolIds?: string[];
  /**
   * Optional caller-owned upper bound for the public tool surface.
   * It may only narrow tools already eligible under Harness policy; it never
   * makes an otherwise hidden capability public.
   */
  allowedToolIds?: string[];
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
