import assert from "node:assert/strict";
import { test, vi } from "vitest";
import * as harnessInvocations from "@/harness/invocations";
import { createInitialAgentGraphState } from "../graph/state";
import { buildPlannerObservationContext } from "../node-runtime";
import { prepareContextNode } from "../nodes/prepare-context";
import { retrieveNode } from "../nodes/retrieve";
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
    successCriteria: ["inspect docs", "report findings"],
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

test("createInitialAgentGraphState initializes the runtime-minimum currentTaskFrame from goal when no newer user question exists", () => {
  const state = createInitialAgentGraphState({
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
    selectedToolId: "legacy-tool-should-not-enter-state",
  });

  assert.equal("selectedToolId" in state, false);
  assert.deepEqual(state.currentTaskFrame, {
    currentGoal: "inspect docs",
    currentSubtask: "Prepare context and determine the next action.",
    currentBlocker: undefined,
    confirmedObjects: [],
    completionCriteria: ["inspect docs"],
  });
});

test("createInitialAgentGraphState prefers the latest user question over goal text when initializing currentTaskFrame", () => {
  const state = createInitialAgentGraphState({
    runId: "run-1",
    threadId: "thread-1",
    userId: 1,
    goal: {
      id: "goal-1",
      text: "historic goal text",
      successCriteria: ["report findings"],
      constraints: [],
      riskLevel: "low",
    },
    plan: {
      id: "plan-1",
      goalId: "goal-1",
      version: 1,
      steps: [],
    },
    messages: [
      {
        role: "user",
        content: "Please inspect docs/README.md",
        parts: [{ type: "text", text: "Please inspect docs/README.md" }],
      },
    ],
  });

  assert.equal(
    state.currentTaskFrame?.currentGoal,
    "Please inspect docs/README.md",
  );
  assert.deepEqual(state.currentTaskFrame?.completionCriteria, ["report findings"]);
});

test("prepareContextNode keeps the initialized currentTaskFrame unchanged", async () => {
  const initialState = createInitialAgentGraphState({
    runId: "run-1",
    threadId: "thread-1",
    userId: 1,
    goal: {
      id: "goal-1",
      text: "inspect docs",
      successCriteria: ["inspect docs", "report findings"],
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
    workspaceRoot: "D:\\workspace\\rag-demo",
    knowledgeBaseId: "kb-1",
  });

  const patch = await prepareContextNode(
    createBaseState({
      workspaceRoot: "D:\\workspace\\rag-demo",
      knowledgeBaseId: "kb-1",
      currentTaskFrame: initialState.currentTaskFrame,
    }),
  );

  assert.deepEqual(patch.toolExposure?.exposedTools, []);
  assert.equal(patch.toolIntent?.query, "inspect docs");
  assert.deepEqual(initialState.currentTaskFrame, {
    currentGoal: "inspect docs",
    currentSubtask: "Prepare context and determine the next action.",
    currentBlocker: undefined,
    confirmedObjects: [
      {
        type: "file",
        id: "D:\\workspace\\rag-demo",
        label: "D:\\workspace\\rag-demo",
        confidence: 1,
      },
      {
        type: "knowledge",
        id: "kb-1",
        label: "kb-1",
        confidence: 1,
      },
    ],
    completionCriteria: ["inspect docs", "report findings"],
  });
});

test("retrieveNode does not write currentTaskFrame when no knowledge base is bound", async () => {
  const patch = await retrieveNode(
    createBaseState({
      currentTaskFrame: {
        currentGoal: "inspect docs",
        currentSubtask: "Gather evidence",
        currentBlocker: undefined,
        confirmedObjects: [],
        completionCriteria: ["inspect docs"],
      },
      messages: [
        {
          role: "user",
          content: "inspect docs",
          parts: [{ type: "text", text: "inspect docs" }],
        },
      ],
    }),
  );

  assert.equal("currentTaskFrame" in patch, false);
});

test("toolNode does not write currentTaskFrame", async () => {
  const executeHarnessInvocationSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-1",
      toolId: "read_open",
      status: "completed",
      result: { ok: true },
      startedAt: "2026-07-06T00:00:00.000Z",
      finishedAt: "2026-07-06T00:00:01.000Z",
    });

  try {
    const patch = await toolNode(
      createBaseState({
        currentTaskFrame: {
          currentGoal: "inspect docs",
          currentSubtask: "Gather evidence",
          currentBlocker: "Old blocker",
          confirmedObjects: [
            {
              type: "knowledge",
              id: "kb-1",
              label: "kb-1",
              confidence: 1,
            },
          ],
          completionCriteria: ["inspect docs"],
        },
        policyDecision: {
          type: "allow",
          toolId: "read_open",
          inputHash: "hash-read-open",
          reason: "Allowed in test.",
        },
        pendingToolCall: {
          id: "pending-1",
          toolId: "read_open",
          args: { path: "README.md" },
          inputHash: "hash-read-open",
          source: "planner",
          status: "frozen",
          createdAt: "2026-07-06T00:00:00.000Z",
        },
      }),
    );

    assert.equal(executeHarnessInvocationSpy.mock.calls.length, 1);
    assert.equal("currentTaskFrame" in patch, false);
  } finally {
    executeHarnessInvocationSpy.mockRestore();
  }
});

test("buildPlannerObservationContext carries currentTaskFrame into the planner observation view", () => {
  const state = createInitialAgentGraphState({
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
  });

  const context = buildPlannerObservationContext(state);
  assert.deepEqual(context.currentTaskFrame, state.currentTaskFrame);
});
