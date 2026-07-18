// @vitest-environment jsdom
import assert from "node:assert/strict";
import { fireEvent, render, screen } from "@testing-library/react";
import { test } from "vitest";
import i18n from "@/shared/i18n";
import { UChatExecutionTrace } from "./UChatRagExecutionTrace";
import type { RagNodeLike } from "./ragTypes";

test("UChatExecutionTrace renders tool nodes in the shared execution timeline", () => {
  render(
    <UChatExecutionTrace
      messageId="assistant-1"
      onOpenDetail={() => {}}
      steps={[
        {
          nodeId: "tool-1",
          nodeType: "tool",
          phase: "start",
          label: "web_search",
          details: {
            toolName: "web_search",
            input: {
              query: "today date",
            },
          },
        },
      ]}
    />,
  );

  assert.ok(screen.getAllByText("Running web_search").length >= 1);

  fireEvent.click(screen.getByRole("button"));

  assert.ok(screen.getByText("web_search"));
  assert.ok(screen.getAllByText("Running web_search").length >= 2);
});

test("UChatExecutionTrace renders agent nodes in the shared execution timeline", () => {
  const planLabel = i18n.t("chat.parsers.planLabel");
  const approvalLabel = i18n.t("chat.parsers.approvalLabel", {
    defaultValue: "审批节点",
  });

  render(
    <UChatExecutionTrace
      messageId="assistant-2"
      onOpenDetail={() => {}}
      steps={[
        {
          nodeId: "agent-plan",
          nodeType: "plan",
          phase: "done",
          label: "执行计划",
          summary: "已生成最小 Agent 计划",
        },
        {
          nodeId: "agent-approval",
          nodeType: "approval",
          phase: "start",
          label: "审批节点",
          summary: "等待人工审批",
        },
      ]}
    />,
  );

  assert.ok(screen.getByText(planLabel));
  assert.ok(screen.getByText(approvalLabel));
  fireEvent.click(screen.getByRole("button"));
  assert.ok(screen.getByText("已生成最小 Agent 计划"));
  assert.ok(screen.getAllByText("等待人工审批").length >= 2);
});

test("different attempt keys keep repeated semantic nodes visible", () => {
  render(
    <UChatExecutionTrace
      messageId="assistant-iterations"
      onOpenDetail={() => {}}
      steps={[
        {
          nodeId: "agent-next-action-planner",
          attemptKey: "agent-next-action-planner#1",
          iteration: 1,
          nodeType: "plan",
          phase: "done",
          label: "执行计划",
          summary: "第一轮动作",
        },
        {
          nodeId: "agent-next-action-planner",
          attemptKey: "agent-next-action-planner#2",
          iteration: 2,
          nodeType: "plan",
          phase: "done",
          label: "执行计划",
          summary: "第二轮动作",
        },
      ]}
    />,
  );

  fireEvent.click(screen.getByRole("button"));
  assert.ok(screen.getByText("第一轮动作"));
  assert.ok(screen.getByText("第二轮动作"));
});

const completedStep = (
  nodeId: string,
  nodeType: RagNodeLike["nodeType"],
  label: string,
): RagNodeLike => ({
  nodeId,
  nodeType,
  phase: "done",
  label,
  traceDomain: "agent",
});

const approvalWaitSteps: RagNodeLike[] = [
  completedStep("agent-prepare-context", "context", "准备上下文"),
  completedStep("agent-plan", "plan", "执行计划"),
  completedStep("agent-tool-normalize", "reason", "工具调用规范化"),
  completedStep("agent-policy", "reason", "审批策略"),
  {
    ...completedStep("agent-approval", "approval", "审批节点"),
    summary: "已进入审批等待",
    details: {
      approvalId: "approval-1",
      toolId: "browser_observe",
      toolCallId: "tool-call-1",
    },
  },
];

test("approval wait trace does not claim the Agent run is completed", () => {
  render(
    <UChatExecutionTrace
      messageId="assistant-approval-wait"
      steps={approvalWaitSteps}
      onOpenDetail={() => {}}
    />,
  );

  assert.ok(
    screen.getByText(i18n.t("chat.thread.agent.waitingApprovalTitle")),
  );
  assert.equal(
    screen.queryByText(
      i18n.t("chat.executionTrace.stepCount", {
        completed: approvalWaitSteps.length,
        total: approvalWaitSteps.length,
      }),
    ),
    null,
  );
});

