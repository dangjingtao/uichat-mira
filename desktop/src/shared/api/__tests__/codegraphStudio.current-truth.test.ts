import { describe, expect, it } from "vitest";

import {
  normalizeCodeGraphStudioReport,
  type CodeGraphStudioReport,
} from "../codegraphStudio";

const report: CodeGraphStudioReport = {
  status: "blocked",
  blockedReasons: [
    {
      code: "external_index_root_unsupported",
      label: "External Index Root Unsupported",
      message: "workspace-local index required",
    },
    {
      code: "repo_pollution_risk",
      label: "Repo Pollution Risk",
      message: "workspace/.codegraph exists",
    },
  ],
  config: {
    workspaceRoot: "D:\\workspace",
    appDataRoot: "D:\\app-data",
    appDataRootResolved: "D:\\app-data",
    logRoot: "D:\\app-data\\logs",
    indexRoot: "D:\\app-data\\index",
    microAppEnabled: true,
    agentCapabilityEnabled: true,
    command: "codegraph.cmd",
    startArgs: ["serve", "--mcp"],
    versionProbeArgs: ["--version"],
    telemetryProbeArgs: ["telemetry", "status"],
    timeoutMs: 2000,
    maxResults: 5,
    queryLimit: 5,
    capabilityRegistered: true,
  },
  capability: {
    available: false,
    registered: false,
    reasons: [
      {
        code: "repo_pollution_risk",
        message: "workspace/.codegraph exists",
      },
    ],
    checks: {
      microAppEnabled: true,
      agentCapabilityEnabled: true,
      runtimeReady: true,
      telemetryVerifiedOff: true,
      workspaceMatched: true,
      repoPollutionSafe: false,
      appDataRootValid: true,
      capabilityRegistrationReady: false,
    },
  },
  pollutionGuard: {
    status: "blocked",
    repoDataDirName: ".codegraph",
    repoDataDirPath: "D:\\workspace\\.codegraph",
    exists: true,
    blockedReason: "workspace-local index required",
  },
  runtime: {
    providerVersion: "1.3.0",
    telemetryStatus: "verified_off",
    handshakeStatus: "ok",
    initializedNotificationSent: true,
    processAlive: true,
    startedAt: 1,
    stoppedAt: null,
    durationMs: null,
    exitCode: null,
    lastStatus: null,
    lastError: null,
    crashCount: 0,
    startDisposition: "primary",
  },
  debug: {
    workspaceHash: "workspace-hash",
    plannerStorage: {},
    externalIndexSupport: {},
    detectReasons: ["repo_pollution_risk"],
    rawManagerStatus: "ready",
  },
};

describe("CodeGraph Studio current-truth normalization", () => {
  it("shows a healthy real provider as ready even when repo-local index diagnostics are present", () => {
    const normalized = normalizeCodeGraphStudioReport(report);

    expect(normalized.status).toBe("ready");
    expect(normalized.blockedReasons).toEqual([]);
    expect(normalized.pollutionGuard.status).toBe("ready");
    expect(normalized.capability.available).toBe(true);
    expect(normalized.capability.registered).toBe(true);
  });

  it("treats a stale legacy Agent flag as following the single microapp switch", () => {
    const staleLegacyReport: CodeGraphStudioReport = {
      ...report,
      config: {
        ...report.config,
        microAppEnabled: true,
        agentCapabilityEnabled: false,
      },
      capability: {
        ...report.capability,
        reasons: [
          {
            code: "agent_capability_disabled",
            message: "legacy owner flag is false",
          },
        ],
        checks: {
          ...report.capability.checks,
          microAppEnabled: true,
          agentCapabilityEnabled: false,
          capabilityRegistrationReady: false,
        },
      },
    };

    const normalized = normalizeCodeGraphStudioReport(staleLegacyReport);
    expect(normalized.config.agentCapabilityEnabled).toBe(true);
    expect(normalized.capability.checks.agentCapabilityEnabled).toBe(true);
    expect(normalized.capability.available).toBe(true);
    expect(normalized.capability.reasons).toEqual([]);
  });
});
