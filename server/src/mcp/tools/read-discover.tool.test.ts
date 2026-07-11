import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHarnessEnvironmentSnapshot } from "../../harness/environment.js";
import { clearWorkspaceSelection } from "../workspace.js";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";
import { readDiscoverTool } from "./read-discover.tool.js";

const tempRoot = createTimestampedTestArtifactPath("workspace", "rag-demo-read-discover-tool");

const context = (args: Record<string, unknown>) => ({
  invocationId: "read-discover-test",
  args,
  signal: new AbortController().signal,
  environment: createHarnessEnvironmentSnapshot(),
  pushEvent() {},
  addArtifact(artifact: any) { return { id: "artifact-1", ...artifact }; },
});

describe("read_discover tool", () => {
  beforeEach(() => {
    fs.mkdirSync(path.join(tempRoot, "docs"), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, "docs", "guide.md"), "guide contents");
    process.env.UI_CHAT_WORKSPACE_ROOT = tempRoot;
    clearWorkspaceSelection();
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.UI_CHAT_WORKSPACE_ROOT;
    clearWorkspaceSelection();
  });

  it("mechanically dispatches list without returning file contents", async () => {
    const result = await readDiscoverTool.execute(context({ mode: "list", path: "docs" }));
    expect(result.result).toMatchObject({ type: "discover", mode: "list", operation: "list" });
    expect(JSON.stringify(result.result)).not.toContain("guide contents");
  });

  it("mechanically dispatches locate and returns candidates only", async () => {
    const result = await readDiscoverTool.execute(context({ mode: "locate", query: "guide" }));
    expect(result.result).toMatchObject({ type: "discover", mode: "locate", operation: "locate" });
    expect(result.result).not.toHaveProperty("source");
    const matches = (result.result as { matches: Array<{ preview?: string }> }).matches;
    expect(matches.every((match) => (match.preview?.length ?? 0) <= 120)).toBe(true);
  });
});
