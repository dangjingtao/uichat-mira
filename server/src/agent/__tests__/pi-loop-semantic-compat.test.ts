import assert from "node:assert/strict";
import { test } from "vitest";
import {
  appendPendingEvidence,
  approvalNode,
  errorNode,
  evaluateNode,
  evidenceNode,
  finalizeRun,
  finishWithError,
  normalizeAndFreezeToolCall,
  pauseForApproval,
  toolCallNormalizeNode,
} from "../nodes";
import { createAgentGoal } from "../nodes/goal-plan";
import {
  createPiAgentLoop,
  type PiAgentLoopSemantics,
} from "../pi-loop";
import type { AgentGraphInput } from "../types";

const createInput = (): AgentGraphInput => ({
  runId: "run-semantic-compat",
  threadId: "thread-semantic-compat",
  userId: 1,
  goal: createAgentGoal("Return a direct answer without tools."),
  messages: [
    {
      role: "user",
      content: "Return a direct answer without tools.",
      parts: [
        {
          type: "text",
          text: "Return a direct answer without tools.",
        },
      ],
    },
  ],
  maxIterations: 2,
});

test("semantic runtime exports preserve legacy node implementation identity", () => {
  assert.equal(pauseForApproval, approvalNode);
  assert.equal(appendPendingEvidence, evidenceNode);
  assert.equal(finalizeRun, evaluateNode);
  assert.equal(finishWithError, errorNode);
  assert.equal(normalizeAndFreezeToolCall, toolCallNormalizeNode);
});

test("Pi-loop runs through semantic step contract without legacy node fields", async () => {
  const calls: string[] = [];
  const unexpectedStep = async () => {
    throw new Error("Unexpected semantic step was called.");
  };
  const semantics: PiAgentLoopSemantics = {
    prepareContext: async () => {
      calls.push("prepareContext");
      return {};
    },
    planner: async () => {
      calls.push("planner");
      return {
        nextAction: {
          type: "answer" as const,
          reason: "The request can be answered directly.",
          completionProof: [
            { criterion: "return a direct answer", evidenceRefs: [] },
          ],
          unresolvedGaps: [],
        },
      };
    },
    normalizeAndFreeze: unexpectedStep,
    evaluatePolicy: unexpectedStep,
    pauseForApproval: unexpectedStep,
    retrieve: unexpectedStep,
    executeTool: unexpectedStep,
    appendEvidence: unexpectedStep,
    generate: async () => {
      calls.push("generate");
      return { answer: "Semantic runtime completed." };
    },
    finalize: async () => {
      calls.push("finalize");
      return { terminalReason: "completed" };
    },
    finishWithError: async (state) => ({
      errorMessage: state.errorMessage ?? "Unexpected semantic runtime error.",
    }),
  };

  const output = await createPiAgentLoop(semantics).run(createInput());

  assert.equal(output.status, "completed");
  assert.equal(output.answer, "Semantic runtime completed.");
  assert.deepEqual(calls, [
    "prepareContext",
    "planner",
    "generate",
    "finalize",
  ]);
});
