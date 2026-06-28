// @vitest-environment jsdom
import assert from "node:assert/strict";
import { fireEvent, render, screen } from "@testing-library/react";
import { test } from "vitest";
import i18n from "@/shared/i18n";
import { UChatExecutionTrace } from "./UChatRagExecutionTrace";

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
