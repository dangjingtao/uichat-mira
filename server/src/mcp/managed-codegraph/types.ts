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

