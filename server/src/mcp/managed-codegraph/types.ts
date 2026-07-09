export type ManagedCodeGraphRuntimeStatus =
  | "unavailable"
  | "blocked"
  | "starting"
  | "ready"
  | "degraded"
  | "failed"
  | "stopped";

export type ManagedCodeGraphTelemetryStatus =
  | "verified_off"
  | "not_verified"
  | "unavailable";

export type ManagedCodeGraphHandshakeStatus =
  | "not_started"
  | "ok"
  | "failed";

export type ManagedCodeGraphStartDisposition =
  | "primary"
  | "already_running"
  | "reused_existing";

export interface ManagedCodeGraphTelemetryProbe {
  args: string[];
  disabledTokens?: string[];
}

export interface ManagedCodeGraphVersionProbe {
  args: string[];
}

export interface ManagedCodeGraphProcessManagerOptions {
  command: string;
  startArgs: string[];
  versionProbe: ManagedCodeGraphVersionProbe;
  telemetryProbe?: ManagedCodeGraphTelemetryProbe;
  env?: Record<string, string>;
  workspaceRoot: string;
  allowedWorkspaceRoot: string;
  logRoot: string;
  indexRoot: string;
  protocolVersion?: string;
  startTimeoutMs?: number;
  healthTimeoutMs?: number;
  stopTimeoutMs?: number;
  repoPollutionGuard?: ManagedCodeGraphRepoPollutionGuard;
}

export interface ManagedCodeGraphRepoPollutionGuard {
  status: "ready" | "blocked";
  repoDataDirName: string;
  blockedReason: string | null;
}

export interface ManagedCodeGraphDetectResult {
  status: ManagedCodeGraphRuntimeStatus;
  commandFound: boolean;
  providerVersion: string | null;
  telemetryStatus: ManagedCodeGraphTelemetryStatus;
  workspaceHash: string;
  workspaceAllowed: boolean;
  logRootReady: boolean;
  indexRootReady: boolean;
  reasons: string[];
}

export interface ManagedCodeGraphHealthProbe {
  providerVersion?: string;
  telemetryStatus?: string;
  workspaceHash?: string;
  indexRoot?: string;
  logRoot?: string;
  status?: string;
}

export interface ManagedCodeGraphStatusSnapshot {
  status: ManagedCodeGraphRuntimeStatus;
  providerVersion: string | null;
  telemetryStatus: ManagedCodeGraphTelemetryStatus;
  handshakeStatus: ManagedCodeGraphHandshakeStatus;
  initializedNotificationSent: boolean;
  workspaceHash: string;
  workspaceRoot: string;
  allowedWorkspaceRoot: string;
  workspaceMatches: boolean;
  logRoot: string;
  indexRoot: string;
  processAlive: boolean;
  startedAt: number | null;
  stoppedAt: number | null;
  durationMs: number | null;
  exitCode: number | null;
  lastStatus: ManagedCodeGraphRuntimeStatus | null;
  lastError: string | null;
  crashCount: number;
  startDisposition: ManagedCodeGraphStartDisposition | null;
}

export type CodebaseExploreScope =
  | "agent-runtime"
  | "harness-mcp"
  | "desktop-ui"
  | "microapps"
  | "docs"
  | "workspace-general";

export type CodebaseExploreCommand = "query" | "explore" | "affected" | "mixed";

export type CodebaseExploreResultStatus = "ok" | "partial" | "degraded";
export type CodebaseTraceStatus = "ok" | "partial" | "degraded" | "failed";

export type CodebaseCandidateKind =
  | "symbol-definition"
  | "reference"
  | "impact-edge"
  | "text-hit"
  | "file-entry"
  | "unknown";

export type CodebaseCandidateVerificationStatus =
  | "pending"
  | "verified"
  | "rejected"
  | "unverifiable";

export type CodebaseExploreLimitation =
  | "broad_query_noise_detected"
  | "requires_follow_up_read"
  | "missing_line_range"
  | "result_trimmed"
  | "query_failed"
  | "provider_unavailable"
  | "workspace_mismatch";

export interface CodebaseExploreInternalRequest {
  query: string;
  scope?: CodebaseExploreScope;
  includePaths?: string[];
  excludePaths?: string[];
  maxFiles?: number;
  maxSnippets?: number;
  maxSnippetLines?: number;
  maxTotalLines?: number;
  maxRawChars?: number;
}

export interface CodebaseExploreCandidateSource {
  engine: "codegraph";
  command: CodebaseExploreCommand;
}

export interface CodebaseExploreCandidateVerification {
  required: true;
  status: CodebaseCandidateVerificationStatus;
}

