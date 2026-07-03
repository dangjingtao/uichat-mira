import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { buildAgentExecutionEnvironmentPrompt, resolveAgentContext } from "./thread-request-context-agent.resolver.js";

describe("resolveAgentContext", () => {
  it("injects execution environment details into the agent prompt", () => {
    const prompt = buildAgentExecutionEnvironmentPrompt({
      platform: "win32",
      shellFamily: "powershell",
      shellExecutable: "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
      workspaceRoot: "D:\\workspace\\rag-demo",
      cwd: "D:\\testData",
      availableTools: ["read_list", "read_open", "terminal_session"],
    });

    assert.match(prompt, /当前执行平台：win32/);
    assert.match(prompt, /当前 shell：powershell/);
    assert.match(prompt, /workspaceRoot：D:\\workspace\\rag-demo/);
    assert.match(prompt, /read_list/);
    assert.match(prompt, /terminal_session/);
  });

  it("returns null when agent is disabled", () => {
    const context = resolveAgentContext({
      thread: {
        roleId: null,
        contextSummary: null,
        contextSummaryUpdatedAt: null,
        agentEnabled: false,
      },
      userId: 1,
    });

    assert.equal(context, null);
  });
});
