import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  createThreadMemoryContextPrompt,
  resolveMemoryContext,
} from "./thread-request-context-memory.resolver.js";

describe("resolveMemoryContext", () => {
  it("returns null when memory context is missing", () => {
    const context = resolveMemoryContext({
      thread: {
        roleId: null,
        contextSummary: null,
        contextSummaryUpdatedAt: null,
        memoryContext: null,
        memoryContextUpdatedAt: null,
        agentEnabled: false,
      },
      userId: 1,
    });

    assert.equal(context, null);
  });

  it("creates a request-only memory prompt when memory context exists", () => {
    const context = resolveMemoryContext({
      thread: {
        roleId: null,
        contextSummary: null,
        contextSummaryUpdatedAt: null,
        memoryContext: "用户长期偏好：优先看结论，再展开理由。",
        memoryContextUpdatedAt: "2026-06-27T00:00:00.000Z",
        agentEnabled: false,
      },
      userId: 1,
    });

    assert.ok(context);
    assert.equal(context?.message?.role, "system");
    assert.match(context?.message?.content ?? "", /长期记忆/);
    assert.match(context?.message?.content ?? "", /优先看结论/);
    assert.equal(context?.executionNode?.nodeType, "memory");
  });

  it("uses the shared memory prompt builder", () => {
    const prompt = createThreadMemoryContextPrompt("记住用户偏好简洁回答。");
    assert.match(prompt, /长期记忆/);
    assert.match(prompt, /简洁回答/);
  });
});
