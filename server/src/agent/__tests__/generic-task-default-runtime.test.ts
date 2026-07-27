import assert from "node:assert/strict";
import { test } from "vitest";
import { GENERIC_TASK_DELEGATE_TOOL_ID } from "../delegation/contract.js";
import {
  routeAfterEvidence,
  routeAfterPrepareContext,
} from "../graph/routes.js";
import type { AgentNodeState } from "../node-runtime.js";
import { createAgentGoal } from "../nodes/goal-plan.js";
import { createGenericTaskSubAgentNode } from "../nodes/generic-task-subagent.js";
import { createPiAgentLoop, type PiAgentLoopNodes } from "../pi-loop/index.js";
import type {
  AgentGraphInput,
  AgentNextAction,
  AgentObservation,
} from "../types.js";

const delegatedGoal = "Inspect the target module and verify the bounded change.";
const acceptanceCriteria = ["target module inspected", "verification recorded"];

const createObservation = (status = "completed"): AgentObservation => ({
  id: `observation-${status}`,
  runId: "run-default-delegation",
  stepId: "subagent:mira.generic-task",
  status: status === "completed" ? "ok" : "partial",
  facts: [`subAgent status: ${status}`],
  summary: {
    source: "observation",
    status: status === "completed" ? "completed" : "partial",
    actionTaken: "Executed one bounded delegated task.",
    keyFindings: [`status=${status}`],
    data: {
      kind: "generic_structured",
      preview: {
        skillId: "mira.generic-task",
        status,
        requirements: [],
        trace: { toolCalls: ["read_open"] },
      },
      truncated: false,
      redacted: false,
      unsupported: false,
    },
  },
  createdAt: "2026-07-27T00:00:00.000Z",
});

const createInput = (): AgentGraphInput => ({
  runId: "run-default-delegation",
  threadId: "thread-default-delegation",
  userId: 1,
  goal: createAgentGoal("Complete the larger user request."),
  messages: [
    {
      role: "user",
      content: "Complete the larger user request.",
      parts: [{ type: "text", text: "Complete the larger user request." }],
    },
  ],
  maxIterations: 4,
});

const createRuntime = (calls: string[]): PiAgentLoopNodes => {
  let plannerIndex = 0;
  const actions: AgentNextAction[] = [
    {
      type: "use_tool",
      toolId: GENERIC_TASK_DELEGATE_TOOL_ID,
      args: { goal: delegatedGoal, acceptanceCriteria },
      reason: "Delegate one coherent multi-step task.",
    },
    {
      type: "answer",
      reason: "The delegated evidence covers the global completion criterion.",
      completionProof: [
        {
          criterion: "bounded delegated task completed",
          evidenceRefs: ["observation:0"],
        },
      ],
      unresolvedGaps: [],
    },
  ];

  return {
    prepareContext: async () => {
      calls.push("prepare");
      return {
        toolExposure: {
          exposedTools: ["read_open", GENERIC_TASK_DELEGATE_TOOL_ID],
          toolMeta: [],
        },
      };
    },
    planner: async () => {
      calls.push("planner");
      const action = actions[plannerIndex++];
      assert.ok(action);
      return action.type === "answer"
        ? { nextAction: action, finalizationPacket: action }
        : { nextAction: action };
    },
    delegateTask: async (state) => {
      calls.push("delegate");
      assert.equal(state.nextAction?.type, "use_tool");
      assert.equal(
        state.nextAction?.type === "use_tool" ? state.nextAction.toolId : undefined,
        GENERIC_TASK_DELEGATE_TOOL_ID,
      );
      return { pendingEvidenceObservation: createObservation() };
    },
    normalizeToolCall: async () => {
      calls.push("normalize");
      return {
        errorMessage: "delegate_task must never enter Harness normalization.",
        errorSourceNodeId: "toolCallNormalize",
      };
    },
    policy: async () => ({}),
    approval: async () => ({}),
    retrieve: async () => ({}),
    tool: async () => ({}),
    evidence: async (state) => {
      calls.push("evidence");
      const observation = state.pendingEvidenceObservation;
      return {
        evidence: {
          observations: observation
            ? [...(state.evidence?.observations ?? []), observation]
            : state.evidence?.observations ?? [],
          retrievals: state.evidence?.retrievals ?? [],
          toolExecutions: state.evidence?.toolExecutions ?? [],
          latestSummary: observation?.summary ?? state.evidence?.latestSummary,
        },
        pendingEvidenceObservation: undefined,
      };
    },
    generate: async () => {
      calls.push("generate");
      return { answer: "Delegated task accepted." };
    },
    evaluate: async () => {
      calls.push("evaluate");
      return { terminalReason: "completed" };
    },
    error: async (state) => ({
      errorMessage: state.errorMessage ?? "unexpected runtime error",
    }),
  };
};

test("default Pi-loop protocol dispatch bypasses Harness normalization", async () => {
  const calls: string[] = [];
  const output = await createPiAgentLoop(createRuntime(calls)).run(createInput());

  assert.equal(output.status, "completed");
  assert.equal(output.answer, "Delegated task accepted.");
  assert.equal(output.evidence.observations.length, 1);
  assert.deepEqual(calls, [
    "prepare",
    "planner",
    "delegate",
    "evidence",
    "planner",
    "generate",
    "evaluate",
  ]);
  assert.equal(calls.includes("normalize"), false);
});

test("generic worker receives the delegated goal instead of the global request", async () => {
  const node = createGenericTaskSubAgentNode(async (state) => {
    assert.equal(state.question, delegatedGoal);
    assert.equal(state.goal.text, delegatedGoal);
    assert.deepEqual(state.goal.successCriteria, acceptanceCriteria);
    assert.equal(state.currentTaskFrame?.globalGoal, "Complete the larger user request.");
    assert.equal(state.currentTaskFrame?.currentGoal, delegatedGoal);
    assert.deepEqual(state.currentTaskFrame?.completionCriteria, acceptanceCriteria);
    return { pendingEvidenceObservation: createObservation() };
  });

  const state: AgentNodeState = {
    runId: "run-default-delegation",
    threadId: "thread-default-delegation",
    userId: 1,
    goal: createAgentGoal("Complete the larger user request."),
    question: "Complete the larger user request.",
    messages: [
      {
        role: "user",
        content: "Complete the larger user request.",
        parts: [{ type: "text", text: "Complete the larger user request." }],
      },
    ],
    currentTaskFrame: {
      globalGoal: "Complete the larger user request.",
      currentGoal: "Complete the larger user request.",
      confirmedObjects: [],
      completionCriteria: ["global request completed"],
    },
    toolExposure: {
      exposedTools: ["read_open", GENERIC_TASK_DELEGATE_TOOL_ID],
      toolMeta: [],
    },
    nextAction: {
      type: "use_tool",
      toolId: GENERIC_TASK_DELEGATE_TOOL_ID,
      args: { goal: delegatedGoal, acceptanceCriteria },
      reason: "Delegate one coherent multi-step task.",
    },
    evidence: { observations: [], retrievals: [], toolExecutions: [] },
  };

  const result = await node(state);
  assert.equal(result.pendingEvidenceObservation?.status, "ok");
});

test("delegated needs_input bypasses Main Planner after evidence and resume", () => {
  const state = {
    nextAction: {
      type: "ask_user",
      question: "Which target file should be changed?",
      reason: "The delegated worker requires one exact target.",
    },
  } as never;

  assert.equal(routeAfterEvidence(state), "generate");
  assert.equal(routeAfterPrepareContext(state), "generate");
});
