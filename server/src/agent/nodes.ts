import { listCapabilityDefinitions } from "@/mcp/harness/registry.js";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import { providerProxyService } from "@/services/provider-proxy.service/index.js";
import { contextBudgetService, type ContextBudgetAudit } from "@/services/context-budget/index.js";
import type { RetrievedChunk } from "@/services/rag-nodes";
import { agentGenerateTextRunnable, agentRagRunnable } from "./runnables.js";
import { evaluateAgentToolPolicy } from "./policy.js";
import {
  appendObservationEvidence,
  appendRetrievalEvidence,
  getEvidenceCounts,
  getEvidencePayload,
  getLatestEvidenceSummary,
} from "./evidence.js";
import {
  emitStepNode,
  getIterativeNodeId,
  getTraceAttemptMeta,
  type AgentGraphState,
  type AgentNodeState,
  type EmitAgentExecutionNode,
} from "./node-runtime.js";
import { toAgentExecutionNode, toPlanNodeDetails } from "./trace.js";
export { nextActionPlannerNode } from "./next-action-planner.js";
export { policyNode } from "./policy-node.js";
export { toolCallNormalizeNode } from "./tool-call-normalize.js";
export { toolNode } from "./tool-node.js";
export type {
  AgentGraphState,
  AgentNodeState,
  EmitAgentExecutionNode,
} from "./node-runtime.js";
export { emitStepNode, getIterativeNodeId, getTraceAttemptMeta } from "./node-runtime.js";
import type {
  AgentEvidencePayload,
  AgentEvidenceSummary,
  AgentGoal,
  AgentNextAction,
  AgentObservation,
  AgentPlan,
  AgentPlanStep,
  AgentRetrievalEvidence,
  AgentToolExecutionResult,
} from "./types.js";

const nowIso = () => new Date().toISOString();

const HIGH_RISK_WORKSPACE_MUTATION_PATTERNS = [
  /\b(delete|remove|rm|move|mv|rename|write|overwrite|modify|patch|replace)\b/i,
  /(删除|移除|删掉|移动|重命名|写入|覆盖|修改|替换)/,
];

const isHighRiskWorkspaceMutationRequest = (query: string) =>
  HIGH_RISK_WORKSPACE_MUTATION_PATTERNS.some((pattern) => pattern.test(query));

const getTerminalAutoExecutionBlockReason = (query: string) =>
  isHighRiskWorkspaceMutationRequest(query)
    ? "High-risk workspace mutations are blocked until a managed workspace tool exists for this operation."
    : "Agent does not auto-build terminal_session.command. Terminal execution must wait for explicit, reviewed parameters.";

