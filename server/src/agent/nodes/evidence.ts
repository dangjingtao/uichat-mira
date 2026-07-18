/**
 * Evidence is the single writer for the accumulated evidence payload.
 * Executor nodes return raw facts through pending fields and do not mutate it.
 */
import {
  appendObservationEvidence,
  appendRetrievalEvidence,
  appendToolExecutionEvidence,
  getEvidenceCounts,
  getLatestEvidenceSummary,
} from "../evidence";
import { emitStepNode, getTraceAttemptMeta } from "../node-runtime";
import type { AgentNodeState, EmitAgentExecutionNode } from "../node-runtime";

export const evidenceNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  let nextState = state;
  const observation = state.pendingEvidenceObservation;
  if (observation) {
    nextState = {
      ...nextState,
      evidence: appendObservationEvidence(nextState, observation),
    } as AgentNodeState;
  }

  if (state.pendingToolExecution) {
    nextState = {
      ...nextState,
      evidence: appendToolExecutionEvidence(nextState, state.pendingToolExecution),
    } as AgentNodeState;
  }

  if (state.pendingRetrievalEvidence) {
    nextState = {
      ...nextState,
      evidence: appendRetrievalEvidence(
        nextState,
        state.pendingRetrievalEvidence,
      ),
    } as AgentNodeState;
  }

  const evidence = nextState.evidence;
  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-evidence",
    ...getTraceAttemptMeta("agent-evidence", state),
    nodeType: "reason",
    phase: "done",
    label: "整理证据",
    summary: "已整理工具、检索和策略事实",
    details: {
      evidenceCounts: getEvidenceCounts({ evidence }),
      latestEvidenceSummary: getLatestEvidenceSummary({ evidence }),
    },
  });

  return {
    evidence,
    pendingEvidenceObservation: undefined,
    pendingToolExecution: undefined,
    pendingRetrievalEvidence: undefined,
  };
};