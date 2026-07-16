export type SandboxProfile =
  | "read_only"
  | "workspace_write"
  | "command"
  | "networked_command";

export type SandboxV16Profile = "command";

export type SandboxFutureProfile = Exclude<SandboxProfile, SandboxV16Profile>;

export type SandboxArtifactKind = "file" | "directory" | "patch" | "log" | "report";

export type SandboxOutputEncoding = "utf8" | "gbk" | "utf16le" | "unknown";

export interface SandboxArtifactRegistration {
  path: string;
  kind?: SandboxArtifactKind;
}

export interface SandboxArtifact {
  id: string;
  kind: SandboxArtifactKind;
  path: string;
  size: number;
  mime?: string;
  createdAt: string;
}

export interface SandboxRunRequest {
  profile: SandboxProfile;
  workspaceRoot: string;
  cwd?: string;
  command: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  outputLimitBytes?: number;
  artifactRegistrations?: SandboxArtifactRegistration[];
}

export interface SandboxRunResult {
  status: "completed" | "failed" | "blocked" | "timed_out";
  exitCode?: number | null;
  stdoutText: string;
  stderrText: string;
  stdoutEncoding: SandboxOutputEncoding;
  stderrEncoding: SandboxOutputEncoding;
  durationMs: number;
  truncated: boolean;
  binaryDetected: boolean;
  violations: string[];
  artifacts: SandboxArtifact[];
}

export type SandboxBenchCaseGroup = "positive" | "negative" | "coverage";

export type SandboxBenchCaseStatus = "passed" | "failed" | "blocked";

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
    declaredProfiles: Record<SandboxProfile, "implemented" | "blocked">;
    v16GateProfiles: Record<SandboxV16Profile, "implemented" | "blocked">;
    futureProfiles: Record<SandboxFutureProfile, "blocked">;
    v16GateSatisfied: boolean;
  };
  summary: {
    total: number;
    gatePassed: number;
    gateFailed: number;
    blockedProfile: number;
  };
  cases: SandboxBenchCaseResult[];
}