const trimWrappedPath = (value: string) =>
  value
    .trim()
    .replace(/^["'`]/, "")
    .replace(/["'`]$/, "")
    .trim();

const extractQuotedValue = (query: string) => {
  const match = query.match(/["'`](.+?)["'`]/);
  return match ? trimWrappedPath(match[1]) : null;
};

const cleanTrailingPunctuation = (value: string) =>
  value.replace(/[。．，,；;！!？?]+$/u, "").trim();

const extractExplicitPathTarget = (query: string) => {
  const quoted = extractQuotedValue(query);
  if (quoted) {
    return cleanTrailingPunctuation(quoted);
  }

  const directPathMatch = query.match(/(?:^|[\s(])([a-zA-Z]:\\[^\s)]+|[.~]{0,2}[\\/][^\s)]+)/u);
  if (directPathMatch?.[1]) {
    return cleanTrailingPunctuation(trimWrappedPath(directPathMatch[1]));
  }

  const fileNameMatch = query.match(/\b[\w.-]+\.[a-z0-9]{1,12}\b/i);
  return fileNameMatch?.[0] ? cleanTrailingPunctuation(fileNameMatch[0]) : null;
};

const getWorkspaceMutationBlockReason = (query: string) =>
  isHighRiskWorkspaceMutationRequest(query)
    ? "High-risk workspace mutation request could not be converted into reviewed structured parameters."
    : "Workspace mutation execution requires explicit structured parameters.";

const createObservation = (input: {
  runId: string;
  stepId: string;
  status: AgentObservation["status"];
  facts: string[];
  errorMessage?: string;
}): AgentObservation => ({
  id: crypto.randomUUID(),
  runId: input.runId,
  stepId: input.stepId,
  status: input.status,
  facts: input.facts,
  ...(input.errorMessage ? { errorMessage: input.errorMessage } : {}),
  createdAt: nowIso(),
});

export const createAgentGoal = (text: string): AgentGoal => ({
  id: crypto.randomUUID(),
  text,
  successCriteria: ["回答用户当前问题，并说明不确定性。"],
  constraints: ["复用当前项目已有 RAG、Harness、provider 和 trace 基建。"],
  riskLevel: "low",
});

// V1 only keeps a minimal static plan skeleton for trace and run metadata.
// It is not a completed TaskFrame implementation.
export const createAgentPlan = (goal: AgentGoal): AgentPlan => ({
  id: crypto.randomUUID(),
  goalId: goal.id,
  version: 1,
  steps: [
    {
      id: "plan",
      kind: "reason",
      title: "建立 Agent 执行计划",
      status: "pending",
      riskLevel: "low",
      requiresApproval: false,
    },
    {
      id: "retrieve",
      kind: "retrieve",
      title: "检索可用上下文",
      status: "pending",
      riskLevel: "low",
      requiresApproval: false,
    },
    {
      id: "generate",
      kind: "generate",
      title: "生成最终回答",
      status: "pending",
      riskLevel: "low",
      requiresApproval: false,
    },
    {
      id: "evaluate",
      kind: "reason",
      title: "检查回答是否满足目标",
      status: "pending",
      riskLevel: "low",
      requiresApproval: false,
    },
  ],
});

export const getLatestUserQuestion = (messages: NormalizedChatMessage[]) => {
  const latest = [...messages].reverse().find((message) => message.role === "user");
  return latest?.content.trim() ?? "";
};

const emitNodeError = async (
  emit: EmitAgentExecutionNode | undefined,
  input: {
    runId: string;
    nodeId: string;
    label: string;
    summary: string;
    details?: Record<string, unknown>;
  },
) => {
  await emit?.(
    toAgentExecutionNode({
      runId: input.runId,
      nodeId: input.nodeId,
      nodeType: "error",
      phase: "error",
      label: input.label,
      summary: input.summary,
      details: input.details,
    }),
  );
};

const emitApprovalNode = async (
  emit: EmitAgentExecutionNode | undefined,
  input: {
    runId: string;
    nodeId: string;
    label: string;
    summary: string;
    details?: Record<string, unknown>;
  },
) => {
  await emit?.(
    toAgentExecutionNode({
      runId: input.runId,
      nodeId: input.nodeId,
      nodeType: "approval",
      phase: "done",
      label: input.label,
      summary: input.summary,
      details: input.details,
    }),
  );
};

const emitEvidenceUpdateNode = async (
  emit: EmitAgentExecutionNode | undefined,
  input: {
    runId: string;
    nodeId: string;
    summary: string;
    details: Record<string, unknown>;
  },
) => {
  await emitStepNode(emit, {
    runId: input.runId,
    nodeId: input.nodeId,
    nodeType: "reason",
    phase: "done",
    label: "证据写回",
    summary: input.summary,
    details: input.details,
  });
};

export const prepareContextNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-prepare-context",
    nodeType: "reason",
    phase: "start",
    label: "准备上下文",
    summary: "正在读取线程上下文和可用工具",
  });

  const toolDefinitions = listCapabilityDefinitions();
  const autoAllowedTools = toolDefinitions
    .filter((definition) => evaluateAgentToolPolicy(definition).type === "allow")
    .map((definition) => definition.id);

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-prepare-context",
    nodeType: "reason",
    phase: "done",
    label: "准备上下文",
    summary: "已完成 Agent 上下文准备",
    details: {
      messageCount: state.messages.length,
      requestContextCount: state.requestContextMessages?.length ?? 0,
      autoAllowedTools,
    },
  });

  return {};
};

