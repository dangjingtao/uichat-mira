import { get, post, put } from "../lib/request";

export type CodeGraphStudioStatus =
  | "ready"
  | "blocked"
  | "unavailable"
  | "degraded"
  | "stopped";

export type CodeGraphStudioBlockedReasonCode =
  | "external_index_root_unsupported"
  | "repo_pollution_risk"
  | "telemetry_not_verified_off"
  | "app_data_root_unavailable"
  | "provider_missing";

export type CodeGraphStudioReport = {
  status: CodeGraphStudioStatus;
  blockedReasons: Array<{
    code: CodeGraphStudioBlockedReasonCode;
    label: string;
    message: string;
  }>;
  config: {
    workspaceRoot: string;
    appDataRoot: string;
    appDataRootResolved: string | null;
    logRoot: string | null;
    indexRoot: string | null;
    microAppEnabled: boolean;
    /** Legacy compatibility field. Product enablement follows microAppEnabled. */
    agentCapabilityEnabled: boolean;
    command: string;
    startArgs: string[];
    versionProbeArgs: string[];
    telemetryProbeArgs: string[];
    timeoutMs: number;
    maxResults: number;
    queryLimit: number;
    capabilityRegistered: boolean;
  };
  capability: {
    available: boolean;
    registered: boolean;
    reasons: Array<{
      code: string;
      message: string;
    }>;
    checks: {
      microAppEnabled: boolean;
      agentCapabilityEnabled: boolean;
      runtimeReady: boolean;
      telemetryVerifiedOff: boolean;
      workspaceMatched: boolean;
      repoPollutionSafe: boolean;
      appDataRootValid: boolean;
      capabilityRegistrationReady: boolean;
    };
  };
  pollutionGuard: {
    status: "ready" | "blocked";
    repoDataDirName: string;
    repoDataDirPath: string;
    exists: boolean;
    blockedReason: string | null;
  };
  runtime: {
    providerVersion: string | null;
    telemetryStatus: string;
    handshakeStatus: string;
    initializedNotificationSent: boolean;
    processAlive: boolean;
    startedAt: number | null;
    stoppedAt: number | null;
    durationMs: number | null;
    exitCode: number | null;
    lastStatus: string | null;
    lastError: string | null;
    crashCount: number;
    startDisposition: string | null;
  };
  debug: {
    workspaceHash: string;
    plannerStorage: Record<string, unknown>;
    externalIndexSupport: Record<string, unknown>;
    detectReasons: string[];
    rawManagerStatus: string;
  };
};

export type CodeGraphStudioSmokeResult = {
  kind: "status" | "query";
  ok: boolean;
  message: string;
  payload: unknown;
  report: CodeGraphStudioReport;
};

const DECLARED_REPO_LOCAL_SOFT_REASONS = new Set([
  "external_index_root_unsupported",
  "repo_pollution_risk",
]);
const LAZY_RUNTIME_GATE_REASONS = new Set([
  "agent_capability_disabled",
  "repo_pollution_risk",
  "runtime_not_ready",
  "telemetry_not_verified_off",
  "workspace_mismatch",
]);

const isRealCodeGraphCommand = (command: string) => {
  const basename = command.trim().split(/[\\/]/).at(-1)?.toLowerCase() ?? "";
  return (
    basename === "codegraph" ||
    basename === "codegraph.cmd" ||
    basename === "codegraph.exe"
  );
};

const normalizeRuntimeStatus = (status: string): CodeGraphStudioStatus => {
  switch (status) {
    case "ready":
    case "blocked":
    case "unavailable":
    case "degraded":
    case "stopped":
      return status;
    case "starting":
    case "failed":
      return "degraded";
    default:
      return "unavailable";
  }
};

