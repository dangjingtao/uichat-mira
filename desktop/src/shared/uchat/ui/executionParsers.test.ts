import assert from "node:assert/strict";
import { test } from "vitest";
import {
  getDisplayExecutionStep,
  getExecutionFailurePresentation,
  getExecutionProgressFromRenderableParts,
} from "./executionParsers";

test("getDisplayExecutionStep maps approval, plan, reason and error nodes", () => {
  assert.deepEqual(
    getDisplayExecutionStep({
      nodeId: "agent-plan",
      nodeType: "plan",
      phase: "done",
      label: "执行计划",
      summary: "已生成最小 Agent 计划",
    }),
    {
      label: "执行计划",
      summary: "已生成最小 Agent 计划",
    },
  );

  assert.deepEqual(
    getDisplayExecutionStep({
      nodeId: "agent-approval",
      nodeType: "approval",
      phase: "done",
      label: "审批节点",
      summary: "已进入审批等待",
    }),
    {
      label: "审批节点",
      summary: "已进入审批等待",
    },
  );

  assert.deepEqual(
    getDisplayExecutionStep({
      nodeId: "agent-reason",
      nodeType: "reason",
      phase: "start",
      label: "能力意图识别",
      summary: "正在根据当前 query 召回候选能力",
    }),
    {
      label: "能力意图识别",
      summary: "正在根据当前 query 召回候选能力",
    },
  );

  assert.deepEqual(
    getDisplayExecutionStep({
      nodeId: "agent-error",
      nodeType: "error",
      phase: "error",
      label: "错误节点",
      summary: "Model returned empty answer",
    }),
    {
      label: "错误节点",
      summary: "Model returned empty answer",
    },
  );
});

test("getExecutionProgressFromRenderableParts keeps separate agent attempts by attemptKey", () => {
  const steps = getExecutionProgressFromRenderableParts([
    {
      type: "data",
      name: "execution-node",
      data: {
        nodeId: "agent-capability-intent-0",
        attemptKey: "agent-capability-intent#0",
        slotKey: "agent-capability-intent",
        iteration: 0,
        traceDomain: "agent",
        nodeType: "reason",
        phase: "done",
        label: "能力意图识别",
        summary: "已召回 1 个候选能力",
      },
    },
    {
      type: "data",
      name: "execution-node",
      data: {
        nodeId: "agent-capability-intent-1",
        attemptKey: "agent-capability-intent#1",
        slotKey: "agent-capability-intent",
        iteration: 1,
        traceDomain: "agent",
        nodeType: "reason",
        phase: "done",
        label: "能力意图识别",
        summary: "未召回候选能力",
      },
    },
  ]);

  assert.equal(steps.length, 2);
  assert.equal(steps[0]?.attemptKey, "agent-capability-intent#0");
  assert.equal(steps[1]?.attemptKey, "agent-capability-intent#1");
});

test("getExecutionFailurePresentation uses agent copy for agent-domain errors", () => {
  const presentation = getExecutionFailurePresentation(
    [
      {
        nodeId: "agent-error-0",
        attemptKey: "agent-error#0",
        slotKey: "agent-error",
        iteration: 0,
        traceDomain: "agent",
        nodeType: "error",
        phase: "error",
        label: "错误节点",
        summary: "Connection error.",
      },
    ],
    "Connection error.",
  );

  assert.equal(presentation.title, "Agent 执行失败");
  assert.equal(presentation.detail, "Connection error.");
});

test("getExecutionFailurePresentation prefers structured agent error details over summary", () => {
  const presentation = getExecutionFailurePresentation(
    [
      {
        nodeId: "agent-error-0",
        attemptKey: "agent-error#0",
        slotKey: "agent-error",
        iteration: 0,
        traceDomain: "agent",
        nodeType: "error",
        phase: "error",
        label: "错误节点",
        summary: "Agent 执行失败",
        details: {
          errorMessage: "Connection error",
          sourceNodeId: "agent-generate",
        },
      },
    ],
    "generic failed",
  );

  assert.equal(presentation.title, "Agent 执行失败");
  assert.equal(presentation.detail, "Connection error");
});
