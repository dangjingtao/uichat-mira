import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, vi } from "vitest";
import * as harnessInvocations from "@/mcp/harness/invocations";
import { getWorkspaceRoot } from "@/mcp/workspace";
import { createInvocationInputHash } from "../approval-fingerprint";
import { toolNode } from "../nodes/tool-node";
import type { AgentNodeState } from "../node-runtime";

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

test("toolNode remaps approvedInvocations to Harness arg hashes before execution", async () => {
  const frozenArgs = {
    command: "dir",
    cwd: "D:\\workspace\\rag-demo",
  };
  const executeHarnessInvocationSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-approved-terminal-1",
      toolId: "terminal_session",
      status: "completed",
      result: { command: "dir", stdout: "ok", stderr: "", exitCode: 0, timedOut: false },
      startedAt: "2026-07-04T00:00:00.000Z",
      finishedAt: "2026-07-04T00:00:01.000Z",
    });

  try {
    await toolNode(
      createBaseState({
        policyDecision: {
          type: "allow",
          toolId: "terminal_session",
          inputHash: "agent-frozen-hash",
          reason: "Allowed in test.",
        },
        approvedInvocations: [
          {
            toolId: "terminal_session",
            input: frozenArgs,
            inputHash: "agent-frozen-hash",
            approvedAt: "2026-07-04T00:00:00.000Z",
            approvalId: "approval-1",
          },
        ],
        pendingToolCall: {
          id: "pending-approved-terminal-1",
          toolId: "terminal_session",
          args: frozenArgs,
          inputHash: "agent-frozen-hash",
          source: "planner",
          status: "frozen",
          createdAt: "2026-07-04T00:00:00.000Z",
        },
      }),
    );

    assert.equal(executeHarnessInvocationSpy.mock.calls.length, 1);
    assert.deepEqual(executeHarnessInvocationSpy.mock.calls[0]?.[0].approvedInvocations, [
      {
        toolId: "terminal_session",
        inputHash: createInvocationInputHash(frozenArgs),
      },
    ]);
  } finally {
    executeHarnessInvocationSpy.mockRestore();
  }
});

test("toolNode passes workspaceRoot through to the invocation environment", async () => {
  const executeHarnessInvocationSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-workspace-1",
      toolId: "read_list",
      status: "completed",
      result: { entries: [] },
      startedAt: "2026-07-04T00:00:00.000Z",
      finishedAt: "2026-07-04T00:00:01.000Z",
    });

  try {
    await toolNode(
      createBaseState({
        workspaceRoot: "D:\\testData",
        policyDecision: {
          type: "allow",
          toolId: "read_list",
          inputHash: "hash-read-list",
          reason: "Allowed in test.",
        },
        pendingToolCall: {
          id: "pending-workspace-1",
          toolId: "read_list",
          args: { path: "." },
          inputHash: "hash-read-list",
          source: "planner",
          status: "frozen",
          createdAt: "2026-07-04T00:00:00.000Z",
        },
      }),
    );

    assert.equal(executeHarnessInvocationSpy.mock.calls.length, 1);
    assert.equal(
      executeHarnessInvocationSpy.mock.calls[0]?.[0].environment?.workspace.rootPath,
      "D:\\testData",
    );
  } finally {
    executeHarnessInvocationSpy.mockRestore();
  }
});

test("toolNode applies workspaceRoot as the active workspace during invocation execution", async () => {
  const workspaceRoot = path.join(
    os.tmpdir(),
    `rag-demo-tool-node-workspace-${process.pid}-${Date.now()}`,
  );
  fs.mkdirSync(workspaceRoot, { recursive: true });

  const executeHarnessInvocationSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockImplementation(async () => ({
      id: "invocation-workspace-override-1",
      toolId: "read_list",
      status: "completed",
      result: { activeWorkspaceRoot: getWorkspaceRoot() },
      startedAt: "2026-07-04T00:00:00.000Z",
      finishedAt: "2026-07-04T00:00:01.000Z",
    }));

  try {
    const result = await toolNode(
      createBaseState({
        workspaceRoot,
        policyDecision: {
          type: "allow",
          toolId: "read_list",
          inputHash: "hash-read-list-override",
          reason: "Allowed in test.",
        },
        pendingToolCall: {
          id: "pending-workspace-override-1",
          toolId: "read_list",
          args: { path: "." },
          inputHash: "hash-read-list-override",
          source: "planner",
          status: "frozen",
          createdAt: "2026-07-04T00:00:00.000Z",
        },
      }),
    );

    assert.equal(executeHarnessInvocationSpy.mock.calls.length, 1);
    assert.equal(
      result.lastToolExecution?.result &&
        typeof result.lastToolExecution.result === "object" &&
        "activeWorkspaceRoot" in result.lastToolExecution.result
        ? result.lastToolExecution.result.activeWorkspaceRoot
        : null,
      workspaceRoot,
    );
  } finally {
    executeHarnessInvocationSpy.mockRestore();
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
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
    assert.equal(result.pendingApproval?.toolCallId, pendingToolCall.id);
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
