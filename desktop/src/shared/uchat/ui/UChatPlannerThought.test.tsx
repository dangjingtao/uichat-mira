// @vitest-environment jsdom
import assert from "node:assert/strict";
import { render, screen } from "@testing-library/react";
import { test } from "vitest";
import { UChatExecutionTrace } from "./UChatRagExecutionTrace";
import type { RagNodeLike } from "./ragTypes";

const plannerStart: RagNodeLike = {
  nodeId: "agent-next-action-planner",
  attemptKey: "agent-next-action-planner#1",
  nodeType: "plan",
  phase: "start",
  label: "下一步动作决策",
  summary: "正在调用 task model 决定本轮下一步动作",
  details: {
    plannerThought: "我已经读完 index.html，正在判断接下来需要继续调用工具还是直接回答。",
    plannerThoughtStreaming: true,
  },
};

test("shows streamed planner thought instead of the generic planning summary", () => {
  render(
    <UChatExecutionTrace
      messageId="assistant-planner-thought"
      steps={[plannerStart]}
      onOpenDetail={() => {}}
    />,
  );

  assert.ok(
    screen.getByTestId("agent-inner-status").textContent?.includes(
      "我已经读完 index.html，正在判断接下来需要继续调用工具还是直接回答。",
    ),
  );
});

test("hides planner thought after answer generation completes", () => {
  render(
    <UChatExecutionTrace
      messageId="assistant-planner-completed"
      steps={[
        plannerStart,
        {
          nodeId: "agent-generate",
          attemptKey: "agent-generate#1",
          nodeType: "generate",
          phase: "done",
          label: "组织最终回答",
          summary: "已生成 Agent 最终回答",
        },
      ]}
      onOpenDetail={() => {}}
    />,
  );

  assert.equal(screen.queryByTestId("agent-inner-status"), null);
});