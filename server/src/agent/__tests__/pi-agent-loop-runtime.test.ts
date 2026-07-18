import assert from "node:assert/strict";
import { test } from "vitest";
import { createAgentGoal } from "../nodes/goal-plan";
import {
  createPiAgentLoop,
  type PiAgentLoopNodes,
} from "../pi-loop";
import type {
  AgentGraphInput,
  AgentNextAction,
  AgentToolExecutionResult,
  PendingToolCall,
} from "../types";

const requestText =
  "Read README.md, read package.json, compare them, fix README.md, and verify the result.";

const createInput = (
  overrides: Partial<AgentGraphInput> = {},
): AgentGraphInput => ({
  runId: "run-pi-runtime",
  threadId: "thread-pi-runtime",
  userId: 1,
  goal: createAgentGoal(requestText),
  messages: [
    {
      role: "user",
      content: requestText,
      parts: [{ type: "text", text: requestText }],
    },
  ],
  maxIterations: 8,
  ...overrides,
});

const createPendingToolCall = (
  action: Extract<AgentNextAction, { type: "use_tool" }>,
  index: number,
): PendingToolCall => ({
  id: `tool-call-${index}`,
  toolId: action.toolId,
  args: action.args,
  reason: action.reason,
  inputHash: `hash-${index}`,
  source: "planner",
  status: "frozen",
  toolMeta: {
    toolId: action.toolId,
    title: action.toolId,
    description: `Fake ${action.toolId}`,
    inputSchema: { type: "object", properties: {} },
    domain: "read",
    source: "internal",
    capabilities: {
      sideEffect: "none",
      requiresApproval: false,
      workspaceBound: true,
    },
  },
  createdAt: `2026-07-18T00:00:0${index}.000Z`,
});

const createCompletedExecution = (
  pendingToolCall: PendingToolCall,
): AgentToolExecutionResult => ({
  toolCallId: pendingToolCall.id,
  toolId: pendingToolCall.toolId,
  inputHash: pendingToolCall.inputHash,
  args: pendingToolCall.args,
  status: "completed",
  result: {
    type: "open",
    path: String(pendingToolCall.args.path ?? "unknown"),
    source: { text: `content for ${String(pendingToolCall.args.path ?? "unknown")}` },
  },
  summary: {
    source: "tool",
    status: "completed",
    toolId: pendingToolCall.toolId,
    inputHash: pendingToolCall.inputHash,
    actionTaken: `Opened ${String(pendingToolCall.args.path ?? "unknown")}.`,
    keyFindings: [`path=${String(pendingToolCall.args.path ?? "unknown")}`],
  },
  startedAt: pendingToolCall.createdAt,
  finishedAt: pendingToolCall.createdAt,
});

