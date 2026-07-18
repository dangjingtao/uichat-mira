import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ensureCodeGraphGitLocalExclude } from "../repo-local-process-manager.js";
import { getTestArtifactDir } from "@/test-support/artifacts.js";

const root = getTestArtifactDir("codegraph-git-exclude");

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("CodeGraph repo-local Git exclusion", () => {
  it("adds .codegraph to local git info/exclude without touching tracked gitignore", () => {
    const workspace = path.join(root, "workspace");
    const gitInfo = path.join(workspace, ".git", "info");
    fs.mkdirSync(gitInfo, { recursive: true });
    fs.writeFileSync(path.join(workspace, ".gitignore"), "dist/\n", "utf8");

    expect(ensureCodeGraphGitLocalExclude(workspace)).toBe(true);
    expect(
      fs.readFileSync(path.join(gitInfo, "exclude"), "utf8"),
    ).toContain(".codegraph/");
    expect(fs.readFileSync(path.join(workspace, ".gitignore"), "utf8")).toBe(
      "dist/\n",
    );
  });

  it("is idempotent", () => {
    const workspace = path.join(root, "workspace-idempotent");
    const gitInfo = path.join(workspace, ".git", "info");
    fs.mkdirSync(gitInfo, { recursive: true });

    expect(ensureCodeGraphGitLocalExclude(workspace)).toBe(true);
    expect(ensureCodeGraphGitLocalExclude(workspace)).toBe(true);

    const exclude = fs.readFileSync(path.join(gitInfo, "exclude"), "utf8");
    expect(exclude.match(/\.codegraph\//g)).toHaveLength(1);
  });
});
