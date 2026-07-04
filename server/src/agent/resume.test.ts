import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { agentGraph } from "./graph.js";
import { resumeApprovedAgentRun } from "./resume.js";
import { agentRunStore } from "./run-store.js";
import { createInvocationInputHash } from "./approval-fingerprint.js";
import { createAgentGoal, createAgentPlan } from "./nodes.js";
import * as messagePersistenceModule from "@/routes/proxy-provider/message-persistence.js";
import { threadService } from "@/services/thread.service.js";

test("resumeApprovedAgentRun resumes a pending run and keeps approval state", async () => {
  const approvedInput = { query: "hello" };
  const goal = createAgentGoal("answer the user");
  const run = agentRunStore.create({
    threadId: "thread-1",
    userId: 1,
    goal,
    plan: createAgentPlan(goal),
    assistantMessageId: "assistant-1",
    assistantParentId: "user-1",
    runtimeInput: {
      messages: [
        {
          role: "user",
          content: "hello",
          parts: [{ type: "text", text: "hello" }],
        },
      ],
      params: {},
    },
  });

  agentRunStore.update(run.id, {
    status: "waiting_approval",
    selectedCapabilityId: "web_research",
    pendingApproval: {
      id: "approval-1",
      runId: run.id,
      stepId: "approval",
      toolId: "web-search",
      toolCallId: "pending-1",
      reason: "needs approval",
      input: approvedInput,
      inputHash: createInvocationInputHash(approvedInput),
      createdAt: "2026-06-28T00:00:00.000Z",
    },
    pendingToolCall: {
      id: "pending-1",
      toolId: "web-search",
      args: approvedInput,
      inputHash: createInvocationInputHash(approvedInput),
      source: "planner",
      status: "frozen",
      createdAt: "2026-06-28T00:00:00.000Z",
    },
  });

  const runSpy = vi.spyOn(agentGraph, "run").mockImplementation(async (input) => {
    await input.onExecutionNode?.({
      nodeId: "agent-generate",
      nodeType: "generate",
      phase: "done",
      label: "组织最终回答",
      summary: "已恢复并生成最终回答",
    });
    return {
      answer: "done",
      observations: [],
      evidence: {
        observations: [],
        toolExecutions: [],
        retrievals: [],
      },
      retrievedChunks: [],
      status: "completed",
      contextBudget: {
        policy: "task-chat",
        model: "test-model",
        providerCode: "test-provider",
        modelContextTokens: 8192,
        reservedOutputTokens: 1024,
        maxInputTokens: 7168,
        totalEstimatedTokensBefore: 100,
        totalEstimatedTokensAfter: 90,
        sections: [],
        warnings: [],
      },
    } as never;
  });
  const persistAssistantMessageSpy = vi
    .spyOn(messagePersistenceModule, "persistAssistantMessage")
    .mockImplementation(() => {});
  const getMessageByIdSpy = vi
    .spyOn(threadService, "getMessageById")
    .mockReturnValue({
      id: "assistant-1",
      threadId: "thread-1",
      role: "assistant",
      content: "old assistant content",
      parts: [{ type: "text", text: "old assistant content" }],
      metadata: {},
      createdAt: "2026-06-28T00:00:00.000Z",
    });

  try {
    const result = await resumeApprovedAgentRun(run.id);

    assert.equal(runSpy.mock.calls.length, 1);
    assert.deepEqual(runSpy.mock.calls[0]?.[0].approvedInvocations, [
      {
        toolId: "web-search",
        input: approvedInput,
        inputHash: createInvocationInputHash(approvedInput),
        approvedAt: runSpy.mock.calls[0]?.[0].approvedInvocations?.[0]?.approvedAt,
        approvalId: "approval-1",
      },
    ]);
    assert.deepEqual(runSpy.mock.calls[0]?.[0].pendingToolCall, {
      id: "pending-1",
      toolId: "web-search",
      args: approvedInput,
      inputHash: createInvocationInputHash(approvedInput),
      source: "planner",
      status: "frozen",
      createdAt: "2026-06-28T00:00:00.000Z",
    });
    assert.equal(runSpy.mock.calls[0]?.[0].selectedToolId, "web-search");
    assert.equal(result.output.status, "completed");
    assert.equal(result.run?.status, "completed");
    assert.equal(result.run?.approvedInvocations?.length, 1);
    assert.deepEqual(result.run?.approvedInvocations?.[0], {
      toolId: "web-search",
      input: approvedInput,
      inputHash: createInvocationInputHash(approvedInput),
      approvedAt: result.run?.approvedInvocations?.[0]?.approvedAt,
      approvalId: "approval-1",
    });
    assert.equal(result.run?.selectedToolId, "web-search");
    assert.equal(result.run?.pendingApproval, undefined);
    assert.equal(result.run?.pendingToolCall, undefined);
    assert.equal(result.run?.contextBudget?.policy, "task-chat");
    assert.equal(persistAssistantMessageSpy.mock.calls.length, 1);
    assert.deepEqual(persistAssistantMessageSpy.mock.calls[0]?.[0], {
      threadId: "thread-1",
      userId: 1,
      assistantMessageId: "assistant-1",
      parentId: "user-1",
      content: "done",
      parts: [
        { type: "text", text: "done" },
        {
          type: "data",
          name: "execution-node",
          value: {
            nodeId: "agent-generate",
            nodeType: "generate",
            phase: "done",
            label: "组织最终回答",
            summary: "已恢复并生成最终回答",
          },
        },
      ],
      metadata: {
        agent: {
          status: "completed",
          runId: run.id,
          traceId: result.run?.traceId,
        },
      },
    });
  } finally {
    runSpy.mockRestore();
    persistAssistantMessageSpy.mockRestore();
    getMessageByIdSpy.mockRestore();
    agentRunStore.clear();
  }
});

