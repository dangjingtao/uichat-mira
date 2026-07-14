import { describe, expect, test, vi } from "vitest";
import { createComputerUseBrowserTools } from "./browser-tools.tool.js";
import { clearInvocations, executeInvocation } from "../core/invocations.js";
import { clearRegistry, registerTool } from "../core/registry.js";

const browser = {
  observe: vi.fn(async (input) => ({ ok: true, sessionId: input.sessionId, invocationId: "browser-observe", page: { url: "https://example.com", title: "Example", snapshotHash: "hash-1" }, artifacts: [] })),
  act: vi.fn(async (input) => ({ ok: true, sessionId: input.sessionId, invocationId: "browser-act", page: { url: input.pageUrl, title: "Example", snapshotHash: input.snapshotHash }, artifacts: [] })),
  assert: vi.fn(async (input) => ({ ok: true, sessionId: input.sessionId, invocationId: "browser-assert", page: { url: "https://example.com", title: "Example" }, assertion: { kind: input.assertion.kind, passed: true }, artifacts: [] })),
};

describe("Computer Use browser MCP tools", () => {
  test("exposes exactly the three strict browser tools", () => {
    const tools = createComputerUseBrowserTools(browser as never);
    expect(tools.map((tool) => tool.definition.id)).toEqual(["browser_observe", "browser_act", "browser_assert"]);
    expect(tools.every((tool) => tool.definition.inputSchema.additionalProperties === false)).toBe(true);
    expect(tools.find((tool) => tool.definition.id === "browser_act")?.definition.capabilities.requiresApproval).toBe(true);
  });

  test("approval is invalidated when page or snapshot arguments change", async () => {
    clearRegistry();
    clearInvocations();
    const act = createComputerUseBrowserTools(browser as never).find((tool) => tool.definition.id === "browser_act")!;
    registerTool(act);
    const args = { sessionId: "session-1", pageUrl: "https://example.com", snapshotHash: "hash-1", action: { kind: "click", ref: "e1" } };
    const pending = await executeInvocation({ toolId: "browser_act", args });
    expect(pending.status).toBe("awaiting_approval");
    const changed = await executeInvocation({ toolId: "browser_act", args: { ...args, snapshotHash: "hash-2" }, approvedInvocations: [{ toolId: "browser_act", inputHash: "invalid" }] });
    expect(changed.status).toBe("awaiting_approval");
    expect(browser.act).not.toHaveBeenCalled();
  });

  test("rejects action and assertion variants with missing type-specific fields", async () => {
    clearRegistry();
    clearInvocations();
    const tools = createComputerUseBrowserTools(browser as never);
    registerTool(tools.find((tool) => tool.definition.id === "browser_act")!);
    await expect(executeInvocation({ toolId: "browser_act", args: { sessionId: "s", pageUrl: "https://example.com", snapshotHash: "h", action: { kind: "click" } } })).rejects.toThrow(/schema variant/);
    clearRegistry();
    registerTool(tools.find((tool) => tool.definition.id === "browser_assert")!);
    await expect(executeInvocation({ toolId: "browser_assert", args: { sessionId: "s", assertion: { kind: "title" } } })).rejects.toThrow(/schema variant/);
  });
});
