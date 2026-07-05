import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHarnessEnvironmentSnapshot } from "../../harness/environment.js";
import { clearWorkspaceSelection } from "../workspace.js";
import { readOpenTool } from "./read-open.tool.js";

const tempRoot = path.join(os.tmpdir(), `rag-demo-read-open-tool-${process.pid}-${Date.now()}`);

describe("read_open tool", () => {
  beforeEach(() => {
    fs.mkdirSync(tempRoot, { recursive: true });
    fs.writeFileSync(path.join(tempRoot, "notes.log"), "hello read open");
    process.env.UI_CHAT_WORKSPACE_ROOT = tempRoot;
    clearWorkspaceSelection();
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.UI_CHAT_WORKSPACE_ROOT;
    clearWorkspaceSelection();
  });

  it("opens workspace files", async () => {
    const artifacts: unknown[] = [];
    const events: string[] = [];

    const result = await readOpenTool.execute({
      invocationId: "read-open-1",
      args: { path: "notes.log" },
      signal: new AbortController().signal,
      environment: createHarnessEnvironmentSnapshot(),
      pushEvent(event) {
        events.push(event.type === "invocation:progress" ? event.message : event.type);
      },
      addArtifact(artifact) {
        artifacts.push(artifact);
        return { id: "artifact-1", ...artifact };
      },
    });

    expect((result.result as { type: string }).type).toBe("open");
    expect((result.result as { source: { text: string } }).source.text).toContain("hello read open");
    expect(artifacts).toHaveLength(1);
    expect(events[0]).toContain("Read plan:");
    expect(events[0]).not.toContain("@");
  });

  it("keeps the compatibility alias behavior through read", async () => {
    const { readTool } = await import("./read.tool.js");
    const result = await readTool.execute({
      invocationId: "read-open-alias-1",
      args: { path: "notes.log" },
      signal: new AbortController().signal,
      environment: createHarnessEnvironmentSnapshot(),
      pushEvent() {},
      addArtifact(artifact) {
        return { id: "artifact-1", ...artifact };
      },
    });

    expect((result.result as { type: string }).type).toBe("open");
  });
});