test("resumeApprovedAgentRun updates assistant message when run returns waiting approval again", async () => {
  const approvedInput = { query: "hello" };
  const goal = createAgentGoal("answer the user");
  const run = agentRunStore.create({
    threadId: "thread-1",
    userId: 1,
    goal,
    plan: createAgentPlan(goal),
    assistantMessageId: "assistant-1",
    assistantParentId: "user-1",
    runtimeInput: {
      messages: [
        {
          role: "user",
          content: "hello",
          parts: [{ type: "text", text: "hello" }],
        },
      ],
      params: {},
    },
  });

  agentRunStore.update(run.id, {
    status: "waiting_approval",
    pendingApproval: {
      id: "approval-1",
      runId: run.id,
      stepId: "approval",
      toolId: "web-search",
      toolCallId: "pending-2",
      reason: "needs approval",
      input: approvedInput,
      inputHash: createInvocationInputHash(approvedInput),
      createdAt: "2026-06-28T00:00:00.000Z",
    },
    pendingToolCall: {
      id: "pending-2",
      toolId: "web-search",
      args: approvedInput,
      inputHash: createInvocationInputHash(approvedInput),
      source: "planner",
      status: "frozen",
      createdAt: "2026-06-28T00:00:00.000Z",
    },
  });

  const runSpy = vi.spyOn(agentGraph, "run").mockImplementation(async (input) => {
    await input.onExecutionNode?.({
      nodeId: "agent-approval",
      nodeType: "approval",
      phase: "done",
      label: "审批节点",
      summary: "已进入审批等待",
    });
    return {
      answer: "waiting",
      observations: [],
      evidence: {
        observations: [],
        toolExecutions: [],
        retrievals: [],
      },
      retrievedChunks: [],
      status: "waiting_approval",
      pendingApproval: {
        id: "approval-2",
        runId: run.id,
        stepId: "approval-2",
        toolId: "terminal_session",
        toolCallId: "pending-approval-2",
        reason: "needs more approval",
        inputHash: "hash-2",
        createdAt: "2026-06-28T00:01:00.000Z",
      },
    } as never;
  });
  const persistAssistantMessageSpy = vi
    .spyOn(messagePersistenceModule, "persistAssistantMessage")
    .mockImplementation(() => {});
  const getMessageByIdSpy = vi
    .spyOn(threadService, "getMessageById")
    .mockReturnValue({
      id: "assistant-1",
      threadId: "thread-1",
      role: "assistant",
      content: "old assistant content",
      parts: [{ type: "text", text: "old assistant content" }],
      metadata: {},
      createdAt: "2026-06-28T00:00:00.000Z",
    });

  try {
    const result = await resumeApprovedAgentRun(run.id);

    assert.equal(result.run?.status, "waiting_approval");
    assert.equal(result.run?.selectedToolId, "terminal_session");
    assert.equal(persistAssistantMessageSpy.mock.calls.length, 1);
    assert.deepEqual(persistAssistantMessageSpy.mock.calls[0]?.[0], {
      threadId: "thread-1",
      userId: 1,
      assistantMessageId: "assistant-1",
      parentId: "user-1",
      content: "waiting",
      parts: [
        { type: "text", text: "waiting" },
        {
          type: "data",
          name: "execution-node",
          value: {
            nodeId: "agent-approval",
            nodeType: "approval",
            phase: "done",
            label: "审批节点",
            summary: "已进入审批等待",
          },
        },
      ],
      metadata: {
        agent: {
          status: "waiting_approval",
          runId: run.id,
          traceId: result.run?.traceId,
          pendingApproval: {
            id: "approval-2",
            runId: run.id,
            stepId: "approval-2",
            toolId: "terminal_session",
            toolCallId: "pending-approval-2",
            reason: "needs more approval",
            inputHash: "hash-2",
            createdAt: "2026-06-28T00:01:00.000Z",
          },
        },
      },
    });
  } finally {
    runSpy.mockRestore();
    persistAssistantMessageSpy.mockRestore();
    getMessageByIdSpy.mockRestore();
    agentRunStore.clear();
  }
});

