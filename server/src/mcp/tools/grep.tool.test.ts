import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHarnessEnvironmentSnapshot } from "../../harness/environment.js";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";
import { clearWorkspaceSelection } from "../workspace.js";
import { grepTool } from "./grep.tool.js";

const tempRoot = createTimestampedTestArtifactPath("workspace", "grep-tool");

describe("grep tool", () => {
  beforeEach(() => {
    fs.mkdirSync(path.join(tempRoot, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(tempRoot, "src", "planner.ts"),
      "const answerReadiness = true;\nexport { answerReadiness };\n",
    );
    fs.writeFileSync(path.join(tempRoot, "src", "notes.md"), "answerReadiness notes\n");
    process.env.UI_CHAT_WORKSPACE_ROOT = tempRoot;
    clearWorkspaceSelection();
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.UI_CHAT_WORKSPACE_ROOT;
    clearWorkspaceSelection();
  });

  it("searches workspace content through the read locate runtime", async () => {
    const result = await grepTool.execute({
      invocationId: "grep-1",
      args: {
        pattern: "answerReadiness",
        root: "src",
        extensions: ["ts"],
        maxResults: 10,
      },
      signal: new AbortController().signal,
      environment: createHarnessEnvironmentSnapshot({
        read: {
          capabilities: [
            {
              id: "node-content-scan-locate",
              kind: "locate",
              provider: "node-fs",
              available: true,
              priority: 100,
            },
          ],
        },
      }),
      pushEvent() {},
      addArtifact(artifact) {
        return { id: "artifact-1", ...artifact };
      },
    });

    const output = result.result as {
      type: string;
      searchMode: string;
      matches: Array<{ path: string; matchType: string }>;
    };

    expect(output.type).toBe("locate");
    expect(output.searchMode).toBe("content");
    expect(output.matches).toEqual([
      expect.objectContaining({
        path: "src/planner.ts",
        matchType: "content",
      }),
    ]);
  });

  it("rejects a missing pattern", async () => {
    await expect(
      grepTool.execute({
        invocationId: "grep-2",
        args: {},
        signal: new AbortController().signal,
        environment: createHarnessEnvironmentSnapshot(),
        pushEvent() {},
        addArtifact(artifact) {
          return { id: "artifact-1", ...artifact };
        },
      }),
    ).rejects.toThrow("pattern is required");
  });
});
