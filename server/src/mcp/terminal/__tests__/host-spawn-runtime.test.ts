import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  resolveHostCwd,
  resolveHostEnv,
} from "../host-spawn-runtime.js";

const tempRoots: string[] = [];

const makeTempRoot = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mira-host-runtime-"));
  tempRoots.push(root);
  return root;
};

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("host spawn cwd", () => {
  it("defaults to the selected workspace", () => {
    const workspaceRoot = makeTempRoot();
    const result = resolveHostCwd({ workspaceRoot });

    expect(result.cwd).toBe(path.resolve(workspaceRoot));
    expect(result.workspaceRelation).toBe("inside");
  });

  it("allows an approved absolute directory outside the workspace", () => {
    const workspaceRoot = makeTempRoot();
    const outsideRoot = makeTempRoot();
    const result = resolveHostCwd({
      workspaceRoot,
      cwd: outsideRoot,
    });

    expect(result.cwd).toBe(path.resolve(outsideRoot));
    expect(result.workspaceRelation).toBe("outside");
  });

  it("allows parent traversal and records the resolved relation", () => {
    const parentRoot = makeTempRoot();
    const workspaceRoot = path.join(parentRoot, "workspace");
    const outsideRoot = path.join(parentRoot, "outside");
    fs.mkdirSync(workspaceRoot);
    fs.mkdirSync(outsideRoot);

    const result = resolveHostCwd({
      workspaceRoot,
      cwd: "../outside",
    });

    expect(result.cwd).toBe(path.resolve(outsideRoot));
    expect(result.workspaceRelation).toBe("outside");
  });

  it("still rejects a cwd that does not exist", () => {
    const workspaceRoot = makeTempRoot();

    expect(() =>
      resolveHostCwd({
        workspaceRoot,
        cwd: "missing-directory",
      }),
    ).toThrow(/does not exist/i);
  });
});

describe("host spawn environment", () => {
  it("inherits the host environment and accepts arbitrary overrides", () => {
    const result = resolveHostEnv({
      MIRA_TEST_CUSTOM_ENV: "available",
    });

    expect(result.MIRA_TEST_CUSTOM_ENV).toBe("available");
    if (process.env.PATH) {
      expect(result.PATH).toBe(process.env.PATH);
    }
  });
});