test("resumeApprovedAgentRun updates assistant message when resumed run fails", async () => {
  const approvedInput = { query: "hello" };
  const goal = createAgentGoal("answer the user");
  const run = agentRunStore.create({
    threadId: "thread-1",
    userId: 1,
    goal,
    plan: createAgentPlan(goal),
    assistantMessageId: "assistant-1",
    assistantParentId: "user-1",
    runtimeInput: {
      messages: [
        {
          role: "user",
          content: "hello",
          parts: [{ type: "text", text: "hello" }],
        },
      ],
      params: {},
    },
  });

  agentRunStore.update(run.id, {
    status: "waiting_approval",
    pendingApproval: {
      id: "approval-1",
      runId: run.id,
      stepId: "approval",
      toolId: "web-search",
      toolCallId: "pending-3",
      reason: "needs approval",
      input: approvedInput,
      inputHash: createInvocationInputHash(approvedInput),
      createdAt: "2026-06-28T00:00:00.000Z",
    },
    pendingToolCall: {
      id: "pending-3",
      toolId: "web-search",
      args: approvedInput,
      inputHash: createInvocationInputHash(approvedInput),
      source: "planner",
      status: "frozen",
      createdAt: "2026-06-28T00:00:00.000Z",
    },
  });

  const runSpy = vi.spyOn(agentGraph, "run").mockImplementation(async (input) => {
    await input.onExecutionNode?.({
      nodeId: "agent-error",
      nodeType: "error",
      phase: "error",
      label: "错误节点",
      summary: "Harness execution failed.",
    });
    return {
      answer: "",
      observations: [],
      evidence: {
        observations: [],
        toolExecutions: [],
        retrievals: [],
      },
      retrievedChunks: [],
      status: "failed",
      errorMessage: "Harness execution failed.",
    } as never;
  });
  const persistAssistantMessageSpy = vi
    .spyOn(messagePersistenceModule, "persistAssistantMessage")
    .mockImplementation(() => {});
  const getMessageByIdSpy = vi
    .spyOn(threadService, "getMessageById")
    .mockReturnValue({
      id: "assistant-1",
      threadId: "thread-1",
      role: "assistant",
      content: "old assistant content",
      parts: [{ type: "text", text: "old assistant content" }],
      metadata: {},
      createdAt: "2026-06-28T00:00:00.000Z",
    });

  try {
    const result = await resumeApprovedAgentRun(run.id);

    assert.equal(result.run?.status, "failed");
    assert.equal(result.run?.selectedToolId, "web-search");
    assert.equal(persistAssistantMessageSpy.mock.calls.length, 1);
    assert.deepEqual(persistAssistantMessageSpy.mock.calls[0]?.[0], {
      threadId: "thread-1",
      userId: 1,
      assistantMessageId: "assistant-1",
      parentId: "user-1",
      content: "old assistant content",
      parts: [
        { type: "text", text: "old assistant content" },
        {
          type: "data",
          name: "execution-node",
          value: {
            nodeId: "agent-error",
            nodeType: "error",
            phase: "error",
            label: "错误节点",
            summary: "Harness execution failed.",
          },
        },
      ],
      metadata: {
        agent: {
          status: "failed",
          runId: run.id,
          traceId: result.run?.traceId,
          errorMessage: "Harness execution failed.",
        },
      },
    });
  } finally {
    runSpy.mockRestore();
    persistAssistantMessageSpy.mockRestore();
    getMessageByIdSpy.mockRestore();
    agentRunStore.clear();
  }
});

