import assert from "node:assert/strict";
import { test, vi } from "vitest";
import * as harnessInvocations from "@/mcp/harness/invocations.js";
import { toolNode } from "./tool-node.js";
import type { AgentNodeState } from "./node-runtime.js";

const createBaseState = (
  overrides: Partial<AgentNodeState> = {},
): AgentNodeState => ({
  runId: "run-1",
  threadId: "thread-1",
  userId: 1,
  goal: {
    id: "goal-1",
    text: "inspect docs",
    successCriteria: ["inspect docs"],
    constraints: [],
    riskLevel: "low",
  },
  plan: {
    id: "plan-1",
    goalId: "goal-1",
    version: 1,
    steps: [],
  },
  messages: [],
  ...overrides,
});

test("toolNode executes the frozen pendingToolCall without rebuilding args", async () => {
  const executeHarnessInvocationSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-1",
      toolId: "web_search",
      status: "completed",
      result: { ok: true },
      startedAt: "2026-06-30T00:00:00.000Z",
      finishedAt: "2026-06-30T00:00:01.000Z",
    });

  try {
    const result = await toolNode(
      createBaseState({
        policyDecision: {
          type: "allow",
          toolId: "web_search",
          inputHash: "hash-frozen-query",
          reason: "Allowed in test.",
        },
        pendingToolCall: {
          id: "pending-1",
          toolId: "web_search",
          args: { query: "frozen query" },
          inputHash: "hash-frozen-query",
          source: "planner",
          status: "frozen",
          createdAt: "2026-06-30T00:00:00.000Z",
        },
      }),
    );

    assert.equal(executeHarnessInvocationSpy.mock.calls.length, 1);
    assert.deepEqual(executeHarnessInvocationSpy.mock.calls[0]?.[0], {
      toolId: "web_search",
      args: { query: "frozen query" },
      userId: 1,
      threadId: "thread-1",
      approvedInvocations: undefined,
    });
    assert.equal(result.lastToolExecution?.status, "completed");
    assert.equal(result.lastToolExecution?.toolCallId, "pending-1");
    assert.equal(result.lastToolExecution?.inputHash, "hash-frozen-query");
    assert.deepEqual(result.lastToolExecution?.args, { query: "frozen query" });
    assert.equal(result.lastToolExecution?.toolId, "web_search");
    assert.equal(result.errorMessage, undefined);
    assert.equal(result.pendingToolCall, undefined);
  } finally {
    executeHarnessInvocationSpy.mockRestore();
  }
});

test("toolNode blocks execution when pendingToolCall is missing", async () => {
  const executeHarnessInvocationSpy = vi.spyOn(
    harnessInvocations,
    "executeHarnessInvocation",
  );

  try {
    const result = await toolNode(
      createBaseState({
        selectedToolId: "terminal_session",
      }),
    );

    assert.equal(executeHarnessInvocationSpy.mock.calls.length, 0);
    assert.equal(result.pendingToolCall, undefined);
    assert.match(result.errorMessage ?? "", /No pendingToolCall available/i);
    assert.equal(result.errorSourceNodeId, "agent-tool");
  } finally {
    executeHarnessInvocationSpy.mockRestore();
  }
});

test("toolNode ignores selectedToolId drift and only executes the frozen pendingToolCall", async () => {
  const executeHarnessInvocationSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-2",
      toolId: "web_search",
      status: "completed",
      result: { ok: true },
      startedAt: "2026-06-30T00:00:00.000Z",
      finishedAt: "2026-06-30T00:00:01.000Z",
    });

  try {
    const result = await toolNode(
      createBaseState({
        selectedToolId: "terminal_session",
        policyDecision: {
          type: "allow",
          toolId: "web_search",
          inputHash: "hash-frozen-query",
          reason: "Allowed in test.",
        },
        pendingToolCall: {
          id: "pending-2",
          toolId: "web_search",
          args: { query: "frozen query" },
          inputHash: "hash-frozen-query",
          source: "planner",
          status: "frozen",
          createdAt: "2026-06-30T00:00:00.000Z",
        },
      }),
    );

    assert.equal(executeHarnessInvocationSpy.mock.calls.length, 1);
    assert.equal(result.lastToolExecution?.toolId, "web_search");
    assert.equal(result.pendingToolCall, undefined);
    assert.equal(result.errorMessage, undefined);
  } finally {
    executeHarnessInvocationSpy.mockRestore();
  }
});