test("approval resume trace stays active until a terminal step arrives", () => {
  const resumedSteps: RagNodeLike[] = [
    ...approvalWaitSteps,
    {
      ...completedStep("agent-resume-execution", "approval", "恢复执行"),
      summary: "审批已通过，继续恢复 browser_observe 的执行",
      details: {
        toolId: "browser_observe",
        toolCallId: "tool-call-1",
        resumedFromApproval: true,
      },
    },
  ];

  render(
    <UChatExecutionTrace
      messageId="assistant-resumed"
      steps={resumedSteps}
      onOpenDetail={() => {}}
    />,
  );

  assert.equal(
    screen.queryByText(i18n.t("chat.thread.agent.waitingApprovalTitle")),
    null,
  );
  assert.ok(screen.getByText(i18n.t("chat.thread.agent.running")));
  assert.equal(
    screen.queryByText(
      i18n.t("chat.executionTrace.stepCount", {
        completed: resumedSteps.length,
        total: resumedSteps.length,
      }),
    ),
    null,
  );
});

test("a new unmatched approval remains visible after an earlier resume", () => {
  const reapprovalSteps: RagNodeLike[] = [
    ...approvalWaitSteps,
    {
      ...completedStep("agent-resume-execution", "approval", "恢复执行"),
      details: {
        toolCallId: "tool-call-1",
        resumedFromApproval: true,
      },
    },
    {
      ...completedStep("agent-approval", "approval", "审批节点"),
      attemptKey: "agent-approval#2",
      summary: "已进入审批等待",
      details: {
        approvalId: "approval-2",
        toolCallId: "tool-call-2",
      },
    },
  ];

  render(
    <UChatExecutionTrace
      messageId="assistant-reapproval"
      steps={reapprovalSteps}
      onOpenDetail={() => {}}
    />,
  );

  assert.ok(
    screen.getByText(i18n.t("chat.thread.agent.waitingApprovalTitle")),
  );
});

test("shows Planner decision as transient inner status while Generate is running", () => {
  render(
    <UChatExecutionTrace
      messageId="assistant-inner-status"
      onOpenDetail={() => {}}
      steps={[
        {
          nodeId: "agent-next-action-planner",
          attemptKey: "agent-next-action-planner#1",
          nodeType: "plan",
          phase: "done",
          label: "执行计划",
          summary: "当前证据已足够，开始组织最终回答",
          details: {
            reason: "邮件已经查到，我正在判断哪些内容值得你优先关注。",
          },
        },
        {
          nodeId: "agent-generate",
          attemptKey: "agent-generate#1",
          nodeType: "generate",
          phase: "start",
          label: "组织最终回答",
          summary: "正在生成 Agent 最终回答",
        },
      ]}
    />,
  );

  assert.equal(
    screen.getByTestId("agent-inner-status").textContent,
    "邮件已经查到，我正在判断哪些内容值得你优先关注。",
  );
});

test("inner status disappears after final answer organization completes", () => {
  render(
    <UChatExecutionTrace
      messageId="assistant-inner-status-complete"
      onOpenDetail={() => {}}
      steps={[
        {
          nodeId: "agent-next-action-planner",
          attemptKey: "agent-next-action-planner#1",
          nodeType: "plan",
          phase: "done",
          label: "执行计划",
          details: {
            reason: "邮件已经查到，我正在判断哪些内容值得你优先关注。",
          },
        },
        {
          nodeId: "agent-generate",
          attemptKey: "agent-generate#1",
          nodeType: "generate",
          phase: "done",
          label: "组织最终回答",
          summary: "已生成 Agent 最终回答",
        },
      ]}
    />,
  );

  assert.equal(screen.queryByTestId("agent-inner-status"), null);
});

test("completed answer step restores the normal trace completion state", () => {
  const completedSteps = [
    ...approvalWaitSteps,
    completedStep("agent-generate", "generate", "组织最终回答"),
  ];

  render(
    <UChatExecutionTrace
      messageId="assistant-completed"
      steps={completedSteps}
      onOpenDetail={() => {}}
    />,
  );

  assert.equal(
    screen.queryByText(i18n.t("chat.thread.agent.waitingApprovalTitle")),
    null,
  );
  assert.ok(
    screen.getByText(
      i18n.t("chat.executionTrace.stepCount", {
        completed: completedSteps.length,
        total: completedSteps.length,
      }),
    ),
  );
});