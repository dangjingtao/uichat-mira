/**
 * 评估节点：只检查 Planner 终止决定是否成功交付。
 * 是否完成任务由 Planner 独占判断；本节点不得重新做语义完成判断。
 */
import { emitStepNode } from "../node-runtime";
import { createObservation } from "./shared";
import type { AgentNodeState, EmitAgentExecutionNode } from "../node-runtime";

export const evaluateNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  const answer = state.answer?.trim() ?? "";
  const plannerTerminalType =
    state.nextAction?.type === "answer" || state.nextAction?.type === "ask_user"
      ? state.nextAction.type
      : undefined;
  const hasRequiredFinalization =
    plannerTerminalType === "ask_user" || Boolean(state.finalizationPacket);
  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-evaluate",
    nodeType: "evaluate",
    phase: "start",
    label: "检查结果",
    summary: "正在检查 Agent 执行结果",
  });

  const ok = answer.length > 0 && Boolean(plannerTerminalType) && hasRequiredFinalization;
  const blockedReason =
    answer.length === 0
      ? "Planner terminal decision was not delivered as a user answer."
      : !plannerTerminalType
        ? "Evaluate received no Planner terminal decision."
        : !hasRequiredFinalization
          ? "Planner answer finalization packet is missing."
        : undefined;
  const observation = createObservation({
    runId: state.runId,
    stepId: "evaluate",
    status: ok ? "ok" : "failed",
    facts: [
      ok
        ? `Planner ${plannerTerminalType} decision was delivered successfully.`
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
    summary: ok
      ? plannerTerminalType === "ask_user"
        ? "Planner 澄清问题已交付，等待用户输入"
        : "Planner 最终回答决定已成功交付"
      : "Planner 终止决定未能成功交付",
    details: {
      plannerTerminalType: plannerTerminalType ?? null,
      hasRequiredFinalization,
      blockedReason: blockedReason ?? null,
    },
  });

  return {
    observations: [...(state.observations ?? []), observation],
    ...(ok
      ? {
          terminalReason:
            plannerTerminalType === "ask_user" ? "waiting_user" : "completed",
        }
      : {
          blockedReason,
          errorMessage: blockedReason,
          errorSourceNodeId: "agent-evaluate",
          terminalReason: "failed_delivery",
        }),
  };
};
