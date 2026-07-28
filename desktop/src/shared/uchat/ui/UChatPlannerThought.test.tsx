// @vitest-environment jsdom
import assert from "node:assert/strict";
import { render, screen } from "@testing-library/react";
import { test } from "vitest";
import StreamingTextRenderer from "@/shared/ui/StreamingTextRenderer";
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

const plannerDone: RagNodeLike = {
  ...plannerStart,
  phase: "done",
};

const generateStart: RagNodeLike = {
  nodeId: "agent-generate",
  attemptKey: "agent-generate#1",
  nodeType: "generate",
  phase: "start",
  label: "组织最终回答",
  summary: "正在生成 Agent 最终回答",
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

test("keeps planner thought visible until answer text is actually visible", () => {
  const renderHarness = (text: string) => (
    <>
      <UChatExecutionTrace
        messageId="assistant-visible-handoff"
        steps={[plannerDone, generateStart]}
        onOpenDetail={() => {}}
      />
      <StreamingTextRenderer text={text} isStreaming>
        {(visibleText) => (
          <span data-testid="visible-answer-text">{visibleText}</span>
        )}
      </StreamingTextRenderer>
    </>
  );
  const { rerender } = render(renderHarness(""));

  assert.equal(
    screen.getByTestId("agent-inner-status-region").getAttribute("aria-hidden"),
    "false",
  );
  assert.equal(screen.getByTestId("visible-answer-text").textContent, "");

  rerender(renderHarness("答"));

  assert.equal(screen.getByTestId("visible-answer-text").textContent, "答");
  assert.equal(
    screen.getByTestId("agent-inner-status-region").getAttribute("aria-hidden"),
    "true",
  );
});

test("keeps the last stable inner status across a transient empty SSE projection", () => {
  const renderTrace = (steps: RagNodeLike[]) => (
    <UChatExecutionTrace
      messageId="assistant-stable-inner-status"
      steps={steps}
      onOpenDetail={() => {}}
    />
  );
  const { rerender } = render(renderTrace([plannerDone]));

  assert.ok(
    screen.getByTestId("agent-inner-status").textContent?.includes(
      "我已经读完 index.html，正在判断接下来需要继续调用工具还是直接回答。",
    ),
  );

  rerender(
    renderTrace([
      {
        nodeId: "agent-transient-projection",
        attemptKey: "agent-transient-projection#1",
        nodeType: "approval",
        phase: "done",
        label: "",
        summary: "",
      },
    ]),
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
