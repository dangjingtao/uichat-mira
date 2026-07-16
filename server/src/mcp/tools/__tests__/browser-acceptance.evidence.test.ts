import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { clearInvocations, executeInvocation } from "../../core/invocations.js";
import { clearRegistry, registerTool } from "../../core/registry.js";
import { createComputerUseBrowserTools } from "../browser-tools.tool.js";
import { ComputerUseModelExecutor, type ComputerUseModelProvider } from "../../../agent/computer-use/model-loop.js";

const evidenceRoot = path.resolve(process.cwd(), "..", ".test-artifact", "computer-use-acceptance", "mcp");
const writeEvidence = (name: string, value: unknown) => {
  fs.mkdirSync(evidenceRoot, { recursive: true });
  fs.writeFileSync(path.join(evidenceRoot, name), JSON.stringify(value, null, 2));
};

describe("Computer Use T122 MCP acceptance", () => {
  it("runs a fake-provider observation loop through Harness invocation", async () => {
    clearRegistry();
    clearInvocations();
    const browser = {
      observe: vi.fn(async (input: { sessionId: string }) => ({ ok: true, sessionId: input.sessionId, invocationId: "observe-1", page: { url: "https://example.com/", title: "Example Domain", snapshotHash: "hash-1" }, observation: { snapshot: "button ref=e1", visibleText: "Example Domain" }, artifacts: [] })),
      act: vi.fn(),
      assert: vi.fn(),
    };
    for (const tool of createComputerUseBrowserTools(browser as never)) registerTool(tool);
    const provider: ComputerUseModelProvider = { complete: vi.fn(async () => ({ message: { role: "assistant", content: "The page was observed." } })) };
    const executor = new ComputerUseModelExecutor({ browserSessionManager: { create: vi.fn(async () => ({ id: "session-1", status: "ready" })) }, modelProvider: provider });
    const task = { id: "acceptance-task", goal: "Observe the page", siteScope: ["example.com"], status: "running", runtime: { status: "ready", checkedAt: new Date().toISOString() }, approvals: [], evidence: { entries: [], artifacts: [] }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as never;
    const result = await executor.runTask({ task, runtime: task.runtime });
    expect(result.status).toBe("succeeded");
    expect(provider.complete).toHaveBeenCalled();
    writeEvidence("fake-provider-loop.json", { result, modelCalls: provider.complete.mock.calls.length });
  });

  it("preserves approval and rejects a changed snapshot", async () => {
    clearRegistry();
    clearInvocations();
    const act = createComputerUseBrowserTools({ observe: vi.fn(), act: vi.fn(), assert: vi.fn() } as never).find((tool) => tool.definition.id === "browser_act")!;
    registerTool(act);
    const args = { sessionId: "session-1", pageUrl: "https://example.com/", snapshotHash: "hash-1", action: { kind: "click", ref: "e1" } };
    const pending = await executeInvocation({ toolId: "browser_act", args });
    expect(pending.status).toBe("awaiting_approval");
    const changed = await executeInvocation({ toolId: "browser_act", args: { ...args, snapshotHash: "hash-2" }, approvedInvocations: [{ toolId: "browser_act", inputHash: "stale-hash" }] });
    expect(changed.status).toBe("awaiting_approval");
    writeEvidence("approval-boundary.json", { pending, changed });
  });
});
