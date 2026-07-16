import { describe, expect, test, vi } from "vitest";
import { clearInvocations } from "@/mcp/core/invocations.js";
import { clearRegistry, registerTool } from "@/mcp/core/registry.js";
import { createComputerUseBrowserTools } from "@/mcp/tools/browser-tools.tool.js";
import { ComputerUseModelExecutor, type ComputerUseModelProvider } from "./model-loop.js";
import { createInvocationInputHash as createHash } from "@/agent/approval-fingerprint.js";

const task = { id: "task-1", goal: "inspect the page", siteScope: ["example.com"], status: "running", runtime: { status: "ready", checkedAt: new Date().toISOString() }, approvals: [], evidence: { entries: [], artifacts: [] }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as never;

describe("Computer Use model loop", () => {
  test("feeds structured observation to a fake provider and returns its final answer", async () => {
    clearRegistry(); clearInvocations();
    const browser = { observe: vi.fn(async (input) => ({ ok: true, sessionId: input.sessionId, invocationId: "observe", page: { url: "https://example.com", title: "Example", snapshotHash: "hash" }, observation: { snapshot: "button ref=e1" }, artifacts: [] })), act: vi.fn(), assert: vi.fn() };
    for (const tool of createComputerUseBrowserTools(browser as never)) registerTool(tool);
    const provider: ComputerUseModelProvider = { complete: vi.fn().mockResolvedValue({ message: { role: "assistant", content: "done" } }) };
    const executor = new ComputerUseModelExecutor({ browserSessionManager: { create: vi.fn().mockResolvedValue({ id: "session-1", status: "ready" }) }, modelProvider: provider });
    const result = await executor.runTask({ task, runtime: task.runtime });
    expect(result.status).toBe("succeeded");
    expect(provider.complete).toHaveBeenCalled();
    expect(JSON.stringify(provider.complete.mock.calls[0]?.[0].messages)).toContain("button ref=e1");
  });

  test("resumes by executing the frozen approved action before asking the model again", async () => {
    clearRegistry(); clearInvocations();
    const order: string[] = [];
    const browser = { observe: vi.fn(async (input) => ({ ok: true, sessionId: input.sessionId, invocationId: "observe", page: { url: "https://example.com", title: "Example", snapshotHash: "hash" }, observation: { snapshot: "button ref=e1" }, artifacts: [] })), act: vi.fn(async (input) => { order.push("act"); return { ok: true, sessionId: input.sessionId, invocationId: "act", page: { url: input.pageUrl, title: "Example", snapshotHash: input.snapshotHash }, artifacts: [] }; }), assert: vi.fn() };
    for (const tool of createComputerUseBrowserTools(browser as never)) registerTool(tool);
    const frozenArgs = { sessionId: "session-1", pageUrl: "https://example.com", snapshotHash: "hash", action: { kind: "click", ref: "e1" } };
    const provider: ComputerUseModelProvider = { complete: vi.fn(async ({ messages }) => { order.push("model"); return messages.length < 4 ? { message: { role: "assistant", content: "", tool_calls: [{ id: "call-1", type: "function", function: { name: "browser_act", arguments: JSON.stringify(frozenArgs) } }] } } : { message: { role: "assistant", content: "approved action completed" } }; }) };
    let approved = false;
    const executor = new ComputerUseModelExecutor({ browserSessionManager: { create: vi.fn().mockResolvedValue({ id: "session-1", status: "ready" }) }, modelProvider: provider, approvedInvocations: () => approved ? [{ toolId: "browser_act", inputHash: createHash(frozenArgs) }] : [] });
    const first = await executor.runTask({ task, runtime: task.runtime });
    expect(first.status).toBe("awaiting_approval");
    const approval = first.approvalRequest!;
    approved = true;
    const resumed = await executor.resumeTask({ task, approval, runtime: task.runtime });
    expect(resumed.status).toBe("succeeded");
    expect(browser.act).toHaveBeenCalledWith(frozenArgs);
    expect(order.indexOf("act")).toBeLessThan(order.lastIndexOf("model"));
  });

  test("returns a failed terminal result when the model provider times out", async () => {
    clearRegistry(); clearInvocations();
    const browser = { observe: vi.fn(async (input) => ({ ok: true, sessionId: input.sessionId, invocationId: "observe", page: { url: "https://example.com", title: "Example", snapshotHash: "hash" }, observation: { snapshot: "button ref=e1" }, artifacts: [] })), act: vi.fn(), assert: vi.fn() };
    for (const tool of createComputerUseBrowserTools(browser as never)) registerTool(tool);
    const provider: ComputerUseModelProvider = { complete: vi.fn(() => new Promise(() => undefined)) };
    const executor = new ComputerUseModelExecutor({ browserSessionManager: { create: vi.fn().mockResolvedValue({ id: "session-timeout", status: "ready" }) }, modelProvider: provider, modelTimeoutMs: 5 });
    const result = await executor.runTask({ task, runtime: task.runtime });
    expect(result.status).toBe("failed");
    expect(result.result?.error?.code).toBe("COMPUTER_USE_MODEL_TIMEOUT");
    expect(provider.complete).toHaveBeenCalled();
  });
});
