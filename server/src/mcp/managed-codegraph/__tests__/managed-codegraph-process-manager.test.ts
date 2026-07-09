import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  ManagedCodeGraphProcessManager,
  createManagedCodeGraphWorkspaceHash,
} from "../index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "../../../../../..");
const artifactRoot = path.join(workspaceRoot, ".test-artifact", "managed-codegraph");
const fixturePath = path.join(__dirname, "fixtures", "fake-codegraph-provider.mjs");

const tempDirs: string[] = [];

const makeTempDir = () => {
  fs.mkdirSync(artifactRoot, { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(artifactRoot, "case-"));
  tempDirs.push(tempDir);
  return tempDir;
};

const listRuntimeSourceFiles = (sourceDir: string): string[] => {
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(sourceDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") {
        continue;
      }
      files.push(...listRuntimeSourceFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
};

const createManager = (
  overrides: Partial<ConstructorParameters<typeof ManagedCodeGraphProcessManager>[0]> = {},
) => {
  const tempDir = makeTempDir();
  const currentWorkspace = overrides.workspaceRoot ?? workspaceRoot;
  return new ManagedCodeGraphProcessManager({
    command: process.execPath,
    startArgs: [fixturePath, "--mcp"],
    versionProbe: {
      args: [fixturePath, "--version"],
    },
    telemetryProbe: {
      args: [fixturePath, "--telemetry-status"],
    },
    env: {
      FAKE_PROVIDER_VERSION: "1.2.3",
      FAKE_TELEMETRY_STATUS: "disabled",
      ...overrides.env,
    },
    workspaceRoot: currentWorkspace,
    allowedWorkspaceRoot: overrides.allowedWorkspaceRoot ?? currentWorkspace,
    logRoot: overrides.logRoot ?? path.join(tempDir, "logs"),
    indexRoot: overrides.indexRoot ?? path.join(tempDir, "index"),
    startTimeoutMs: overrides.startTimeoutMs ?? 1_500,
    healthTimeoutMs: overrides.healthTimeoutMs ?? 1_500,
    stopTimeoutMs: overrides.stopTimeoutMs ?? 500,
  });
};

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("ManagedCodeGraphProcessManager", () => {
  it("detects a missing provider as unavailable", async () => {
    const manager = new ManagedCodeGraphProcessManager({
      command: path.join(os.tmpdir(), "missing-codegraph-provider.exe"),
      startArgs: [],
      versionProbe: {
        args: ["--version"],
      },
      telemetryProbe: {
        args: ["--telemetry-status"],
      },
      workspaceRoot,
      allowedWorkspaceRoot: workspaceRoot,
      logRoot: path.join(makeTempDir(), "logs"),
      indexRoot: path.join(makeTempDir(), "index"),
    });

    const result = await manager.detect();

    expect(result.status).toBe("unavailable");
    expect(result.commandFound).toBe(false);
    expect(result.reasons).toContain("provider_missing");
  });

  it("blocks when telemetry cannot be verified off", async () => {
    const manager = createManager({
      env: {
        FAKE_TELEMETRY_STATUS: "enabled",
      },
    });

    const result = await manager.detect();

    expect(result.status).toBe("blocked");
    expect(result.telemetryStatus).toBe("not_verified");
  });

  it("starts successfully and reports ready", async () => {
    const manager = createManager();

    const started = await manager.start();
    const health = await manager.health();

    expect(started.status).toBe("ready");
    expect(health.status).toBe("ready");
    expect(health.processAlive).toBe(true);
    expect(health.providerVersion).toBe("1.2.3");
    expect(health.telemetryStatus).toBe("verified_off");
    expect(health.workspaceHash).toBe(createManagedCodeGraphWorkspaceHash(workspaceRoot));

    await manager.stop();
  });

  it("reuses an existing process for duplicate start attempts", async () => {
    const tempDir = makeTempDir();
    const sharedOptions = {
      command: process.execPath,
      startArgs: [fixturePath, "--mcp"],
      versionProbe: {
        args: [fixturePath, "--version"],
      },
      telemetryProbe: {
        args: [fixturePath, "--telemetry-status"],
      },
      env: {
        FAKE_PROVIDER_VERSION: "1.2.3",
        FAKE_TELEMETRY_STATUS: "disabled",
      },
      workspaceRoot,
      allowedWorkspaceRoot: workspaceRoot,
      logRoot: path.join(tempDir, "logs"),
      indexRoot: path.join(tempDir, "index"),
      startTimeoutMs: 1_500,
      healthTimeoutMs: 1_500,
      stopTimeoutMs: 500,
    } satisfies ConstructorParameters<typeof ManagedCodeGraphProcessManager>[0];

    const primary = new ManagedCodeGraphProcessManager(sharedOptions);
    const duplicate = new ManagedCodeGraphProcessManager(sharedOptions);

    const primaryStart = await primary.start();
    const duplicateStart = await duplicate.start();

    expect(primaryStart.status).toBe("ready");
    expect(duplicateStart.status).toBe("ready");
    expect(duplicateStart.startDisposition).toBe("reused_existing");

    await primary.stop();
  });

  it("marks health probe failures as degraded or failed without touching agent mainline", async () => {
    const manager = createManager({
      env: {
        FAKE_HEALTH_SEQUENCE: "ready,error",
      },
    });

    await manager.start();
    const health = await manager.health();

    expect(["degraded", "failed"]).toContain(health.status);

    await manager.stop();
  });

  it("stops successfully and records exit details", async () => {
    const manager = createManager();

    await manager.start();
    const stopped = await manager.stop();

    expect(stopped.status).toBe("stopped");
    expect(stopped.exitCode).toBe(0);
    expect(stopped.lastStatus).toBe("ready");
    expect(typeof stopped.durationMs).toBe("number");
  });

  it("degrades or fails after a crash", async () => {
    const manager = createManager({
      env: {
        FAKE_CRASH_AFTER_MS: "200",
      },
    });

    await manager.start();
    await new Promise((resolve) => setTimeout(resolve, 350));
    const health = await manager.health();

    expect(["degraded", "failed"]).toContain(health.status);
    expect(health.processAlive).toBe(false);
  });

  it("blocks workspace mismatches before launch", async () => {
    const manager = createManager({
      workspaceRoot: path.join(workspaceRoot, "server"),
      allowedWorkspaceRoot: workspaceRoot,
    });

    const started = await manager.start();

    expect(["blocked", "failed"]).toContain(started.status);
    expect(started.processAlive).toBe(false);
  });

  it("keeps the spike isolated from Planner exposure", () => {
    const sourceDir = path.resolve(__dirname, "..");
    const combinedSource = listRuntimeSourceFiles(sourceDir)
      .map((filePath) => fs.readFileSync(filePath, "utf8"))
      .join("\n");

    expect(combinedSource).not.toMatch(/codebase_explore/);
    expect(combinedSource).not.toMatch(/from\s+["'][^"']*agent\//);
    expect(combinedSource).not.toMatch(/planner/i);
  });

  it("keeps the spike isolated from Evidence and read_file_slice integration", () => {
    const sourceDir = path.resolve(__dirname, "..");
    const combinedSource = listRuntimeSourceFiles(sourceDir)
      .map((filePath) => fs.readFileSync(filePath, "utf8"))
      .join("\n");

    expect(combinedSource).not.toMatch(/read_file_slice/);
    expect(combinedSource).not.toMatch(/evidence/i);
    expect(combinedSource).not.toMatch(/from\s+["'][^"']*read\//);
  });
});
