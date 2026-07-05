/**
 * 路由决策节点：根据累计证据和迭代预算，决定继续规划还是直接生成回答。
 */
import {
  emitStepNode,
  getIterativeNodeId,
  getTraceAttemptMeta,
} from "../node-runtime";
import { getEvidencePayload } from "../evidence";
import {
  extractExplicitPathTarget,
  getLatestUserQuestion,
  queryMentionsWorkspace,
  queryRequestsDirectoryOverview,
  queryRequestsFileContent,
} from "./shared";
import type { AgentNodeState, EmitAgentExecutionNode } from "../node-runtime";

export const routeStepNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  const nodeId = getIterativeNodeId("agent-route-step", state);
  const traceAttemptMeta = getTraceAttemptMeta("agent-route-step", state);

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId,
    ...traceAttemptMeta,
    nodeType: "reason",
    phase: "start",
    label: "回看决策",
    summary: "正在根据累计证据决定继续规划还是直接生成回答",
  });

  const question = getLatestUserQuestion(state.messages) || state.goal.text;
  const maxIterations = state.maxIterations ?? 3;
  const iterationCount = state.iterationCount ?? 0;
  const evidence = getEvidencePayload(state);
  const completedToolExecutions = evidence.toolExecutions.filter(
    (execution) => execution.status === "completed",
  );
  const latestCompletedToolExecution = completedToolExecutions.at(-1);
  const latestRetrieval = evidence.retrievals.at(-1);
  const remainingReviewBudget = Math.max(0, maxIterations - iterationCount);
  const canContinue = remainingReviewBudget > 0;

  let continueIteration = false;
  let reviewDecision: "tool" | "generate" = "generate";
  let decisionReason =
    "No accumulated evidence requires another planning pass, so the agent will generate a final answer.";

  if (latestCompletedToolExecution && canContinue) {
    const latestToolId = latestCompletedToolExecution.toolId;
    const wantsDirectoryOverview = queryRequestsDirectoryOverview(question);
    const wantsFileContent = queryRequestsFileContent(question);
    const explicitReadTarget = extractExplicitPathTarget(question);

    if (
      (latestToolId === "read_locate" || latestToolId === "read_list") &&
      wantsFileContent &&
      (explicitReadTarget || !wantsDirectoryOverview)
    ) {
      continueIteration = true;
      reviewDecision = "tool";
      decisionReason =
        "The latest tool only discovered workspace targets; the original question still asks for file content, so the agent should plan one more tool step.";
    } else {
      decisionReason =
        "The latest completed tool already produced answer-ready evidence for the current question.";
    }
  } else if (
    latestRetrieval &&
    latestRetrieval.chunkCount > 0 &&
    canContinue &&
    queryMentionsWorkspace(question)
  ) {
    continueIteration = true;
    reviewDecision = "tool";
    decisionReason =
      "Knowledge retrieval produced evidence and the question still mentions workspace content, so the agent should re-check whether a workspace tool is now warranted.";
  } else if (latestRetrieval && latestRetrieval.chunkCount > 0) {
    decisionReason =
      "Retrieved knowledge is available and no additional tool step is required before answer generation.";
  } else if (!canContinue && (latestCompletedToolExecution || latestRetrieval)) {
    decisionReason =
      "The review budget is exhausted, so the agent must stop planning and generate the final answer from current evidence.";
  }

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId,
    ...traceAttemptMeta,
    nodeType: "reason",
    phase: "done",
    label: "回看决策",
    summary: continueIteration
      ? "证据表明还需要一次规划回看"
      : "当前证据已足够进入回答生成",
    details: {
      iterationCount,
      maxIterations,
      reviewDecision,
      latestToolId: latestCompletedToolExecution?.toolId ?? null,
      latestRetrievalChunkCount: latestRetrieval?.chunkCount ?? 0,
      completedToolExecutionCount: completedToolExecutions.length,
      retrievalEvidenceCount: evidence.retrievals.length,
      observationCount: evidence.observations.length,
      continueIteration,
      decisionReason,
    },
  });

  return {
    continueIteration,
    postToolReviewPending: continueIteration,
    reviewDecision,
    reviewReason: decisionReason,
  };
};
