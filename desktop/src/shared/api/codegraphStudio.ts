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

export const getCodeGraphStudioReport = () =>
  get<CodeGraphStudioReport>("/microapps/codegraph/report");

export const saveCodeGraphStudioConfig = (input: {
  microAppEnabled?: boolean;
  agentCapabilityEnabled?: boolean;
  command?: string;
  startArgs?: string[];
  versionProbeArgs?: string[];
  telemetryProbeArgs?: string[];
  appDataRoot?: string;
  timeoutMs?: number;
  maxResults?: number;
  queryLimit?: number;
}) => put<CodeGraphStudioReport>("/microapps/codegraph/config", input);

export const detectCodeGraphStudio = () =>
  post<{ report: CodeGraphStudioReport }>("/microapps/codegraph/detect");

export const startCodeGraphStudio = () =>
  post<{ report: CodeGraphStudioReport }>("/microapps/codegraph/start");

export const healthCodeGraphStudio = () =>
  post<{ report: CodeGraphStudioReport }>("/microapps/codegraph/health");

export const stopCodeGraphStudio = () =>
  post<{ report: CodeGraphStudioReport }>("/microapps/codegraph/stop");

export const smokeStatusCodeGraphStudio = () =>
  post<CodeGraphStudioSmokeResult>("/microapps/codegraph/smoke/status");

export const smokeQueryCodeGraphStudio = (query: string) =>
  post<CodeGraphStudioSmokeResult>("/microapps/codegraph/smoke/query", {
    query,
  });
