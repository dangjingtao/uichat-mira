/**
 * 审批节点：当存在待审批的工具调用时，暂停执行并等待用户审批。
 */
import { emitStepNode } from "../node-runtime";
import { emitApprovalNode, emitNodeError } from "./shared";
import type { AgentNodeState, EmitAgentExecutionNode } from "../node-runtime";

export const approvalNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  if (!state.pendingApproval) {
    const errorMessage = "Approval node entered without a pending approval request";
    await emitNodeError(emit, {
      runId: state.runId,
      nodeId: "agent-approval",
      label: "审批节点",
      summary: errorMessage,
    });
    return {
      errorMessage,
      errorSourceNodeId: "agent-approval",
    };
  }

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-approval",
    nodeType: "approval",
    phase: "start",
    label: "审批节点",
    summary: "等待人工审批",
    details: {
      toolCallId: state.pendingApproval.toolCallId,
      toolId: state.pendingApproval.toolId,
      reason: state.pendingApproval.reason,
      input: state.pendingApproval.input,
      inputHash: state.pendingApproval.inputHash,
    },
  });

  await emitApprovalNode(emit, {
    runId: state.runId,
    nodeId: "agent-approval",
    label: "审批节点",
    summary: "已进入审批等待",
    details: {
      approvalId: state.pendingApproval.id,
      toolCallId: state.pendingApproval.toolCallId,
      toolId: state.pendingApproval.toolId,
      reason: state.pendingApproval.reason,
      inputHash: state.pendingApproval.inputHash,
    },
  });

  return {
    blockedReason: "waiting approval",
  };
};
