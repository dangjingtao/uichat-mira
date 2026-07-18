import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  disposeRepoLocalManagedCodeGraphManagers,
  getRepoLocalManagedCodeGraphManagerCount,
  getRepoLocalManagedCodeGraphManagerForAgentWorkspace,
  type RepoLocalRuntimeContext,
} from "../repo-local-manager-cache.js";

const createContext = (workspaceRoot: string): RepoLocalRuntimeContext => ({
  draft: {
    command: "codegraph",
    startArgs: ["serve", "--mcp"],
    versionProbeArgs: ["--version"],
    telemetryProbeArgs: ["telemetry", "status"],
    timeoutMs: 2000,
  },
  plannerStorage: {
    logRoot: path.resolve(`${workspaceRoot}-appdata`, "logs"),
    indexRoot: path.resolve(`${workspaceRoot}-appdata`, "index"),
  },
  externalIndexSupport: {
    status: "blocked",
    repoDataDirName: ".codegraph",
    reason: "serve --mcp requires workspace/.codegraph",
  },
});

afterEach(async () => {
  await disposeRepoLocalManagedCodeGraphManagers();
});

describe("repo-local CodeGraph manager cache", () => {
  it("creates independent managers for independent Agent workspaces", async () => {
    const workspaceA = path.resolve("/workspace-a");
    const workspaceB = path.resolve("/workspace-b");

    const managerA = await getRepoLocalManagedCodeGraphManagerForAgentWorkspace(
      workspaceA,
      createContext(workspaceA),
      { microAppEnabled: true, agentCapabilityEnabled: true },
    );
    const managerB = await getRepoLocalManagedCodeGraphManagerForAgentWorkspace(
      workspaceB,
      createContext(workspaceB),
      { microAppEnabled: true, agentCapabilityEnabled: true },
    );

    expect(managerA).toBeTruthy();
    expect(managerB).toBeTruthy();
    expect(managerA).not.toBe(managerB);
    expect(getRepoLocalManagedCodeGraphManagerCount()).toBe(2);
  });

  it("ignores the legacy agent capability flag when the microapp is enabled", async () => {
    const workspace = path.resolve("/workspace-legacy-owner-flag");
    const manager = await getRepoLocalManagedCodeGraphManagerForAgentWorkspace(
      workspace,
      createContext(workspace),
      { microAppEnabled: true, agentCapabilityEnabled: false },
    );

    expect(manager).toBeTruthy();
    expect(getRepoLocalManagedCodeGraphManagerCount()).toBe(1);
  });

  it("does not create a manager when the CodeGraph microapp is disabled", async () => {
    const workspace = path.resolve("/workspace-disabled");
    const manager = await getRepoLocalManagedCodeGraphManagerForAgentWorkspace(
      workspace,
      createContext(workspace),
      { microAppEnabled: false, agentCapabilityEnabled: true },
    );

    expect(manager).toBeNull();
    expect(getRepoLocalManagedCodeGraphManagerCount()).toBe(0);
  });

  it("rejects managed log or index roots inside the Agent workspace", async () => {
    const workspace = path.resolve("/workspace-inside-storage");
    const context = createContext(workspace);
    context.plannerStorage.logRoot = path.join(workspace, ".runtime", "logs");
    context.plannerStorage.indexRoot = path.join(workspace, ".runtime", "index");

    const manager = await getRepoLocalManagedCodeGraphManagerForAgentWorkspace(
      workspace,
      context,
      { microAppEnabled: true, agentCapabilityEnabled: true },
    );

    expect(manager).toBeNull();
    expect(getRepoLocalManagedCodeGraphManagerCount()).toBe(0);
  });
});
