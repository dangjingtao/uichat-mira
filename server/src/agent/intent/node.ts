import type { AgentNodeState, EmitAgentExecutionNode } from "../nodes.js";
import { emitStepNode, getLatestUserQuestion } from "../nodes.js";
import { matchCapabilitiesByEmbedding } from "./embedding-capability-matcher.js";
import type { CapabilityIntentResult } from "./types.js";

export const capabilityIntentNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  const query = getLatestUserQuestion(state.messages) || state.goal.text;

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-capability-intent",
    nodeType: "reason",
    phase: "start",
    label: "能力意图识别",
    summary: "正在根据当前 query 召回候选能力",
  });

  const capabilityIntent = await matchCapabilitiesByEmbedding({
    query,
    config: state.intentConfig,
  });

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-capability-intent",
    nodeType: "reason",
    phase: "done",
    label: "能力意图识别",
    summary:
      capabilityIntent.topCandidates.length > 0
        ? `已召回 ${capabilityIntent.topCandidates.length} 个候选能力`
        : "未召回候选能力",
    details: {
      query,
      selectedCapabilityIds: capabilityIntent.selectedCapabilityIds,
      topCandidates: capabilityIntent.topCandidates,
      retrievalModel: capabilityIntent.retrievalModel,
    },
  });

  return {
    capabilityIntent,
  };
};

export type { CapabilityIntentResult } from "./types.js";
