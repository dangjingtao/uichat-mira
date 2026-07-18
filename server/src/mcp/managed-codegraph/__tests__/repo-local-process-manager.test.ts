import { describe, expect, it } from "vitest";

import {
  isRealCodeGraphCommand,
  shouldAllowDeclaredRepoLocalCodeGraphData,
} from "../repo-local-process-manager.js";
import type { ManagedCodeGraphProcessManagerOptions } from "../types.js";

const createOptions = (
  overrides?: Partial<ManagedCodeGraphProcessManagerOptions>,
): ManagedCodeGraphProcessManagerOptions => ({
  command: "codegraph",
  startArgs: ["serve", "--mcp"],
  versionProbe: {
    args: ["--version"],
  },
  telemetryProbe: {
    args: ["telemetry", "status"],
  },
  workspaceRoot: "/workspace",
  allowedWorkspaceRoot: "/workspace",
  logRoot: "/app-data/logs",
  indexRoot: "/app-data/index",
  repoPollutionGuard: {
    status: "blocked",
    repoDataDirName: ".codegraph",
    blockedReason:
      "CodeGraph cannot use an external index-root and requires workspace/.codegraph for serve --mcp.",
  },
  ...(overrides ?? {}),
});

describe("declared repo-local CodeGraph process manager", () => {
  it("recognizes only the real CodeGraph command surface", () => {
    expect(isRealCodeGraphCommand("codegraph")).toBe(true);
    expect(isRealCodeGraphCommand("codegraph.cmd")).toBe(true);
    expect(isRealCodeGraphCommand("codegraph.exe")).toBe(true);
    expect(isRealCodeGraphCommand("node")).toBe(false);
    expect(isRealCodeGraphCommand("fake-codegraph-provider.mjs")).toBe(false);
  });

  it("allows the known workspace-local index constraint for the real provider", () => {
    expect(
      shouldAllowDeclaredRepoLocalCodeGraphData(createOptions()),
    ).toBe(true);
  });

  it("does not weaken arbitrary blocked guards", () => {
    expect(
      shouldAllowDeclaredRepoLocalCodeGraphData(
        createOptions({
          repoPollutionGuard: {
            status: "blocked",
            repoDataDirName: ".codegraph",
            blockedReason: "workspace mismatch",
          },
        }),
      ),
    ).toBe(false);
  });

  it("keeps fake and alternative providers under the strict pollution guard", () => {
    expect(
      shouldAllowDeclaredRepoLocalCodeGraphData(
        createOptions({
          command: process.execPath,
        }),
      ),
    ).toBe(false);
  });
});
