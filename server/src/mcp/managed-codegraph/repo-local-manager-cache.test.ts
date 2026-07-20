import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  disposeRepoLocalManagedCodeGraphManagers,
  getRepoLocalManagedCodeGraphManagerForAgentWorkspace,
  getRepoLocalManagedCodeGraphManagerCount,
  type RepoLocalRuntimeContext,
} from "./repo-local-manager-cache.js";

const tempRoots: string[] = [];

const makeTempRoot = (prefix: string) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
};

const createRuntimeContext = (appDataRoot: string): RepoLocalRuntimeContext => ({
  draft: {
    // A wrapper launcher must not make Agent ownership fall back to Studio's
    // singleton workspace gate.
    command: "node",
    startArgs: ["codegraph-wrapper.js", "serve", "--mcp"],
    versionProbeArgs: ["codegraph-wrapper.js", "--version"],
    telemetryProbeArgs: ["codegraph-wrapper.js", "telemetry", "status"],
    timeoutMs: 2_000,
  },
  plannerStorage: {
    logRoot: path.join(appDataRoot, "logs"),
    indexRoot: path.join(appDataRoot, "index"),
  },
  externalIndexSupport: {
    status: "ready",
    repoDataDirName: ".codegraph",
    reason: null,
  },
});

const createDetectableRuntimeContext = (
  appDataRoot: string,
): RepoLocalRuntimeContext => ({
  draft: {
    command: process.execPath,
    startArgs: ["-e", "process.stdin.resume()"],
    versionProbeArgs: ["--version"],
    telemetryProbeArgs: ["-e", "console.log('disabled')"],
    timeoutMs: 2_000,
  },
  plannerStorage: {
    logRoot: path.join(appDataRoot, "logs"),
    indexRoot: path.join(appDataRoot, "index"),
  },
  externalIndexSupport: {
    status: "ready",
    repoDataDirName: ".codegraph",
    reason: null,
  },
});

afterEach(async () => {
  await disposeRepoLocalManagedCodeGraphManagers();
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("repo-local CodeGraph manager cache", () => {
  it("creates an Agent-owned manager for wrapper launchers instead of requiring a literal codegraph executable name", async () => {
    const workspaceRoot = makeTempRoot("mira-codegraph-workspace-");
    const appDataRoot = makeTempRoot("mira-codegraph-appdata-");

    const manager = await getRepoLocalManagedCodeGraphManagerForAgentWorkspace(
      workspaceRoot,
      createRuntimeContext(appDataRoot),
      {
        microAppEnabled: true,
        agentCapabilityEnabled: true,
      },
      "thread-wrapper-provider",
    );

    expect(manager).not.toBeNull();
    expect(getRepoLocalManagedCodeGraphManagerCount()).toBe(1);
    expect(manager?.getStatus()).toMatchObject({
      workspaceRoot: path.resolve(workspaceRoot),
      allowedWorkspaceRoot: path.resolve(workspaceRoot),
      workspaceMatches: true,
    });
  });

  it("reuses one Agent runtime for the same workspace across conversation threads", async () => {
    const workspaceRoot = makeTempRoot("mira-codegraph-shared-workspace-");
    const appDataRoot = makeTempRoot("mira-codegraph-shared-appdata-");
    const runtimeContext = createRuntimeContext(appDataRoot);

    const first = await getRepoLocalManagedCodeGraphManagerForAgentWorkspace(
      workspaceRoot,
      runtimeContext,
      { microAppEnabled: true, agentCapabilityEnabled: true },
      "thread-a",
    );
    const second = await getRepoLocalManagedCodeGraphManagerForAgentWorkspace(
      workspaceRoot,
      runtimeContext,
      { microAppEnabled: true, agentCapabilityEnabled: true },
      "thread-b",
    );

    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(getRepoLocalManagedCodeGraphManagerCount()).toBe(1);
  });

  it("does not block an arbitrary Agent workspace just because it already contains .codegraph when the configured provider supports external indexes", async () => {
    const workspaceRoot = makeTempRoot("mira-codegraph-arbitrary-workspace-");
    const appDataRoot = makeTempRoot("mira-codegraph-arbitrary-appdata-");
    fs.mkdirSync(path.join(workspaceRoot, ".codegraph"), { recursive: true });

    const manager = await getRepoLocalManagedCodeGraphManagerForAgentWorkspace(
      workspaceRoot,
      createDetectableRuntimeContext(appDataRoot),
      { microAppEnabled: true, agentCapabilityEnabled: true },
      "thread-arbitrary-workspace",
    );

    expect(manager).not.toBeNull();
    const detected = await manager!.detect();
    expect(detected.status).toBe("stopped");
    expect(detected.workspaceAllowed).toBe(true);
    expect(detected.telemetryStatus).toBe("verified_off");
    expect(detected.reasons).not.toContain("repo_root_codegraph_present");
    expect(detected.reasons).not.toContain("workspace_mismatch");
  });
});