test("toolNode keeps frozen pendingToolCall when Harness requests approval", async () => {
  const executeHarnessInvocationSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-awaiting-approval-1",
      toolId: "terminal_session",
      status: "awaiting_approval",
      approval: {
        reason: "terminal_session requires reviewed approval.",
      },
      startedAt: "2026-07-04T00:00:00.000Z",
    } as never);

  const pendingToolCall = {
    id: "pending-approval-1",
    toolId: "terminal_session",
    args: {
      command: "dir",
      cwd: "D:\\workspace\\rag-demo",
    },
    inputHash: "hash-terminal-dir",
    source: "planner" as const,
    status: "frozen" as const,
    createdAt: "2026-07-04T00:00:00.000Z",
  };

  try {
    const result = await toolNode(
      createBaseState({
        policyDecision: {
          type: "allow",
          toolId: pendingToolCall.toolId,
          inputHash: pendingToolCall.inputHash,
          reason: "Allowed in test.",
        },
        pendingToolCall,
      }),
    );

    assert.equal(executeHarnessInvocationSpy.mock.calls.length, 1);
    assert.equal(result.pendingApproval?.toolId, "terminal_session");
    assert.equal(result.pendingApproval?.inputHash, pendingToolCall.inputHash);
    assert.deepEqual(result.pendingToolCall, pendingToolCall);
    assert.equal(result.selectedToolId, undefined);
    assert.equal(result.lastToolExecution?.status, "awaiting_approval");
    assert.equal(result.lastToolExecution?.toolCallId, pendingToolCall.id);
    assert.equal(result.lastToolExecution?.approval?.inputHash, pendingToolCall.inputHash);
    assert.equal(result.policyDecision?.type, "require_approval");
  } finally {
    executeHarnessInvocationSpy.mockRestore();
  }
});

test("toolNode blocks execution when policy has not explicitly allowed the frozen call", async () => {
  const executeHarnessInvocationSpy = vi.spyOn(
    harnessInvocations,
    "executeHarnessInvocation",
  );

  try {
    const result = await toolNode(
      createBaseState({
        policyDecision: {
          type: "require_approval",
          toolId: "web_search",
          inputHash: "hash-frozen-query",
          reason: "Still pending approval.",
        },
        pendingToolCall: {
          id: "pending-3",
          toolId: "web_search",
          args: { query: "frozen query" },
          inputHash: "hash-frozen-query",
          source: "planner",
          status: "frozen",
          createdAt: "2026-06-30T00:00:00.000Z",
        },
      }),
    );

    assert.equal(executeHarnessInvocationSpy.mock.calls.length, 0);
    assert.equal(result.pendingToolCall, undefined);
    assert.match(result.errorMessage ?? "", /Policy decision does not allow|No policy allow decision/i);
    assert.equal(result.errorSourceNodeId, "agent-tool");
  } finally {
    executeHarnessInvocationSpy.mockRestore();
  }
});

test("toolNode blocks execution when policy inputHash does not match the frozen call", async () => {
  const executeHarnessInvocationSpy = vi.spyOn(
    harnessInvocations,
    "executeHarnessInvocation",
  );

  try {
    const result = await toolNode(
      createBaseState({
        policyDecision: {
          type: "allow",
          toolId: "web_search",
          inputHash: "different-hash",
          reason: "Mismatched approval.",
        },
        pendingToolCall: {
          id: "pending-4",
          toolId: "web_search",
          args: { query: "frozen query" },
          inputHash: "hash-frozen-query",
          source: "planner",
          status: "frozen",
          createdAt: "2026-06-30T00:00:00.000Z",
        },
      }),
    );

    assert.equal(executeHarnessInvocationSpy.mock.calls.length, 0);
    assert.equal(result.pendingToolCall, undefined);
    assert.match(
      result.errorMessage ?? "",
      /Policy decision does not allow this frozen pendingToolCall/i,
    );
    assert.equal(result.errorSourceNodeId, "agent-tool");
  } finally {
    executeHarnessInvocationSpy.mockRestore();
  }
});
