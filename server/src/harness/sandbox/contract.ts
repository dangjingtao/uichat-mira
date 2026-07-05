import type { McpArtifact } from "@/mcp/core/definitions.js";

export type SandboxProfile =
  | "read_only"
  | "workspace_write"
  | "command"
  | "networked_command";

export type SandboxArtifact = McpArtifact;

export interface SandboxRunRequest {
  profile: SandboxProfile;
  workspaceRoot: string;
  cwd?: string;
  command: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  outputLimitBytes?: number;
}

export interface SandboxRunResult {
  status: "completed" | "failed" | "blocked" | "timed_out";
  exitCode?: number | null;
  stdoutText: string;
  stderrText: string;
  durationMs: number;
  truncated: boolean;
  violations: string[];
  artifacts: SandboxArtifact[];
}

export type SandboxBenchCaseGroup = "positive" | "negative" | "coverage";

export type SandboxBenchCaseStatus = "passed" | "failed" | "not_implemented";

export interface SandboxBenchCaseResult {
  id: string;
  group: SandboxBenchCaseGroup;
  description: string;
  status: SandboxBenchCaseStatus;
  request: SandboxRunRequest;
  runResult?: SandboxRunResult;
  notes: string[];
}

export interface SandboxBenchReport {
  runner: "sandbox-direct-bench";
  generatedAt: string;
  workspaceRoot: string;
  contractCoverage: {
    profiles: Record<SandboxProfile, "implemented" | "not_implemented">;
  };
  summary: {
    total: number;
    passed: number;
    failed: number;
    notImplemented: number;
  };
  cases: SandboxBenchCaseResult[];
}
