// @vitest-environment jsdom
import assert from "node:assert/strict";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UChatExecutionTrace } from "./UChatRagExecutionTrace";
import type { RagNodeLike } from "./ragTypes";
import {
  getLatestSubAgentTraceTitle,
  getLatestSubAgentWorkingState,
  getSubAgentTraceSteps,
} from "./subAgentTrace";

const traceStep = (input: {
  seq: number;
  title: string;
  phase?: RagNodeLike["phase"];
  summary?: string;
}): RagNodeLike => ({
  nodeId: `subagent-trace:run-1:${input.seq}`,
  nodeType: "reason",
  phase: input.phase ?? "done",
  label: input.title,
  summary: input.summary,
  details: {
    subAgentTraceEvent: true,
    subAgentRunId: "run-1",
    subAgentSeq: input.seq,
    subAgentEventId: `event-${input.seq}`,
    subAgentEventType: "working_state.updated",
    skillId: "pdf",
  },
});

const workingStateStep = (input: {
  updatedAt: number;
  phase: "working" | "completed";
  judgement: string;
  action: string;
  nextAction: string;
}): RagNodeLike => ({
  nodeId: `subagent-working-state:run-1:${input.updatedAt}`,
  nodeType: "reason",
  phase: "done",
  label: "subAgent 当前工作",
  details: {
    subAgentWorkingState: true,
    subAgentRunId: "run-1",
    skillId: "pdf",
    workingState: {
      runId: "run-1",
      skillId: "pdf",
      phase: input.phase,
      currentJudgement: input.judgement,
      currentAction: input.action,
      nextAction: input.nextAction,
      updatedAt: input.updatedAt,
    },
  },
});

describe("subAgent UChat trace", () => {
  it("restores the latest working state independently from trace ordering", () => {
    const steps = [
      traceStep({ seq: 3, title: "生成 PDF" }),
      workingStateStep({
        updatedAt: 10,
        phase: "working",
        judgement: "正在整理资料",
        action: "生成结构",
        nextAction: "校验目录",
      }),
      traceStep({ seq: 1, title: "subAgent 已启动", phase: "start" }),
      workingStateStep({
        updatedAt: 20,
        phase: "completed",
        judgement: "完成条件已经满足",
        action: "PDF 已生成",
        nextAction: "交还 Main Agent",
      }),
      traceStep({ seq: 2, title: "读取附件" }),
    ];

    expect(getSubAgentTraceSteps(steps).map((step) => step.label)).toEqual([
      "subAgent 已启动",
      "读取附件",
      "生成 PDF",
    ]);
    expect(getLatestSubAgentTraceTitle(steps)).toBe("生成 PDF");
    expect(getLatestSubAgentWorkingState(steps)).toMatchObject({
      phase: "completed",
      currentJudgement: "完成条件已经满足",
      currentAction: "PDF 已生成",
      nextAction: "交还 Main Agent",
    });
  });

  it("keeps completed working state visible and shows ordinary subAgent trace rows by title only", () => {
    render(
      <UChatExecutionTrace
        messageId="assistant-subagent"
        onOpenDetail={() => {}}
        steps={[
          traceStep({
            seq: 1,
            title: "读取附件",
            phase: "start",
            summary: "这个普通 Trace 摘要不应展示",
          }),
          traceStep({
            seq: 2,
            title: "PDF subAgent 已完成",
            summary: "这个完成摘要也不应展示",
          }),
          workingStateStep({
            updatedAt: 30,
            phase: "completed",
            judgement: "资料和目录校验已经完成",
            action: "PDF 已生成",
            nextAction: "把 Artifact 交还 Main Agent",
          }),
        ]}
      />,
    );

    const state = screen.getByTestId("subagent-working-state");
    assert.match(state.textContent ?? "", /资料和目录校验已经完成/);
    assert.match(state.textContent ?? "", /PDF 已生成/);
    assert.match(state.textContent ?? "", /把 Artifact 交还 Main Agent/);
    assert.ok(screen.getAllByText("PDF subAgent 已完成").length >= 1);

    fireEvent.click(screen.getByRole("button"));

    assert.ok(screen.getByText("读取附件"));
    assert.equal(screen.queryByText("这个普通 Trace 摘要不应展示"), null);
    assert.equal(screen.queryByText("这个完成摘要也不应展示"), null);
  });
});