export const normalizeCodeGraphStudioReport = (
  report: CodeGraphStudioReport,
): CodeGraphStudioReport => {
  if (!isRealCodeGraphCommand(report.config.command)) {
    return report;
  }

  const blockedReasons = report.blockedReasons.filter(
    (reason) => !DECLARED_REPO_LOCAL_SOFT_REASONS.has(reason.code),
  );
  const reasons = report.capability.reasons.filter(
    (reason) => !LAZY_RUNTIME_GATE_REASONS.has(reason.code),
  );
  const checks = {
    ...report.capability.checks,
    agentCapabilityEnabled: report.config.microAppEnabled,
    workspaceMatched: true,
    repoPollutionSafe: true,
  };
  const capabilityRegistrationReady =
    checks.microAppEnabled && checks.appDataRootValid;
  const rawRuntimeStatus = normalizeRuntimeStatus(report.debug.rawManagerStatus);
  const resolvedAppDataRoot =
    report.config.appDataRoot.trim() || report.config.appDataRootResolved || "";

  return {
    ...report,
    status:
      blockedReasons.length > 0
        ? "blocked"
        : rawRuntimeStatus === "blocked" && checks.runtimeReady
          ? "ready"
          : rawRuntimeStatus,
    blockedReasons,
    config: {
      ...report.config,
      appDataRoot: resolvedAppDataRoot,
      agentCapabilityEnabled: report.config.microAppEnabled,
    },
    capability: {
      ...report.capability,
      available: capabilityRegistrationReady,
      registered:
        capabilityRegistrationReady && report.config.capabilityRegistered,
      reasons,
      checks: {
        ...checks,
        capabilityRegistrationReady,
      },
    },
    pollutionGuard: {
      ...report.pollutionGuard,
      status: "ready",
      blockedReason: null,
    },
  };
};

const normalizeReportResponse = <T extends { report: CodeGraphStudioReport }>(
  result: T,
): T => ({
  ...result,
  report: normalizeCodeGraphStudioReport(result.report),
});

export const getCodeGraphStudioReport = async () =>
  normalizeCodeGraphStudioReport(
    await get<CodeGraphStudioReport>("/microapps/codegraph/report"),
  );

export const saveCodeGraphStudioConfig = async (input: {
  microAppEnabled?: boolean;
  /** Legacy compatibility only. Prefer microAppEnabled. */
  agentCapabilityEnabled?: boolean;
  command?: string;
  startArgs?: string[];
  versionProbeArgs?: string[];
  telemetryProbeArgs?: string[];
  appDataRoot?: string;
  timeoutMs?: number;
  maxResults?: number;
  queryLimit?: number;
}) =>
  normalizeCodeGraphStudioReport(
    await put<CodeGraphStudioReport>("/microapps/codegraph/config", input),
  );

export const detectCodeGraphStudio = async () =>
  normalizeReportResponse(
    await post<{ report: CodeGraphStudioReport }>("/microapps/codegraph/detect"),
  );

export const startCodeGraphStudio = async () =>
  normalizeReportResponse(
    await post<{ report: CodeGraphStudioReport }>("/microapps/codegraph/start"),
  );

export const healthCodeGraphStudio = async () =>
  normalizeReportResponse(
    await post<{ report: CodeGraphStudioReport }>("/microapps/codegraph/health"),
  );

export const stopCodeGraphStudio = async () =>
  normalizeReportResponse(
    await post<{ report: CodeGraphStudioReport }>("/microapps/codegraph/stop"),
  );

export const smokeStatusCodeGraphStudio = async (workspacePath?: string) =>
  normalizeReportResponse(
    await post<CodeGraphStudioSmokeResult>("/microapps/codegraph/smoke/status", {
      workspacePath: workspacePath?.trim() || undefined,
    }),
  );

export const smokeQueryCodeGraphStudio = async (
  query: string,
  workspacePath?: string,
) =>
  normalizeReportResponse(
    await post<CodeGraphStudioSmokeResult>("/microapps/codegraph/smoke/query", {
      query,
      workspacePath: workspacePath?.trim() || undefined,
    }),
  );
