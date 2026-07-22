import assert from "node:assert/strict";
import { test } from "vitest";
import { mapGraphStateToOutput } from "../graph/output";
import type { AgentGraphStateType } from "../graph/state";
import { evaluateNode } from "../nodes/evaluate";
import type { AgentNodeState } from "../node-runtime";

const baseState = (): AgentNodeState => ({
  runId: "run-terminal-truth",
  threadId: "thread-terminal-truth",
  userId: 1,
  goal: {
    id: "goal-terminal-truth",
    text: "answer the user",
    successCriteria: ["answer the user"],
    constraints: [],
    riskLevel: "low",
  },
  messages: [
    {
      role: "user",
      content: "answer the user",
      parts: [{ type: "text", text: "answer the user" }],
    },
  ],
  evidence: { observations: [], toolExecutions: [], retrievals: [] },
});

test("Evaluate maps a delivered Planner answer to completed", async () => {
  const packet = {
    type: "answer" as const,
    reason: "The request can be answered directly.",
    completionProof: [
      { criterion: "answer the user", evidenceRefs: [] },
    ],
    unresolvedGaps: [],
  };
  const result = await evaluateNode({
    ...baseState(),
    nextAction: packet,
    finalizationPacket: packet,
    answer: "Done.",
  });

  assert.equal(result.terminalReason, "completed");
  assert.equal(result.errorMessage, undefined);
});

test("Evaluate maps a delivered Planner clarification to waiting_user", async () => {
  const result = await evaluateNode({
    ...baseState(),
    nextAction: {
      type: "ask_user",
      question: "Which file should I inspect?",
      reason: "The target is missing.",
    },
    answer: "Which file should I inspect?",
  });

  assert.equal(result.terminalReason, "waiting_user");
  assert.equal(result.errorMessage, undefined);
});

test("Output mapper does not infer completion from a non-empty answer", () => {
  const output = mapGraphStateToOutput({
    ...baseState(),
    answer: "A model emitted text without a Planner terminal decision.",
  } as AgentGraphStateType);

  assert.equal(output.status, "blocked");
  assert.equal(output.terminalReason, "blocked_missing_planner_terminal_decision");
});