export interface CodebaseCandidate {
  path: string;
  startLine: number | null;
  endLine: number | null;
  kind: CodebaseCandidateKind;
  summary: string;
  confidence: number;
  snippet: string | null;
  source: CodebaseExploreCandidateSource;
  verification: CodebaseExploreCandidateVerification;
  limitations: CodebaseExploreLimitation[];
}

export interface CodebaseFollowUpReadPlan {
  candidateIndex: number;
  path: string;
  startLine: number | null;
  endLine: number | null;
  reason:
    | "verify_candidate_excerpt"
    | "missing_line_range"
    | "broad_scope_follow_up"
    | "provider_mismatch_check";
  toolId: "read_file_slice";
}

export interface CodebaseExploreFallbackSignal {
  required: boolean;
  reason: CodebaseExploreLimitation | "broad_scope_requery_recommended";
  suggestedChain: Array<
    "codegraph" | "scoped_search_text" | "workspace_inventory" | "read_file_slice"
  >;
}

export interface CodebaseExploreTrace {
  capabilityId: "codebase_explore";
  exposureMode?: "controlled_tool_only";
  provider: "codegraph";
  providerVersion: string | null;
  runtimeShape: "managed_mcp";
  workspaceHash: string | null;
  selectedScope: CodebaseExploreScope[];
  includePaths: string[];
  excludePaths: string[];
  originalQuery: string;
  normalizedQuery: string;
  internalCommand: CodebaseExploreCommand;
  resultCount: number;
  truncated: boolean;
  limitations: CodebaseExploreLimitation[];
  fallbackUsed: boolean;
  fallbackReason: string | null;
  verificationRequired: boolean;
  verificationReadCount: number;
  status: CodebaseTraceStatus;
  durationMs: number;
  indexStatus: string | null;
  telemetryStatus: ManagedCodeGraphTelemetryStatus;
}

export interface CodebaseExploreResult {
  status: CodebaseExploreResultStatus;
  scope: CodebaseExploreScope[];
  query: string;
  engine: "codegraph";
  command: CodebaseExploreCommand;
  includePaths: string[];
  excludePaths: string[];
  candidates: CodebaseCandidate[];
  followUpReads: CodebaseFollowUpReadPlan[];
  truncated: boolean;
  degraded: boolean;
  followUpHints: string[];
  limitations: CodebaseExploreLimitation[];
  fallbackSignal: CodebaseExploreFallbackSignal | null;
  trace: CodebaseExploreTrace;
}

export type CodebaseVerificationStatus =
  | "verified"
  | "rejected"
  | "unverifiable";

export interface CodebaseCandidateVerificationTracePointer {
  engine: "codegraph";
  command: CodebaseExploreCommand;
  candidateIndex: number;
  path: string;
}

export interface CodebaseVerifiedCandidate {
  candidateIndex: number;
  status: CodebaseVerificationStatus;
  path: string;
  verifiedPath: string | null;
  startLine: number | null;
  endLine: number | null;
  verifiedStartLine: number | null;
  verifiedEndLine: number | null;
  minimalExcerpt: string | null;
  verifiedSummary: string | null;
  providerTracePointer: CodebaseCandidateVerificationTracePointer;
  mismatchNotes: string[];
  limitations: CodebaseExploreLimitation[];
}

export interface CodebaseVerifiedEvidenceInput {
  query: string;
  chunks: Array<{
    chunkId: string;
    documentName: string;
    score: number;
    content: string;
  }>;
}

export interface CodebaseVerificationResult {
  query: string;
  scope: CodebaseExploreScope[];
  verified: CodebaseVerifiedCandidate[];
  rejected: CodebaseVerifiedCandidate[];
  unverifiable: CodebaseVerifiedCandidate[];
  verifiedEvidenceInput: CodebaseVerifiedEvidenceInput;
  trace: CodebaseExploreTrace;
}

export interface CodebaseExploreToolResult {
  capabilityId: "codebase_explore";
  plannerExposure: "controlled_tool_only";
  query: string;
  scope: CodebaseExploreScope[];
  verifiedEvidenceInput: {
    query: string;
    chunkCount: number;
    chunks: Array<{
      chunkId: string | number;
      documentName: string;
      score?: number;
      content: string;
    }>;
    summary?: unknown;
    createdAt: string;
  };
  exploreResult: {
    status: CodebaseExploreResultStatus;
    truncated: boolean;
    degraded: boolean;
    limitations: CodebaseExploreLimitation[];
    followUpHints: string[];
    fallbackSignal: CodebaseExploreFallbackSignal | null;
  };
  verificationResult: {
    verifiedCount: number;
    rejectedCount: number;
    unverifiableCount: number;
  };
  trace: {
    exposureMode: "controlled_tool_only";
    explore: CodebaseExploreTrace;
    verification: CodebaseExploreTrace;
  };
}
