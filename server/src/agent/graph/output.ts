import type { AgentGraphOutput } from "../types";
import type { AgentGraphStateType } from "./state";

export type AgentGraphOutputWithRuntimeState = AgentGraphOutput & {
  iterationCount?: number;
};

export const mapGraphStateToOutput = (
  state: AgentGraphStateType,
): AgentGraphOutputWithRuntimeState => {
  const answer = state.answer?.trim() ?? "";
  return {
    answer,
    observations: state.observations ?? [],
    evidence: state.evidence ?? {
      observations: state.observations ?? [],
      toolExecutions: [],
      retrievals: [],
    },
    retrievedChunks: state.retrievedChunks ?? [],
    toolIntent: state.toolIntent,
    pendingApproval: state.pendingApproval,
    policyDecision: state.policyDecision,
    selectedToolId:
      state.lastToolExecution?.toolId ??
      state.pendingApproval?.toolId,
    pendingToolCall: state.pendingToolCall,
    approvedInvocations: state.approvedInvocations,
    lastToolExecution: state.lastToolExecution,
    currentTaskFrame: state.currentTaskFrame,
    blockedReason: state.blockedReason,
    terminalReason:
      state.terminalReason ??
      (state.pendingApproval
        ? "waiting_approval"
        : state.errorMessage
          ? "failed_error"
          : state.blockedReason
            ? "blocked"
            : answer
              ? "completed"
              : "blocked"),
    contextBudget: state.contextBudget,
    errorMessage: state.errorMessage,
    errorSourceNodeId: state.errorSourceNodeId,
    status: state.pendingApproval
      ? "waiting_approval"
      : state.errorMessage
        ? "failed"
        : state.blockedReason
          ? "blocked"
          : answer
            ? "completed"
            : "blocked",
    iterationCount: state.iterationCount,
  };
};