test("resumeApprovedAgentRun blocks execution when approval toolCallId does not match the frozen pendingToolCall", async () => {
  const approvedInput = { query: "hello" };
  const goal = createAgentGoal("answer the user");
  const run = agentRunStore.create({
    threadId: "thread-1",
    userId: 1,
    goal,
    plan: createAgentPlan(goal),
    runtimeInput: {
      messages: [
        {
          role: "user",
          content: "hello",
          parts: [{ type: "text", text: "hello" }],
        },
      ],
      params: {},
    },
  });

  agentRunStore.update(run.id, {
    status: "waiting_approval",
    pendingApproval: {
      id: "approval-mismatch-1",
      runId: run.id,
      stepId: "approval",
      toolId: "web-search",
      toolCallId: "pending-other",
      reason: "needs approval",
      input: approvedInput,
      inputHash: createInvocationInputHash(approvedInput),
      createdAt: "2026-06-28T00:00:00.000Z",
    },
    pendingToolCall: {
      id: "pending-actual",
      toolId: "web-search",
      args: approvedInput,
      inputHash: createInvocationInputHash(approvedInput),
      source: "planner",
      status: "frozen",
      createdAt: "2026-06-28T00:00:00.000Z",
    },
  });

  const runSpy = vi.spyOn(agentGraph, "run");
  const persistAssistantMessageSpy = vi
    .spyOn(messagePersistenceModule, "persistAssistantMessage")
    .mockImplementation(() => {});
  const getMessageByIdSpy = vi
    .spyOn(threadService, "getMessageById")
    .mockReturnValue({
      id: "assistant-mismatch-1",
      threadId: "thread-1",
      role: "assistant",
      content: "等待审批",
      parts: [{ type: "text", text: "等待审批" }],
      metadata: {},
      createdAt: "2026-06-28T00:00:00.000Z",
    });
  agentRunStore.update(run.id, {
    assistantMessageId: "assistant-mismatch-1",
    assistantParentId: "user-1",
  });

  try {
    await assert.rejects(
      () => resumeApprovedAgentRun(run.id),
      /approved toolCallId pending-other does not match frozen pendingToolCall\.id pending-actual/i,
    );

    assert.equal(runSpy.mock.calls.length, 0);
    const blockedRun = agentRunStore.get(run.id);
    assert.equal(blockedRun?.status, "blocked");
    assert.equal(blockedRun?.pendingApproval, undefined);
    assert.equal(blockedRun?.pendingToolCall, undefined);
    assert.equal(blockedRun?.selectedToolId, undefined);
    assert.equal(blockedRun?.terminalReason, "approval_resume_mismatch");
    assert.match(
      blockedRun?.blockedReason ?? "",
      /approved toolCallId pending-other does not match frozen pendingToolCall\.id pending-actual/i,
    );
    assert.equal(persistAssistantMessageSpy.mock.calls.length, 1);
    assert.deepEqual(persistAssistantMessageSpy.mock.calls[0]?.[0], {
      threadId: "thread-1",
      userId: 1,
      assistantMessageId: "assistant-mismatch-1",
      parentId: "user-1",
      content: "审批对象与待执行工具不一致，已阻断本次执行，工具没有运行。",
      parts: [
        {
          type: "text",
          text: "审批对象与待执行工具不一致，已阻断本次执行，工具没有运行。",
        },
      ],
      metadata: {
        agent: {
          status: "blocked",
          runId: run.id,
          traceId: blockedRun?.traceId,
          blockedReason: blockedRun?.blockedReason,
          terminalReason: "approval_resume_mismatch",
        },
      },
    });
  } finally {
    runSpy.mockRestore();
    persistAssistantMessageSpy.mockRestore();
    getMessageByIdSpy.mockRestore();
    agentRunStore.clear();
  }
});
