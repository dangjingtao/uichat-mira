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

  it("treats the legacy agent capability flag as following microapp enablement", () => {
    const source = createReport({
      config: {
        ...createReport().config,
        microAppEnabled: true,
        agentCapabilityEnabled: false,
      },
      capability: {
        ...createReport().capability,
        reasons: [
          {
            code: "agent_capability_disabled",
            message: "Owner has not allowed the agent to use CodeGraph.",
          },
        ],
        checks: {
          ...createReport().capability.checks,
          microAppEnabled: true,
          agentCapabilityEnabled: false,
          capabilityRegistrationReady: false,
        },
      },
    });

    const normalized = normalizeCodeGraphStudioReport(source);
    expect(normalized.config.agentCapabilityEnabled).toBe(true);
    expect(normalized.capability.checks.agentCapabilityEnabled).toBe(true);
    expect(normalized.capability.available).toBe(true);
    expect(normalized.capability.reasons).toEqual([]);
  });

  it("keeps the controlled capability registered before the workspace runtime is started", () => {
    const source = createReport({
      capability: {
        ...createReport().capability,
        reasons: [
          { code: "runtime_not_ready", message: "runtime not ready" },
          {
            code: "telemetry_not_verified_off",
            message: "telemetry not checked yet",
          },
          { code: "workspace_mismatch", message: "different studio workspace" },
          { code: "repo_pollution_risk", message: "repo-local index" },
        ],
        checks: {
          ...createReport().capability.checks,
          runtimeReady: false,
          telemetryVerifiedOff: false,
          workspaceMatched: false,
          repoPollutionSafe: false,
          capabilityRegistrationReady: false,
        },
      },
      runtime: {
        ...createReport().runtime,
        telemetryStatus: "unavailable",
        processAlive: false,
        startedAt: null,
        initializedNotificationSent: false,
      },
      debug: {
        ...createReport().debug,
        rawManagerStatus: "stopped",
      },
    });

    const normalized = normalizeCodeGraphStudioReport(source);
    expect(normalized.capability.available).toBe(true);
    expect(normalized.capability.registered).toBe(true);
    expect(normalized.capability.reasons).toEqual([]);
    expect(normalized.capability.checks.runtimeReady).toBe(false);
  });

  it("fills the resolved app-data root for the desktop draft", () => {
    const source = createReport({
      config: {
        ...createReport().config,
        appDataRoot: "",
        appDataRootResolved: "/resolved-app-data",
      },
    });

    expect(normalizeCodeGraphStudioReport(source).config.appDataRoot).toBe(
      "/resolved-app-data",
    );
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