export const planNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  // planNode is still a placeholder trace node in V1. It does not rewrite the
  // run plan or produce a completed TaskFrame structure.
  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-plan",
    nodeType: "plan",
    phase: "start",
    label: "执行计划",
    summary: "正在生成最小 Agent 计划",
  });

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-plan",
    nodeType: "plan",
    phase: "done",
    label: "执行计划",
    summary: "已生成最小 Agent 计划",
    details: toPlanNodeDetails(state.plan.steps),
  });

  return {};
};

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
      toolId: state.pendingApproval.toolId,
      reason: state.pendingApproval.reason,
      inputHash: state.pendingApproval.inputHash,
    },
  });

  return {
    blockedReason: "waiting approval",
  };
};

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
    const evidence = appendObservationEvidence(state, observation);
    await emitEvidenceUpdateNode(emit, {
      runId: state.runId,
      nodeId: "agent-evidence-update-retrieve",
      summary: "检索跳过结果已写入 evidence",
      details: {
        sourceNode: "retrieveNode",
        retrievalChunkCount: 0,
        latestEvidenceSummary: evidence.latestSummary ?? getLatestEvidenceSummary({ evidence }),
        evidenceCounts: getEvidenceCounts({ evidence }),
        iteration: state.iterationCount ?? 0,
        maxIterations: state.maxIterations ?? null,
      },
    });
    return {
      retrievedChunks: [],
      observations: [...(state.observations ?? []), observation],
      evidence,
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
  const evidence = appendRetrievalEvidence(
    {
      ...state,
      evidence: appendObservationEvidence(state, observation),
    },
    retrievalEvidence,
  );
  await emitEvidenceUpdateNode(emit, {
    runId: state.runId,
    nodeId: "agent-evidence-update-retrieve",
    summary: "检索结果已写入 evidence",
    details: {
      sourceNode: "retrieveNode",
      query: retrievalQuery,
      retrievalChunkCount: retrievedChunks.length,
      latestEvidenceSummary: evidence.latestSummary ?? getLatestEvidenceSummary({ evidence }),
      evidenceCounts: getEvidenceCounts({ evidence }),
      iteration: (state.iterationCount ?? 0) + 1,
      maxIterations: state.maxIterations ?? null,
    },
  });

  return {
    retrievedChunks,
    observations: [...(state.observations ?? []), observation],
    evidence,
    iterationCount: (state.iterationCount ?? 0) + 1,
  };
};

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

const buildGenerateMessages = (state: AgentNodeState): NormalizedChatMessage[] => {
  const baseMessages = [
    ...(state.requestContextMessages ?? []),
    ...buildGenerateInstructionMessages(state),
  ];
  const evidenceMessages = buildGenerateEvidenceMessages(state);

  return [
    ...baseMessages,
    ...evidenceMessages,
    ...state.messages
      .slice(0, -1)
      .filter((message) => message.role === "user" || message.role === "system"),
    state.messages[state.messages.length - 1]!,
  ];
};

