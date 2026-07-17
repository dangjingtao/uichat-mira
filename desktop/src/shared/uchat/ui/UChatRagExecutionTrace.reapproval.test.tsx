// @vitest-environment jsdom
import assert from "node:assert/strict";
import { render, screen } from "@testing-library/react";
import { test } from "vitest";
import i18n from "@/shared/i18n";
import { UChatExecutionTrace } from "./UChatRagExecutionTrace";
import type { RagNodeLike } from "./ragTypes";

const doneStep = (
  nodeId: string,
  nodeType: RagNodeLike["nodeType"],
  label: string,
  summary?: string,
  details?: Record<string, unknown>,
): RagNodeLike => ({
  nodeId,
  nodeType,
  phase: "done",
  label,
  summary,
  details,
  traceDomain: "agent",
});

test("a newer approval wait overrides the historical resume state", () => {
  const steps: RagNodeLike[] = [
    doneStep(
      "agent-approval-1",
      "approval",
      "审批节点",
      "已进入审批等待",
      { approvalId: "approval-1" },
    ),
    doneStep(
      "agent-resume-execution",
      "approval",
      "恢复执行",
      "审批已通过，继续恢复 browser_observe 的执行",
      { resumedFromApproval: true },
    ),
    doneStep(
      "agent-approval-2",
      "approval",
      "审批节点",
      "已进入审批等待",
      { approvalId: "approval-2" },
    ),
  ];

  render(
    <UChatExecutionTrace
      messageId="assistant-reapproval"
      steps={steps}
      onOpenDetail={() => {}}
    />,
  );

  assert.ok(
    screen.getByText(i18n.t("chat.thread.agent.waitingApprovalTitle")),
  );
  assert.equal(screen.queryByText(i18n.t("chat.thread.agent.running")), null);
});
