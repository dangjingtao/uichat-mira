import { describe, expect, it, vi } from "vitest";
import { createHarnessEnvironmentSnapshot } from "@/harness/environment.js";
import { pythonSessionTool } from "@/mcp/tools/python-session.tool.js";
import { evidenceNode } from "../nodes/evidence.js";
import { generateNode } from "../nodes/generate.js";
import * as runnablesModule from "../runnables.js";
import { providerProxyService } from "@/services/provider-proxy.service/index.js";

describe("python_session evidence chain", () => {
  it("routes managed Python result through Evidence into Generate", async () => {
    const workspaceRoot = process.cwd();
    const executable = process.platform === "win32" ? "python" : "python3";
    const environment = createHarnessEnvironmentSnapshot({
      workspace: { rootPath: workspaceRoot, source: "configured" },
      toolConfig: { python: { enabled: true, executable } },
    });
    const args = { code: "print('python evidence fact')", cwd: ".", timeoutMs: 5000 };
    const toolOutput = await pythonSessionTool.execute({
      invocationId: "python-evidence-invocation",
      args,
      environment,
      approval: { inputHash: "approved", granted: true },
      pushEvent: vi.fn(),
      addArtifact: vi.fn(),
      trace: { startSpan: vi.fn(() => ({ end: vi.fn() })) },
      signal: new AbortController().signal,
    } as never);
    expect(toolOutput.evidence?.status).toBe("completed");

    const evidenceState = await evidenceNode({
      runId: "python-evidence-run",
      threadId: "python-evidence-thread",
      userId: 1,
      goal: { text: "run Python and report the result" },
      messages: [{ role: "user", content: "Run Python and report the result.", parts: [{ type: "text", text: "Run Python and report the result." }] }],
      pendingToolExecution: {
        toolId: "python_session",
        args,
        status: "completed",
        result: toolOutput.result,
        evidence: toolOutput.evidence,
        startedAt: "2026-07-17T00:00:00.000Z",
        finishedAt: "2026-07-17T00:00:01.000Z",
      },
    } as never);
    expect(evidenceState.evidence?.latestSummary?.facts.join(" ")).toContain("Python execution status");

    const generateSpy = vi.spyOn(runnablesModule.agentGenerateTextRunnable, "invoke").mockResolvedValue("Python result: python evidence fact");
    const describeSpy = vi.spyOn(providerProxyService, "describeChatInvocation").mockReturnValue({ provider: "test", model: "test", messageCount: 1 } as never);
    try {
      const generated = await generateNode({
        ...(evidenceState as never),
        runId: "python-evidence-run",
        threadId: "python-evidence-thread",
        userId: 1,
        goal: { text: "run Python and report the result" },
        messages: [{ role: "user", content: "Run Python and report the result.", parts: [{ type: "text", text: "Run Python and report the result." }] }],
      } as never);
      expect(generated.answer).toContain("python evidence fact");
      const promptText = JSON.stringify(generateSpy.mock.calls[0]?.[0]);
      expect(promptText).toContain("python evidence fact");
    } finally {
      generateSpy.mockRestore();
      describeSpy.mockRestore();
    }
  });
});
