/**
 * 检索节点：基于用户问题执行 RAG 检索，并将结果加入证据。
 */
import { agentRagRunnable } from "../runnables";
import { emitStepNode } from "../node-runtime";
import {
  createObservation,
  getLatestUserQuestion,
  nowIso,
} from "./shared";
import type { AgentNodeState, EmitAgentExecutionNode } from "../node-runtime";
import type { AgentRetrievalEvidence } from "../types";

export const retrieveNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  const question = getLatestUserQuestion(state.messages) || state.goal.text;
  const retrievalQuery =
    state.nextAction?.type === "retrieve" && state.nextAction.query.trim()
      ? state.nextAction.query.trim()
      : question;
  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-retrieve",
    nodeType: "retrieve",
    phase: "start",
    label: "检索上下文",
    summary: "正在复用 RAG 图检索上下文",
    details: {
      knowledgeBaseId: state.knowledgeBaseId ?? null,
    },
  });

  if (!state.knowledgeBaseId) {
    const observation = createObservation({
      runId: state.runId,
      stepId: "retrieve",
      status: "partial",
      facts: ["当前线程没有绑定知识库，跳过 RAG 检索。"],
    });
    await emitStepNode(emit, {
      runId: state.runId,
      nodeId: "agent-retrieve",
      nodeType: "retrieve",
      phase: "done",
      label: "检索上下文",
      summary: "未绑定知识库，已跳过检索",
      details: {
        retrievedCount: 0,
      },
    });
    return {
      retrievedChunks: [],
      observations: [...(state.observations ?? []), observation],
      pendingEvidenceObservation: observation,
      pendingRetrievalEvidence: undefined,
      iterationCount: (state.iterationCount ?? 0) + 1,
    };
  }

  const ragResult = await agentRagRunnable.invoke({
    question: retrievalQuery,
    knowledgeBaseId: state.knowledgeBaseId,
    conversationHistory: state.messages,
    requestContextMessages: state.requestContextMessages,
  });
  const retrievedChunks = ragResult.sources ?? [];
  const retrievalEvidence: AgentRetrievalEvidence = {
    knowledgeBaseId: state.knowledgeBaseId,
    query: retrievalQuery,
    chunkCount: retrievedChunks.length,
    chunks: retrievedChunks.map((chunk) => ({
      chunkId: chunk.chunkId,
      documentName: chunk.documentName,
      score: chunk.score,
      content: chunk.content,
    })),
    createdAt: nowIso(),
  };
  const observation = createObservation({
    runId: state.runId,
    stepId: "retrieve",
    status: "ok",
    facts: [`RAG returned ${retrievedChunks.length} source(s).`],
  });

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-retrieve",
    nodeType: "retrieve",
    phase: "done",
    label: "检索上下文",
    summary:
      retrievedChunks.length > 0
        ? `已检索到 ${retrievedChunks.length} 条上下文`
        : "未检索到可用上下文",
    details: {
      retrievedCount: retrievedChunks.length,
      sources: retrievedChunks.map((chunk) => ({
        chunkId: chunk.chunkId,
        documentName: chunk.documentName,
        score: chunk.score,
      })),
    },
  });
  return {
    retrievedChunks,
    observations: [...(state.observations ?? []), observation],
    pendingEvidenceObservation: observation,
    pendingRetrievalEvidence: retrievalEvidence,
    iterationCount: (state.iterationCount ?? 0) + 1,
  };
};
