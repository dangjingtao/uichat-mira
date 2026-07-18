import { describe, expect, it } from "vitest";

import type { CodeGraphStudioReport } from "../index.js";
import { normalizeCodeGraphStudioReport } from "../public-report.js";

const createReport = (
  overrides: Partial<CodeGraphStudioReport> = {},
): CodeGraphStudioReport => ({
  status: "blocked",
  blockedReasons: [
    {
      code: "external_index_root_unsupported",
      label: "External Index Root Unsupported",
      message: "CodeGraph uses workspace/.codegraph",
    },
    {
      code: "repo_pollution_risk",
      label: "Repo Pollution Risk",
      message: "workspace/.codegraph exists",
    },
  ],
  config: {
    workspaceRoot: "/workspace",
    appDataRoot: "/app-data",
    appDataRootResolved: "/app-data",
    logRoot: "/app-data/logs",
    indexRoot: "/app-data/index",
    microAppEnabled: true,
    agentCapabilityEnabled: true,
    command: "codegraph",
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
    repoDataDirPath: "/workspace/.codegraph",
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
  ...overrides,
});

describe("normalizeCodeGraphStudioReport", () => {
  it("treats the real provider workspace index as declared runtime data", () => {
    const normalized = normalizeCodeGraphStudioReport(createReport());

    expect(normalized.status).toBe("ready");
    expect(normalized.blockedReasons).toEqual([]);
    expect(normalized.pollutionGuard.status).toBe("ready");
    expect(normalized.pollutionGuard.exists).toBe(true);
    expect(normalized.capability.available).toBe(true);
    expect(normalized.capability.registered).toBe(true);
    expect(normalized.capability.checks.repoPollutionSafe).toBe(true);
    expect(normalized.capability.checks.capabilityRegistrationReady).toBe(true);
  });

  it("preserves real blockers such as a missing provider", () => {
    const source = createReport({
      blockedReasons: [
        {
          code: "provider_missing",
          label: "Provider Missing",
          message: "CodeGraph provider command was not found.",
        },
      ],
      debug: {
        workspaceHash: "workspace-hash",
        plannerStorage: {},
        externalIndexSupport: {},
        detectReasons: ["provider_missing"],
        rawManagerStatus: "unavailable",
      },
    });

    const normalized = normalizeCodeGraphStudioReport(source);
    expect(normalized.status).toBe("blocked");
    expect(normalized.blockedReasons.map((reason) => reason.code)).toEqual([
      "provider_missing",
    ]);
  });

  it("does not relax alternate providers", () => {
    const source = createReport({
      config: {
        ...createReport().config,
        command: "node",
      },
    });

    expect(normalizeCodeGraphStudioReport(source)).toEqual(source);
  });
});