const createFakeNodes = (input: {
  calls: string[];
  plannerActions: AgentNextAction[];
  requireApproval?: boolean;
}): PiAgentLoopNodes => {
  let plannerIndex = 0;
  let toolIndex = 0;

  return {
    prepareContext: async () => {
      input.calls.push("prepare");
      return {
        toolExposure: {
          exposedTools: ["read_open"],
          toolMeta: [
            {
              toolId: "read_open",
              title: "Read Open",
              description: "Open a known workspace file.",
              inputSchema: { type: "object", properties: {} },
              domain: "read",
              source: "internal",
              capabilities: {
                sideEffect: "none",
                requiresApproval: false,
                workspaceBound: true,
              },
            },
          ],
        },
      };
    },

    planner: async () => {
      input.calls.push("planner");
      const action = input.plannerActions[plannerIndex];
      plannerIndex += 1;
      return action
        ? { nextAction: action }
        : {
            nextAction: {
              type: "error" as const,
              reason: "Fake planner ran out of actions.",
            },
            errorMessage: "Fake planner ran out of actions.",
            errorSourceNodeId: "nextActionPlanner",
          };
    },

    normalizeToolCall: async (state) => {
      input.calls.push("normalize");
      if (state.nextAction?.type !== "use_tool") {
        return {
          errorMessage: "Expected use_tool action.",
          errorSourceNodeId: "toolCallNormalize",
        };
      }
      toolIndex += 1;
      return {
        pendingToolCall: createPendingToolCall(state.nextAction, toolIndex),
      };
    },

    policy: async (state) => {
      input.calls.push("policy");
      const pendingToolCall = state.pendingToolCall as PendingToolCall;
      if (input.requireApproval) {
        return {
          policyDecision: {
            type: "require_approval" as const,
            toolId: pendingToolCall.toolId,
            inputHash: pendingToolCall.inputHash,
            reason: "Fake approval required.",
          },
          pendingApproval: {
            id: "approval-1",
            runId: state.runId,
            stepId: "approval",
            toolId: pendingToolCall.toolId,
            toolCallId: pendingToolCall.id,
            reason: "Fake approval required.",
            input: pendingToolCall.args,
            inputHash: pendingToolCall.inputHash,
            createdAt: "2026-07-18T00:00:10.000Z",
          },
          pendingToolCall,
        };
      }

      return {
        policyDecision: {
          type: "allow" as const,
          toolId: pendingToolCall.toolId,
          inputHash: pendingToolCall.inputHash,
          reason: "Fake policy allowed execution.",
        },
        pendingToolCall,
      };
    },

    approval: async () => {
      input.calls.push("approval");
      return { blockedReason: "waiting approval" };
    },

    retrieve: async () => {
      input.calls.push("retrieve");
      return {};
    },

    tool: async (state) => {
      input.calls.push("tool");
      const pendingToolCall = state.pendingToolCall as PendingToolCall;
      const execution = createCompletedExecution(pendingToolCall);
      return {
        pendingToolCall: undefined,
        lastToolExecution: execution,
        pendingToolExecution: execution,
        iterationCount: (state.iterationCount ?? 0) + 1,
      };
    },

    evidence: async (state) => {
      input.calls.push("evidence");
      const execution = state.pendingToolExecution;
      return {
        evidence: {
          observations: state.evidence?.observations ?? [],
          retrievals: state.evidence?.retrievals ?? [],
          toolExecutions: execution
            ? [...(state.evidence?.toolExecutions ?? []), execution]
            : state.evidence?.toolExecutions ?? [],
          latestSummary: execution?.summary ?? state.evidence?.latestSummary,
        },
        pendingToolExecution: undefined,
        pendingEvidenceObservation: undefined,
        pendingRetrievalEvidence: undefined,
      };
    },

    generate: async () => {
      input.calls.push("generate");
      return { answer: "Compound task completed." };
    },

    evaluate: async () => {
      input.calls.push("evaluate");
      return { terminalReason: "completed" };
    },

    error: async (state) => {
      input.calls.push("error");
      return {
        errorMessage: state.errorMessage ?? "Fake loop error.",
      };
    },
  };
};

test("Pi runtime loops tool results back into the planner until answer", async () => {
  const calls: string[] = [];
  const loop = createPiAgentLoop(
    createFakeNodes({
      calls,
      plannerActions: [
        {
          type: "use_tool",
          toolId: "read_open",
          args: { path: "README.md" },
          reason: "Read the first required file.",
        },
        {
          type: "use_tool",
          toolId: "read_open",
          args: { path: "package.json" },
          reason: "Read the second required file before comparing.",
        },
        {
          type: "answer",
          reason: "All fake completion criteria are covered.",
        },
      ],
    }),
  );

  const output = await loop.run(createInput());

  assert.equal(output.status, "completed");
  assert.equal(output.answer, "Compound task completed.");
  assert.equal(output.evidence.toolExecutions.length, 2);
  assert.deepEqual(calls, [
    "prepare",
    "planner",
    "normalize",
    "policy",
    "tool",
    "evidence",
    "planner",
    "normalize",
    "policy",
    "tool",
    "evidence",
    "planner",
    "generate",
    "evaluate",
  ]);
});

test("Pi runtime pauses for approval without executing or generating", async () => {
  const calls: string[] = [];
  const loop = createPiAgentLoop(
    createFakeNodes({
      calls,
      requireApproval: true,
      plannerActions: [
        {
          type: "use_tool",
          toolId: "read_open",
          args: { path: "README.md" },
          reason: "Read a protected file.",
        },
      ],
    }),
  );

  const output = await loop.run(createInput());

  assert.equal(output.status, "waiting_approval");
  assert.equal(output.pendingApproval?.toolId, "read_open");
  assert.equal(output.pendingToolCall?.toolId, "read_open");
  assert.deepEqual(calls, [
    "prepare",
    "planner",
    "normalize",
    "policy",
    "approval",
  ]);
});
