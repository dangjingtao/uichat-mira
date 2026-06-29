import type { AgentNodeState, EmitAgentExecutionNode } from "../nodes.js";
import {
  emitStepNode,
  getIterativeNodeId,
  getLatestUserQuestion,
  getTraceAttemptMeta,
} from "../nodes.js";
import { matchCapabilitiesByEmbedding } from "./embedding-capability-matcher.js";
import {
  resolveSelectedToolIds,
  selectCapabilityWithTaskModel,
} from "./task-capability-selector.js";
import type { CapabilityIntentResult } from "./types.js";

export const capabilityIntentNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  const query = getLatestUserQuestion(state.messages) || state.goal.text;
  const nodeId = getIterativeNodeId("agent-capability-intent", state);
  const traceAttemptMeta = getTraceAttemptMeta("agent-capability-intent", state);

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId,
    ...traceAttemptMeta,
    nodeType: "reason",
    phase: "start",
    label: "能力意图识别",
    summary: "正在根据当前 query 召回候选能力",
  });

  const capabilityIntent = await matchCapabilitiesByEmbedding({
    query,
    config: state.intentConfig,
  });
  const taskDecision = await selectCapabilityWithTaskModel({
    query,
    topCandidates: capabilityIntent.topCandidates,
    messages: state.messages,
  });
  const resolvedCapabilityIntent: CapabilityIntentResult = {
    ...capabilityIntent,
    selectedCapabilityIds: taskDecision.selectedCapabilityIds,
    selectedToolIds: resolveSelectedToolIds({
      query,
      topCandidates: capabilityIntent.topCandidates,
      selectedCapabilityIds: taskDecision.selectedCapabilityIds,
    }),
    decisionSource: taskDecision.decisionSource,
    decisionReason: taskDecision.decisionReason,
  };

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId,
    ...traceAttemptMeta,
    nodeType: "reason",
    phase: "done",
    label: "能力意图识别",
    summary:
      resolvedCapabilityIntent.topCandidates.length > 0
        ? `已召回 ${resolvedCapabilityIntent.topCandidates.length} 个候选能力`
        : "未召回候选能力",
    details: {
      query,
      selectedCapabilityIds: resolvedCapabilityIntent.selectedCapabilityIds,
      selectedToolIds: resolvedCapabilityIntent.selectedToolIds,
      selectedCandidates: resolvedCapabilityIntent.topCandidates
        .filter((candidate) =>
          resolvedCapabilityIntent.selectedCapabilityIds.includes(candidate.capabilityId),
        )
        .map((candidate) => ({
          capabilityId: candidate.capabilityId,
          preferredToolId: candidate.preferredToolId,
          supportingToolIds: candidate.supportingToolIds,
          embeddingScore: candidate.embeddingScore,
          ruleScore: candidate.ruleScore,
          rerankScore: candidate.rerankScore ?? 0,
          finalScore: candidate.finalScore ?? candidate.score,
        })),
      topCandidates: resolvedCapabilityIntent.topCandidates,
      retrievalModel: resolvedCapabilityIntent.retrievalModel,
      exposureReasons: resolvedCapabilityIntent.exposureReasons,
      decisionSource: resolvedCapabilityIntent.decisionSource,
      decisionReason: resolvedCapabilityIntent.decisionReason,
    },
  });

  return {
    capabilityIntent: resolvedCapabilityIntent,
  };
};

export type { CapabilityIntentResult } from "./types.js";