const GENERATE_OUTPUT_GUARD_PATTERNS = [
  /<function_calls?>/i,
  /^\s*\{[\s\S]*"type"\s*:\s*"(?:answer|retrieve|use_tool|error)"/i,
  /^\s*\{[\s\S]*"toolId"\s*:/i,
  /pendingToolCall\s*:/i,
  /toolId\s*:/i,
  /\bargs\s*:/i,
  /(我将调用|下一步我会|我会先调用|I will call|next step I will)/i,
];

const PENDING_APPROVAL_FAKE_EXECUTION_PATTERNS = [
  /(已经执行|已执行|执行完成|输出如下|结果如下)/u,
  /(already executed|executed successfully|output is|result is)/i,
];

const toPreviewText = (value: string, limit = 220) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  return normalized.length > limit
    ? `${normalized.slice(0, limit).trimEnd()}...`
    : normalized;
};

const formatEvidenceBulletList = (items: string[]) =>
  items
    .filter((item) => item.trim())
    .map((item) => `- ${item}`)
    .join("\n");

const buildToolEvidenceBlock = (execution: AgentToolExecutionResult) => {
  const summary = execution.summary;
  if (!summary) {
    return [
      `toolId: ${execution.toolId}`,
      `status: ${execution.status}`,
      "keyFindings:",
      "- This tool completed, but no stable answer summary was attached.",
    ].join("\n");
  }

  const lines = [
    `toolId: ${execution.toolId}`,
    `status: ${summary.status}`,
    `actionTaken: ${summary.actionTaken}`,
  ];

  if (summary.data?.kind === "read_list") {
    lines.push(`path: ${summary.data.path}`);
    lines.push(`entryCount: ${summary.data.entryCount}`);
    lines.push(`entriesPreview: ${summary.data.entriesPreview.join(" | ") || "(none)"}`);
    lines.push(`truncated: ${summary.data.truncated}`);
  } else if (summary.data?.kind === "read_open") {
    lines.push(`path: ${summary.data.path}`);
    lines.push(`contentPreview: ${summary.data.contentPreview || "(empty)"}`);
    lines.push(`contentLength: ${summary.data.contentLength}`);
  } else if (summary.data?.kind === "web_search") {
    lines.push(`query: ${summary.data.query}`);
    lines.push(`resultCount: ${summary.data.resultCount}`);
    lines.push(`topFindings: ${summary.data.topFindings.join(" | ") || "(none)"}`);
  } else if (summary.data?.kind === "terminal_session") {
    lines.push(`command: ${summary.data.command}`);
    lines.push(`exitCode: ${summary.data.exitCode === null ? "null" : summary.data.exitCode}`);
    lines.push(`stdoutPreview: ${summary.data.stdoutPreview || "(empty)"}`);
    lines.push(`stderrPreview: ${summary.data.stderrPreview || "(empty)"}`);
  }

  lines.push("keyFindings:");
  lines.push(formatEvidenceBulletList(summary.keyFindings));
  return lines.join("\n");
};

const buildRetrievalEvidenceBlock = (retrieval: AgentRetrievalEvidence) => {
  const summary = retrieval.summary;
  const chunkPreview = retrieval.chunks
    .slice(0, 3)
    .map(
      (chunk, index) =>
        `[${index + 1}] ${chunk.documentName}: ${toPreviewText(chunk.content, 160)}`,
    )
    .join("\n");

  return [
    `query: ${retrieval.query}`,
    `chunkCount: ${retrieval.chunkCount}`,
    ...(summary?.data?.kind === "retrieval" && summary.data.documentsPreview.length > 0
      ? [`documentsPreview: ${summary.data.documentsPreview.join(" | ")}`]
      : []),
    "chunks:",
    chunkPreview || "- (none)",
  ].join("\n");
};

const buildGenerateEvidenceMessages = (
  state: AgentNodeState,
): NormalizedChatMessage[] => {
  const evidence = getEvidencePayload(state);
  const evidenceMessages: NormalizedChatMessage[] = [];

  const completedToolExecutions = evidence.toolExecutions.filter(
    (execution) => execution.status === "completed",
  );

  if (completedToolExecutions.length > 0) {
    const toolEvidenceText = [
      "以下是本轮 Agent 已实际执行完成的工具证据摘要。",
      ...completedToolExecutions.map((execution, index) =>
        [`#${index + 1}`, buildToolEvidenceBlock(execution)].join("\n"),
      ),
      "你只能基于这些真实证据回答；不要复述工具协议，也不要输出工具 JSON。",
    ].join("\n\n");
    evidenceMessages.push({
      role: "system",
      content: toolEvidenceText,
      parts: [
        {
          type: "text",
          text: toolEvidenceText,
        },
      ],
    });
  }

  const retrievalEvidenceChunks =
    evidence.retrievals.length > 0
      ? evidence.retrievals
      : (state.retrievedChunks ?? []).map((chunk) => ({
          query: getLatestUserQuestion(state.messages) || state.goal.text,
          chunkCount: 1,
          chunks: [
            {
              chunkId: chunk.chunkId,
              documentName: chunk.documentName,
              score: chunk.score,
              content: chunk.content,
            },
          ],
          createdAt: nowIso(),
        }));

  if (retrievalEvidenceChunks.length > 0) {
    const contextText = retrievalEvidenceChunks
      .map((retrieval, index) => [`#${index + 1}`, buildRetrievalEvidenceBlock(retrieval)].join("\n"))
      .join("\n\n");

    evidenceMessages.push({
      role: "system",
      content: `以下是 Agent 检索到的真实上下文证据，请优先依据这些内容回答，并说明不确定性。\n\n${contextText}`,
      parts: [
        {
          type: "text",
          text: `以下是 Agent 检索到的真实上下文证据，请优先依据这些内容回答，并说明不确定性。\n\n${contextText}`,
        },
      ],
    });
  }

  return evidenceMessages;
};

const buildGenerateInstructionMessages = (
  state: AgentNodeState,
): NormalizedChatMessage[] => {
  const evidence = getEvidencePayload(state);
  const hasCompletedToolEvidence = evidence.toolExecutions.some(
    (execution) => execution.status === "completed",
  );
  const hasRetrievalEvidence = evidence.retrievals.some(
    (retrieval) => retrieval.chunkCount > 0,
  );

  return [
    {
      role: "system",
      content: [
        "你现在处于 Agent 的最终回答阶段，不是 Planner。",
        "你的输出必须是直接面向用户的自然语言最终回答。",
        "不要输出工具调用 JSON、nextAction JSON、trace 文本、pendingToolCall、toolId、args、<function_calls> 或类似协议内容。",
        "不要说“我将调用工具”“下一步我会”或任何伪执行话术。",
        state.pendingApproval
          ? "当前存在 pendingApproval。你只能说明工具仍在等待审批，当前还没有真实执行结果，不能假装命令或工具已经执行。"
          : "如果已存在 completed evidence，请只基于这些真实 evidence 回答。",
        hasCompletedToolEvidence || hasRetrievalEvidence
          ? "如果 evidence 足够，请直接总结事实；如果 evidence 仍不足，请明确说明缺什么。"
          : "当前没有真实检索结果或已完成工具结果时，不要声称自己已经查看过文件、目录、网页、知识库或外部系统。",
      ].join("\n"),
    },
  ];
};

const buildGenerateContextBudget = (state: AgentNodeState) =>
  contextBudgetService.pack({
    policy: state.knowledgeBaseId ? "rag-chat" : "plain-chat",
    roleType: "llm",
    sections: {
      prefaceMessages: state.requestContextMessages,
      instructionMessages: buildGenerateInstructionMessages(state),
      payloads: getEvidencePayload(state).retrievals.length
        ? [
            {
              id: "agent-retrieval-payload",
              required: true,
              messages: getEvidencePayload(state).retrievals.flatMap((retrieval) =>
                retrieval.chunks.map((chunk, index) => ({
                  role: "system" as const,
                  content: `[${index + 1}] ${chunk.documentName}\n${chunk.content}`,
                })),
              ),
            },
          ]
        : state.retrievedChunks?.length
          ? [
              {
                id: "agent-retrieval-payload",
                required: true,
                messages: state.retrievedChunks.map((chunk, index) => ({
                  role: "system" as const,
                  content: `[${index + 1}] ${chunk.documentName}\n${chunk.content}`,
                })),
              },
            ]
          : [],
      historyMessages: state.messages
        .slice(0, -1)
        .filter((message) => message.role === "user" || message.role === "system"),
      latestUserMessage: {
        role: "user",
        content: getLatestUserQuestion(state.messages) || state.goal.text,
      },
    },
  });

const DIRECTORY_OVERVIEW_TOKENS = [
  "list",
  "show",
  "what's in",
  "what is in",
  "contents",
  "under",
  "inside",
  "有哪些",
  "有啥",
  "有什么",
  "列出",
  "内容",
  "看看",
];

const FILE_CONTENT_TOKENS = [
  "open",
  "read",
  "content",
  "contents",
  "inside",
  "详情",
  "内容",
  "打开",
  "读取",
  "阅读",
  "查看",
];

const WORKSPACE_TOKENS = [
  "workspace",
  "folder",
  "directory",
  "repo",
  "repository",
  "project",
  "file",
  "files",
  "文件",
  "文件夹",
  "目录",
  "工作区",
  "项目",
  "仓库",
];

const normalizeIntentText = (value: string) => value.trim().toLowerCase();

const includesAnyToken = (value: string, tokens: string[]) =>
  tokens.some((token) => value.includes(token));

const queryRequestsDirectoryOverview = (query: string) =>
  includesAnyToken(normalizeIntentText(query), DIRECTORY_OVERVIEW_TOKENS);

const queryRequestsFileContent = (query: string) => {
  const normalized = normalizeIntentText(query);
  if (includesAnyToken(normalized, FILE_CONTENT_TOKENS)) {
    return true;
  }

  return /[\w-]+\.[a-z0-9]{1,12}\b/i.test(query);
};

const queryMentionsWorkspace = (query: string) =>
  includesAnyToken(normalizeIntentText(query), WORKSPACE_TOKENS);

const summarizeToolResult = (result: unknown) => {
  if (!result || typeof result !== "object") {
    return null;
  }

  const value = result as Record<string, unknown>;
  const hits = Array.isArray(value.hits) ? value.hits : [];
  const entries = Array.isArray(value.entries) ? value.entries : [];

  if (hits.length > 0) {
    return `Located ${hits.length} workspace hit(s).`;
  }

  if (entries.length > 0) {
    return `Listed ${entries.length} workspace entr${entries.length === 1 ? "y" : "ies"}.`;
  }

  if (typeof value.content === "string" && value.content.trim()) {
    return `Opened content with ${Array.from(value.content.trim()).length} characters.`;
  }

  return null;
};

const buildCapabilityReviewContext = (state: AgentNodeState) => {
  const evidence = getEvidencePayload(state);
  const notes: string[] = [];
  const latestRetrieval = evidence.retrievals.at(-1);
  const latestCompletedTool = [...evidence.toolExecutions]
    .reverse()
    .find((execution) => execution.status === "completed");

  if (latestRetrieval && latestRetrieval.chunkCount > 0) {
    const documentNames = latestRetrieval.chunks
      .slice(0, 3)
      .map((chunk) => chunk.documentName)
      .filter(Boolean);
    notes.push(
      `Retrieved ${latestRetrieval.chunkCount} knowledge chunk(s)${
        documentNames.length > 0 ? ` from ${documentNames.join(", ")}` : ""
      }.`,
    );
  }

  if (latestCompletedTool?.result) {
    const toolSummary = summarizeToolResult(latestCompletedTool.result);
    if (toolSummary) {
      notes.push(`${latestCompletedTool.toolId}: ${toolSummary}`);
    }
  }

  return notes;
};

const answerClaimsUnverifiedObservation = (answer: string) => {
  const normalized = answer.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  const patterns = [
    /i (checked|looked at|opened|searched|found|read)\b/i,
    /(我已|我刚|我查看了|我看了|我打开了|我搜索了|我找到了|我读取了)/u,
    /(根据(文件|目录|网页|知识库|检索结果|工具结果))/u,
    /(search results|tool result|retrieved context|knowledge base)/i,
  ];

  return patterns.some((pattern) => pattern.test(answer));
};

const renderSummaryBasedAnswer = (summary: AgentEvidenceSummary) => {
  if (summary.source === "tool" && summary.data?.kind === "read_list") {
    const preview = summary.data.entriesPreview.join("、");
    return summary.data.entryCount > 0
      ? `当前 workspace 下共找到 ${summary.data.entryCount} 项，其中预览包括 ${preview}${summary.data.truncated ? " 等内容。" : "。"}` 
      : `当前 workspace 路径 ${summary.data.path} 下没有列出任何条目。`;
  }

  if (summary.source === "tool" && summary.data?.kind === "read_open") {
    const keySections =
      summary.data.keySections && summary.data.keySections.length > 0
        ? `重点段落包括 ${summary.data.keySections.join("、")}。`
        : "";
    return summary.data.contentPreview
      ? `${summary.data.path} 的已读取内容显示：${summary.data.contentPreview}${keySections ? ` ${keySections}` : ""}`
      : `${summary.data.path} 已打开，但当前可用内容为空，暂时无法给出可靠概括。`;
  }

  if (summary.source === "tool" && summary.data?.kind === "web_search") {
    const finding = summary.data.topFindings[0];
    return finding
      ? `当前检索到 ${summary.data.resultCount} 条网页结果，最相关信息是：${finding}`
      : `这次网页搜索没有返回可用结果，暂时无法基于真实搜索证据回答。`;
  }

  if (summary.source === "tool" && summary.data?.kind === "terminal_session") {
    const parts = [`命令 \`${summary.data.command}\` 已执行。`];
    if (summary.data.exitCode !== null) {
      parts.push(`退出码是 ${summary.data.exitCode}。`);
    }
    if (summary.data.stdoutPreview) {
      parts.push(`stdout 预览：${summary.data.stdoutPreview}`);
    }
    if (summary.data.stderrPreview) {
      parts.push(`stderr 预览：${summary.data.stderrPreview}`);
    }
    if (summary.data.timedOut) {
      parts.push("这次执行发生超时，结果可能不完整。");
    }
    return parts.join(" ");
  }

  if (summary.source === "retrieval" && summary.data?.kind === "retrieval") {
    return summary.data.documentsPreview.length > 0
      ? `当前检索已命中 ${summary.data.chunkCount} 条上下文，主要来自 ${summary.data.documentsPreview.join("、")}。`
      : `当前检索已命中 ${summary.data.chunkCount} 条上下文，可以基于这些检索证据回答。`;
  }

  return "";
};

const buildEvidenceGroundedFallbackAnswer = (state: AgentNodeState) => {
  if (state.pendingApproval) {
    return `这个${state.pendingApproval.toolId === "terminal_session" ? "命令" : "工具调用"}需要你审批后才能执行，当前还没有真实执行结果。`;
  }

  const evidence = getEvidencePayload(state);
  const latestSummary = evidence.latestSummary ?? getLatestEvidenceSummary({ evidence });
  if (latestSummary) {
    const summaryAnswer = renderSummaryBasedAnswer(latestSummary);
    if (summaryAnswer) {
      return summaryAnswer;
    }
  }

  const latestRetrieval = evidence.retrievals.at(-1);
  if (latestRetrieval && latestRetrieval.chunkCount > 0) {
    const chunk = latestRetrieval.chunks[0];
    if (chunk) {
      return `当前检索证据显示，${chunk.documentName} 提到：${toPreviewText(chunk.content, 220)}`;
    }
  }

  const latestCompletedTool = [...evidence.toolExecutions]
    .reverse()
    .find((execution) => execution.status === "completed");
  if (latestCompletedTool?.summary) {
    const summaryAnswer = renderSummaryBasedAnswer(latestCompletedTool.summary);
    if (summaryAnswer) {
      return summaryAnswer;
    }
  }

  return "当前还没有足够的已完成证据来可靠回答这个问题，所以我不能声称自己已经查看过相关文件、目录、网页或命令结果。";
};

const detectGenerateOutputGuardReason = (answer: string) => {
  if (!answer.trim()) {
    return undefined;
  }

  if (GENERATE_OUTPUT_GUARD_PATTERNS.some((pattern) => pattern.test(answer))) {
    return "generate output exposed tool-style protocol text instead of a user-facing final answer";
  }

  return undefined;
};

export const generateNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-generate",
    nodeType: "generate",
    phase: "start",
    label: "生成回答",
    summary: "正在生成 Agent 最终回答",
  });

  const budget = buildGenerateContextBudget(state);
  const messages = buildGenerateMessages(state);
  const generationMessages = messages;
  const generationInvocation = providerProxyService.describeChatInvocation(
    "default",
    generationMessages,
  );
  let answer: string;
  let outputGuardReason: string | undefined;
  try {
    answer = await agentGenerateTextRunnable.invoke({
      messages: generationMessages,
      params: state.params,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const observation = createObservation({
      runId: state.runId,
      stepId: "generate",
      status: "failed",
      facts: ["Agent final answer generation failed."],
      errorMessage,
    });

    await emitStepNode(emit, {
      runId: state.runId,
      nodeId: "agent-generate",
      nodeType: "generate",
      phase: "error",
      label: "生成回答",
      summary: `Agent 最终回答生成失败: ${errorMessage}`,
      details: {
        errorMessage,
        invocation: generationInvocation,
        contextBudget: budget.audit,
        messageCount: generationMessages.length,
      },
    });

    return {
      observations: [...(state.observations ?? []), observation],
      evidence: appendObservationEvidence(state, observation),
      errorMessage,
      errorSourceNodeId: "agent-generate",
      contextBudget: budget.audit,
    };
  }
  outputGuardReason = detectGenerateOutputGuardReason(answer);
  if (!outputGuardReason) {
    if (
      state.pendingApproval &&
      PENDING_APPROVAL_FAKE_EXECUTION_PATTERNS.some((pattern) => pattern.test(answer))
    ) {
      outputGuardReason =
        "generate output pretended a pending-approval tool had already executed";
    }
  }
  if (!outputGuardReason) {
    const evidence = getEvidencePayload(state);
    const hasCompletedToolEvidence = evidence.toolExecutions.some(
      (execution) => execution.status === "completed",
    );
    const hasRetrievalEvidence = evidence.retrievals.some(
      (retrieval) => retrieval.chunkCount > 0,
    );
    if (
      !hasCompletedToolEvidence &&
      !hasRetrievalEvidence &&
      answerClaimsUnverifiedObservation(answer)
    ) {
      outputGuardReason =
        "generate output claimed grounded observation without completed evidence";
    }
  }
  if (outputGuardReason) {
    answer = buildEvidenceGroundedFallbackAnswer(state);
  }
  if (!answer.trim()) {
    const errorMessage = "Model returned empty answer";
    const observation = createObservation({
      runId: state.runId,
      stepId: "generate",
      status: "failed",
      facts: ["Generated answer was empty."],
      errorMessage,
    });
    await emitStepNode(emit, {
      runId: state.runId,
      nodeId: "agent-generate",
      nodeType: "generate",
      phase: "error",
      label: "生成回答",
      summary: "Agent 回答为空",
      details: {
        answerLength: 0,
        invocation: generationInvocation,
        contextBudget: budget.audit,
        messageCount: generationMessages.length,
      },
    });

    return {
      observations: [...(state.observations ?? []), observation],
      evidence: appendObservationEvidence(state, observation),
      errorMessage,
      errorSourceNodeId: "agent-generate",
    };
  }
  const observation = createObservation({
    runId: state.runId,
    stepId: "generate",
    status: "ok",
    facts: [`Generated answer length: ${Array.from(answer).length}`],
  });

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-generate",
    nodeType: "generate",
    phase: answer.trim() ? "done" : "error",
    label: "生成回答",
    summary: answer.trim() ? "已生成 Agent 回答" : "Agent 回答为空",
      details: {
        answerLength: Array.from(answer).length,
        invocation: generationInvocation,
        contextBudget: budget.audit,
        messageCount: generationMessages.length,
        outputGuardTriggered: Boolean(outputGuardReason),
        outputGuardReason: outputGuardReason ?? null,
      },
    });

  return {
    answer,
    observations: [...(state.observations ?? []), observation],
    evidence: appendObservationEvidence(state, observation),
    contextBudget: budget.audit,
  };
};

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
