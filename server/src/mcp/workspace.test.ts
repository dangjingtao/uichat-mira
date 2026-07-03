import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  clearWorkspaceSelection,
  getWorkspaceSelection,
  resolveWorkspacePath,
  resolveWorkspaceWritePath,
  selectWorkspaceRoot,
} from "./workspace.js";

describe("workspace selection", () => {
  const tempRoot = path.join(os.tmpdir(), `rag-demo-workspace-${process.pid}-${Date.now()}`);
  const outsideRoot = path.join(
    os.tmpdir(),
    `rag-demo-workspace-outside-${process.pid}-${Date.now()}`,
  );

  afterEach(() => {
    clearWorkspaceSelection();
    delete process.env.UI_CHAT_WORKSPACE_ROOT;
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.rmSync(outsideRoot, { recursive: true, force: true });
  });

  it("returns the development fallback workspace root when no workspace root is configured", () => {
    expect(getWorkspaceSelection()).toMatchObject({
      rootPath: "D:\\testData",
      source: "configured",
    });
  });

  it("selects workspace root explicitly", () => {
    fs.mkdirSync(tempRoot, { recursive: true });

    const selection = selectWorkspaceRoot(tempRoot);

    expect(selection).toMatchObject({
      rootPath: tempRoot,
      source: "selected",
    });
  });

  it("resolves paths inside selected workspace and rejects escaping paths", () => {
    fs.mkdirSync(tempRoot, { recursive: true });
    selectWorkspaceRoot(tempRoot);

    expect(resolveWorkspacePath("docs/role.md")).toBe(path.join(tempRoot, "docs", "role.md"));
    expect(() => resolveWorkspacePath("../outside.txt")).toThrow(
      "path must stay inside workspace root",
    );
  });

  it("rejects absolute write targets outside the selected workspace", () => {
    fs.mkdirSync(tempRoot, { recursive: true });
    fs.mkdirSync(outsideRoot, { recursive: true });
    selectWorkspaceRoot(tempRoot);

    expect(() => resolveWorkspaceWritePath(path.join(outsideRoot, "outside.txt"))).toThrow(
      "path must stay inside workspace root",
    );
  });

  it("rejects write targets that traverse a linked directory outside the workspace", () => {
    fs.mkdirSync(tempRoot, { recursive: true });
    fs.mkdirSync(outsideRoot, { recursive: true });
    selectWorkspaceRoot(tempRoot);

    fs.symlinkSync(outsideRoot, path.join(tempRoot, "linked-outside"), "junction");

    expect(() => resolveWorkspaceWritePath("linked-outside/escape.txt")).toThrow(
      "path must stay inside workspace root",
    );
  });

  it("rejects write targets when the workspace file path is a symlink to an external file", () => {
    fs.mkdirSync(tempRoot, { recursive: true });
    fs.mkdirSync(outsideRoot, { recursive: true });
    selectWorkspaceRoot(tempRoot);

    const outsideFile = path.join(outsideRoot, "outside.txt");
    fs.writeFileSync(outsideFile, "outside", "utf-8");
    fs.symlinkSync(outsideFile, path.join(tempRoot, "linked-file.txt"), "file");

    expect(() => resolveWorkspaceWritePath("linked-file.txt")).toThrow(
      "path must stay inside workspace root",
    );
  });
});
