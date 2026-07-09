import type {
  CodebaseExploreCommand,
  CodebaseExploreFallbackSignal,
  CodebaseExploreLimitation,
  CodebaseExploreScope,
  CodebaseExploreTrace,
  CodebaseTraceStatus,
  ManagedCodeGraphRuntimeStatus,
  ManagedCodeGraphStatusSnapshot,
  ManagedCodeGraphTelemetryStatus,
} from "./types.js";

type TraceInput = {
  originalQuery: string;
  normalizedQuery: string;
  selectedScope: CodebaseExploreScope[];
  includePaths: string[];
  excludePaths: string[];
  internalCommand: CodebaseExploreCommand;
  resultCount: number;
  truncated: boolean;
  limitations: CodebaseExploreLimitation[];
  fallbackSignal: CodebaseExploreFallbackSignal | null;
  verificationReadCount: number;
  durationMs: number;
  status: CodebaseTraceStatus;
  runtimeStatus:
    | Pick<
        ManagedCodeGraphStatusSnapshot,
        "providerVersion" | "telemetryStatus"
      > & {
        workspaceHash: string | null;
        status: ManagedCodeGraphRuntimeStatus;
      }
    | null;
};

const toFallbackReason = (
  fallbackSignal: CodebaseExploreFallbackSignal | null,
  status: CodebaseTraceStatus,
  limitations: CodebaseExploreLimitation[],
) => {
  if (fallbackSignal?.required) {
    return fallbackSignal.reason;
  }
  if (status === "failed" || status === "degraded") {
    return limitations[0] ?? "unknown_failure";
  }
  return null;
};

const sanitizeTelemetryStatus = (
  runtimeStatus: TraceInput["runtimeStatus"],
): ManagedCodeGraphTelemetryStatus =>
  runtimeStatus?.telemetryStatus ?? "unavailable";

export const createCodebaseExploreTrace = (
  input: TraceInput,
): CodebaseExploreTrace => ({
  capabilityId: "codebase_explore",
  exposureMode: "controlled_tool_only",
  provider: "codegraph",
  providerVersion: input.runtimeStatus?.providerVersion ?? null,
  runtimeShape: "managed_mcp",
  workspaceHash: input.runtimeStatus?.workspaceHash ?? null,
  selectedScope: [...input.selectedScope],
  includePaths: [...input.includePaths],
  excludePaths: [...input.excludePaths],
  originalQuery: input.originalQuery,
  normalizedQuery: input.normalizedQuery,
  internalCommand: input.internalCommand,
  resultCount: input.resultCount,
  truncated: input.truncated,
  limitations: [...input.limitations],
  fallbackUsed: Boolean(input.fallbackSignal?.required),
  fallbackReason: toFallbackReason(input.fallbackSignal, input.status, input.limitations),
  verificationRequired: true,
  verificationReadCount: input.verificationReadCount,
  status: input.status,
  durationMs: input.durationMs,
  indexStatus: input.runtimeStatus?.status ?? null,
  telemetryStatus: sanitizeTelemetryStatus(input.runtimeStatus),
});
