/**
 * 评估节点：检查 Agent 最终回答是否基于真实证据，并生成评估观察。
 */
import {
  appendObservationEvidence,
  getEvidencePayload,
} from "../evidence";
import { emitStepNode } from "../node-runtime";
import {
  answerClaimsUnverifiedObservation,
  createObservation,
} from "./shared";
import type { AgentNodeState, EmitAgentExecutionNode } from "../node-runtime";

export const evaluateNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  const answer = state.answer?.trim() ?? "";
  const evidence = getEvidencePayload(state);
  const hasCompletedToolEvidence = evidence.toolExecutions.some(
    (execution) => execution.status === "completed" && typeof execution.result !== "undefined",
  );
  const hasRetrievalEvidence = evidence.retrievals.some(
    (retrieval) => retrieval.chunkCount > 0,
  );
  const hasGroundingEvidence = hasCompletedToolEvidence || hasRetrievalEvidence;
  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-evaluate",
    nodeType: "evaluate",
    phase: "start",
    label: "检查结果",
    summary: "正在检查 Agent 执行结果",
  });

  const ok =
    answer.length > 0 &&
    !(answerClaimsUnverifiedObservation(answer) && !hasGroundingEvidence);
  const blockedReason =
    answer.length === 0
      ? "Agent run did not produce an answer."
      : answerClaimsUnverifiedObservation(answer) && !hasGroundingEvidence
        ? "Agent answer claimed external or workspace observations without grounded evidence."
        : undefined;
  const observation = createObservation({
    runId: state.runId,
    stepId: "evaluate",
    status: ok ? "ok" : "failed",
    facts: [
      ok
        ? "Agent run produced a final answer."
        : blockedReason ?? "Agent evaluation failed.",
    ],
    ...(ok || !blockedReason ? {} : { errorMessage: blockedReason }),
  });

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-evaluate",
    nodeType: "evaluate",
    phase: ok ? "done" : "error",
    label: "检查结果",
    summary: ok ? "Agent 执行已完成" : "Agent 结果未通过证据检查",
    details: {
      hasCompletedToolEvidence,
      hasRetrievalEvidence,
      hasGroundingEvidence,
      blockedReason: blockedReason ?? null,
    },
  });

  return {
    observations: [...(state.observations ?? []), observation],
    evidence: appendObservationEvidence(state, observation),
    ...(ok
      ? { terminalReason: "completed" }
      : {
          blockedReason,
          terminalReason:
            answer.length === 0 ? "blocked_no_answer" : "blocked_grounding_check",
        }),
  };
};
