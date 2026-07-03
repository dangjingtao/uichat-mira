import assert from "node:assert/strict";
import { test } from "vitest";
import {
  toAgentApprovalExecutionNode,
  toAgentErrorExecutionNode,
  toAgentExecutionNode,
  toPlanNodeDetails,
} from "./trace.js";

test("toAgentExecutionNode prefixes runId into node details", () => {
  const event = toAgentExecutionNode({
    runId: "run-1",
    nodeId: "agent-generate",
    nodeType: "generate",
    phase: "done",
    label: "生成回答",
    slotKey: "agent-generate",
    attemptKey: "agent-generate#1",
    iteration: 1,
    summary: "ok",
    details: { answerLength: 42 },
  });

  assert.equal(event.nodeId, "agent-generate");
  assert.equal(event.nodeType, "generate");
  assert.equal(event.phase, "done");
  assert.equal(event.traceDomain, "agent");
  assert.equal(event.slotKey, "agent-generate");
  assert.equal(event.attemptKey, "agent-generate#1");
  assert.equal(event.iteration, 1);
  assert.equal(event.summary, "ok");
  assert.deepEqual(event.details, {
    runId: "run-1",
    answerLength: 42,
  });
});

test("toAgentErrorExecutionNode emits error phase", () => {
  const event = toAgentErrorExecutionNode({
    runId: "run-1",
    nodeId: "agent-error",
    label: "错误节点",
    summary: "boom",
  });

  assert.equal(event.nodeType, "error");
  assert.equal(event.phase, "error");
  assert.equal(event.summary, "boom");
});

test("toAgentApprovalExecutionNode emits approval phase", () => {
  const event = toAgentApprovalExecutionNode({
    runId: "run-1",
    nodeId: "agent-approval",
    label: "审批节点",
    summary: "waiting",
  });

  assert.equal(event.nodeType, "approval");
  assert.equal(event.phase, "start");
  assert.equal(event.summary, "waiting");
});

test("toPlanNodeDetails preserves tool and approval metadata", () => {
  const details = toPlanNodeDetails([
    {
      id: "step-1",
      kind: "tool",
      title: "web search",
      status: "pending",
      riskLevel: "low",
      requiresApproval: true,
      toolId: "web-search",
    },
  ]);

  assert.deepEqual(details, {
    steps: [
      {
        id: "step-1",
        kind: "tool",
        title: "web search",
        riskLevel: "low",
        requiresApproval: true,
        toolId: "web-search",
      },
    ],
  });
});
