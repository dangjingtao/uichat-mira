import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { providerProxyService } from "@/services/provider-proxy.service/index";
import type { AgentNodeState } from "../node-runtime";
import { nextActionPlannerNode } from "../nodes/next-action-planner";
import {
  createPiAgentLoop,
  type PiAgentLoopSemantics,
} from "../pi-loop";

const createPlannerState = (): AgentNodeState => ({
  runId: "run-unbounded-planner",
  threadId: "thread-unbounded-planner",
  userId: 1,
  goal: {
    id: "goal-unbounded-planner",
    text: "continue until the task is complete",
    successCriteria: ["complete the task"],
    constraints: [],
    riskLevel: "low",
  },
  question: "continue until the task is complete",
  messages: [
    {
      role: "user",
      content: "continue until the task is complete",
      parts: [
        {
          type: "text",
          text: "continue until the task is complete",
        },
      ],
    },
  ],
  toolExposure: {
    exposedTools: [],
    toolMeta: [],
  },
  evidence: {
    observations: [],
    retrievals: [],
    toolExecutions: [],
  },
  iterationCount: 12,
  maxIterations: 1,
});

test("nextActionPlannerNode still invokes the task model after the legacy iteration count is exceeded", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"answer","reason":"The accumulated evidence now covers the task."}';
    });

  try {
    const patch = await nextActionPlannerNode(createPlannerState());

    assert.equal(streamSpy.mock.calls.length, 1);
    assert.deepEqual(patch.nextAction, {
      type: "answer",
      reason: "The accumulated evidence now covers the task.",
    });
    assert.equal(patch.errorMessage, undefined);
  } finally {
    streamSpy.mockRestore();
  }
});

test("Pi loop can continue beyond maxIterations until Planner chooses answer", async () => {
  let plannerCalls = 0;
  const noOp = async () => ({});
  const semantics: PiAgentLoopSemantics = {
    prepareContext: noOp,
    planner: async () => {
      plannerCalls += 1;
      if (plannerCalls <= 3) {
        return {
          nextAction: {
            type: "retrieve" as const,
            query: `query-${plannerCalls}`,
            reason: "More evidence is still needed.",
          },
        };
      }

      return {
        nextAction: {
          type: "answer" as const,
          reason: "The task is complete.",
        },
      };
    },
    normalizeAndFreeze: noOp,
    evaluatePolicy: noOp,
    pauseForApproval: noOp,
    retrieve: async (state) => ({
      iterationCount: (state.iterationCount ?? 0) + 1,
    }),
    executeTool: noOp,
    appendEvidence: noOp,
    generate: async () => ({ answer: "done" }),
    finalize: async () => ({ terminalReason: "completed" }),
    finishWithError: noOp,
  };

  const output = await createPiAgentLoop(semantics).run({
    runId: "run-unbounded-loop",
    threadId: "thread-unbounded-loop",
    userId: 1,
    goal: {
      id: "goal-unbounded-loop",
      text: "collect enough evidence",
      successCriteria: ["collect enough evidence"],
      constraints: [],
      riskLevel: "low",
    },
    messages: [
      {
        role: "user",
        content: "collect enough evidence",
        parts: [{ type: "text", text: "collect enough evidence" }],
      },
    ],
    params: {},
    maxIterations: 1,
  });

  assert.equal(plannerCalls, 4);
  assert.equal(output.answer, "done");
  assert.equal(output.status, "completed");
  assert.notEqual(output.terminalReason, "planner_turn_limit");
});