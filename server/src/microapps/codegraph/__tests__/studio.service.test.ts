import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createCodeGraphStudioService,
} from "../index.js";
import { getTestArtifactDir } from "@/test-support/artifacts.js";

const fixturePath = path.resolve(
  "src/mcp/managed-codegraph/__tests__/fixtures/fake-codegraph-provider.mjs",
);
const workspaceRoot = path.resolve(process.cwd());
const storageRoot = getTestArtifactDir("codegraph-studio-service");
const appDataRoot = getTestArtifactDir("codegraph-studio-appdata");
const isolatedWorkspaceRoot = getTestArtifactDir("codegraph-studio-workspace");

const originalEnv = {
  UI_CHAT_CODEGRAPH_PLANNER_ENABLED: process.env.UI_CHAT_CODEGRAPH_PLANNER_ENABLED,
  UI_CHAT_CODEGRAPH_APP_DATA_ROOT: process.env.UI_CHAT_CODEGRAPH_APP_DATA_ROOT,
  UI_CHAT_CODEGRAPH_COMMAND: process.env.UI_CHAT_CODEGRAPH_COMMAND,
  UI_CHAT_CODEGRAPH_START_ARGS: process.env.UI_CHAT_CODEGRAPH_START_ARGS,
  UI_CHAT_CODEGRAPH_VERSION_ARGS: process.env.UI_CHAT_CODEGRAPH_VERSION_ARGS,
  UI_CHAT_CODEGRAPH_TELEMETRY_ARGS: process.env.UI_CHAT_CODEGRAPH_TELEMETRY_ARGS,
};

const resetCodeGraphEnv = () => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

describe("CodeGraph Studio service", () => {
  beforeEach(() => {
    resetCodeGraphEnv();
    fs.rmSync(storageRoot, { recursive: true, force: true });
    fs.rmSync(appDataRoot, { recursive: true, force: true });
    fs.rmSync(isolatedWorkspaceRoot, { recursive: true, force: true });
    fs.mkdirSync(storageRoot, { recursive: true });
    fs.mkdirSync(appDataRoot, { recursive: true });
    fs.mkdirSync(isolatedWorkspaceRoot, { recursive: true });
    delete process.env.UI_CHAT_CODEGRAPH_PLANNER_ENABLED;
    delete process.env.UI_CHAT_CODEGRAPH_APP_DATA_ROOT;
    delete process.env.UI_CHAT_CODEGRAPH_COMMAND;
    delete process.env.UI_CHAT_CODEGRAPH_START_ARGS;
    delete process.env.UI_CHAT_CODEGRAPH_VERSION_ARGS;
    delete process.env.UI_CHAT_CODEGRAPH_TELEMETRY_ARGS;
  });

  afterEach(() => {
    resetCodeGraphEnv();
    fs.rmSync(storageRoot, { recursive: true, force: true });
    fs.rmSync(appDataRoot, { recursive: true, force: true });
    fs.rmSync(isolatedWorkspaceRoot, { recursive: true, force: true });
  });

  it("reports the real provider as blocked when external index root is unsupported", async () => {
    const service = createCodeGraphStudioService({
      workspaceRoot: isolatedWorkspaceRoot,
      storageRoot,
    });

    const report = await service.getReport();

    expect(report.status).toBe("blocked");
    expect(report.config.command).toBe("codegraph");
    expect(report.config.plannerExposureEnabled).toBe(false);
    expect(
      report.blockedReasons.map((reason) => reason.code),
    ).toContain("external_index_root_unsupported");
  });

  it("reports blocked when appDataRoot cannot be resolved", async () => {
    process.env.UI_CHAT_CODEGRAPH_COMMAND = process.execPath;
    const service = createCodeGraphStudioService({
      workspaceRoot,
      storageRoot,
    });

    const report = await service.getReport();

    expect(report.status).toBe("blocked");
    expect(
      report.blockedReasons.map((reason) => reason.code),
    ).toContain("app_data_root_unavailable");
  });

  it("preserves repo-root .codegraph and reports repo pollution risk", async () => {
    process.env.UI_CHAT_CODEGRAPH_COMMAND = process.execPath;
    process.env.UI_CHAT_CODEGRAPH_APP_DATA_ROOT = appDataRoot;
    process.env.UI_CHAT_CODEGRAPH_START_ARGS = JSON.stringify([fixturePath, "--mcp"]);
    process.env.UI_CHAT_CODEGRAPH_VERSION_ARGS = JSON.stringify([fixturePath, "--version"]);
    process.env.UI_CHAT_CODEGRAPH_TELEMETRY_ARGS = JSON.stringify([
      fixturePath,
      "--telemetry-status",
    ]);
    const repoCodeGraphDir = path.join(workspaceRoot, ".codegraph");
    const sentinelPath = path.join(repoCodeGraphDir, "studio-sentinel.txt");
    fs.mkdirSync(repoCodeGraphDir, { recursive: true });
    fs.writeFileSync(sentinelPath, "user-owned", "utf8");

    try {
      const service = createCodeGraphStudioService({
        workspaceRoot,
        storageRoot,
      });
      const report = await service.getReport();

      expect(report.status).toBe("blocked");
      expect(report.pollutionGuard.exists).toBe(true);
      expect(
        report.blockedReasons.map((reason) => reason.code),
      ).toContain("repo_pollution_risk");
      expect(fs.readFileSync(sentinelPath, "utf8")).toBe("user-owned");
    } finally {
      fs.rmSync(repoCodeGraphDir, { recursive: true, force: true });
    }
  });

  it("saves config and uses the fake provider for ready smoke query without enabling planner exposure by default", async () => {
    const caseRoot = path.join(
      getTestArtifactDir("codegraph-studio-cases"),
      `ready-${Date.now()}`,
    );
    const caseStorageRoot = path.join(caseRoot, "storage");
    const caseAppDataRoot = path.join(caseRoot, "appdata");
    const caseWorkspaceRoot = path.join(caseRoot, "workspace");
    fs.mkdirSync(caseStorageRoot, { recursive: true });
    fs.mkdirSync(caseAppDataRoot, { recursive: true });
    fs.mkdirSync(caseWorkspaceRoot, { recursive: true });
    const service = createCodeGraphStudioService({
      workspaceRoot: caseWorkspaceRoot,
      storageRoot: caseStorageRoot,
    });

    service.saveConfig({
      command: process.execPath,
      startArgs: [fixturePath, "--mcp"],
      versionProbeArgs: [fixturePath, "--version"],
      telemetryProbeArgs: [fixturePath, "--telemetry-status"],
      appDataRoot: caseAppDataRoot,
      timeoutMs: 1500,
      maxResults: 7,
      queryLimit: 4,
    });

    const started = await service.start();
    const smoke = await service.smokeQuery("microapps architecture flow overview");

    expect(started.report.status).toBe("ready");
    expect(smoke.ok).toBe(true);
    expect(smoke.kind).toBe("query");
    expect(smoke.report.config.command).toBe(process.execPath);
    expect(smoke.report.config.queryLimit).toBe(4);
    expect(smoke.report.config.maxResults).toBe(7);
    expect(smoke.report.config.plannerExposureEnabled).toBe(false);
  });
});
