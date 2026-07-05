/**
 * 错误节点：收集运行过程中的错误信息，输出最终错误状态。
 */
import { emitNodeError } from "./shared";
import type { AgentNodeState, EmitAgentExecutionNode } from "../node-runtime";

export const errorNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  const errorMessage =
    state.errorMessage ?? state.blockedReason ?? "Unknown agent error";

  await emitNodeError(emit, {
    runId: state.runId,
    nodeId: "agent-error",
    label: "错误节点",
    summary: errorMessage,
    details: {
      errorMessage,
      sourceNodeId: state.errorSourceNodeId ?? null,
      blockedReason: state.blockedReason ?? null,
      contextBudget: state.contextBudget ?? null,
    },
  });

  return {
    errorMessage,
  };
};
