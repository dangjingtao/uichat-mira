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
});
