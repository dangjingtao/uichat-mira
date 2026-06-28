import { listCapabilityDefinitions } from "@/mcp/harness/registry.js";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import { contextBudgetService, type ContextBudgetAudit } from "@/services/context-budget/index.js";
import type { RetrievedChunk } from "@/services/rag-nodes";
import { agentGenerateTextRunnable, agentRagRunnable } from "./runnables.js";
import type {
  AgentIntentEmbeddingConfig,
  CapabilityIntentResult,
} from "./intent/index.js";
import { evaluateAgentToolPolicy } from "./policy.js";
import { toAgentExecutionNode, toPlanNodeDetails } from "./trace.js";
import type {
  AgentApprovalRequest,
  AgentGoal,
  AgentObservation,
  AgentPlan,
  AgentPlanStep,
} from "./types.js";

const nowIso = () => new Date().toISOString();

export interface AgentNodeState {
  runId: string;
  threadId: string;
  userId: number;
  goal: AgentGoal;
  plan: AgentPlan;
  messages: NormalizedChatMessage[];
  requestContextMessages?: NormalizedChatMessage[];
  params?: Record<string, unknown>;
  knowledgeBaseId?: string | null;
  intentConfig?: AgentIntentEmbeddingConfig;
  capabilityIntent?: CapabilityIntentResult;
  answer?: string;
  retrievedChunks?: RetrievedChunk[];
  observations?: AgentObservation[];
  blockedReason?: string;
  pendingApproval?: AgentApprovalRequest;
  approvedToolIds?: string[];
  contextBudget?: ContextBudgetAudit;
  errorMessage?: string;
  errorSourceNodeId?: string;
}

export type EmitAgentExecutionNode = (event: ReturnType<typeof toAgentExecutionNode>) => Promise<void> | void;

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

export const emitStepNode = async (
  emit: EmitAgentExecutionNode | undefined,
  input: Parameters<typeof toAgentExecutionNode>[0],
) => {
  await emit?.(toAgentExecutionNode(input));
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
    summary: "正在读取线程上下文和可用能力",
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

export const policyNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-policy",
    nodeType: "reason",
    phase: "start",
    label: "审批策略",
    summary: "正在判断候选能力是否需要审批",
  });

  const selectedCapabilityIds = state.capabilityIntent?.selectedCapabilityIds ?? [];
  const capabilityDefinitions = listCapabilityDefinitions();
  const selectedDefinition = capabilityDefinitions.find((definition) =>
    selectedCapabilityIds.includes(definition.id),
  );

  if (!selectedDefinition) {
    await emitStepNode(emit, {
      runId: state.runId,
      nodeId: "agent-policy",
      nodeType: "reason",
      phase: "done",
      label: "审批策略",
      summary: "未命中需要审批的能力",
      details: {
        selectedCapabilityIds,
      },
    });
    return {};
  }

  const decision = evaluateAgentToolPolicy(selectedDefinition);
  if (decision.type !== "require_approval") {
    await emitStepNode(emit, {
      runId: state.runId,
      nodeId: "agent-policy",
      nodeType: "reason",
      phase: "done",
      label: "审批策略",
      summary: "命中能力可直接执行",
      details: {
        selectedCapabilityIds,
        capabilityId: selectedDefinition.id,
        policyDecision: decision.type,
      },
    });
    return {};
  }

  if (state.approvedToolIds?.includes(selectedDefinition.id)) {
    await emitStepNode(emit, {
      runId: state.runId,
      nodeId: "agent-policy",
      nodeType: "reason",
      phase: "done",
      label: "审批策略",
      summary: "该能力已获得本轮批准，继续执行",
      details: {
        selectedCapabilityIds,
        capabilityId: selectedDefinition.id,
        policyDecision: "approved",
      },
    });

    return {};
  }

  const pendingApproval: AgentApprovalRequest = {
    id: crypto.randomUUID(),
    runId: state.runId,
    stepId: "approval",
    toolId: selectedDefinition.id,
    reason: decision.reason,
    createdAt: nowIso(),
  };

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-policy",
    nodeType: "reason",
    phase: "done",
    label: "审批策略",
    summary: "已命中需要审批的能力",
    details: {
      selectedCapabilityIds,
      capabilityId: selectedDefinition.id,
      policyDecision: decision.type,
      approvalReason: decision.reason,
    },
  });

  return {
    pendingApproval,
  };
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
      sourceNodeId: state.errorSourceNodeId ?? null,
      blockedReason: state.blockedReason ?? null,
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
    };
  }

  const ragResult = await agentRagRunnable.invoke({
    question,
    knowledgeBaseId: state.knowledgeBaseId,
    conversationHistory: state.messages,
    requestContextMessages: state.requestContextMessages,
  });
  const retrievedChunks = ragResult.sources ?? [];
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
  };
};

const buildGenerateMessages = (
  state: AgentNodeState,
): NormalizedChatMessage[] => {
  const retrievedChunks = state.retrievedChunks ?? [];
  if (retrievedChunks.length === 0) {
    return [...(state.requestContextMessages ?? []), ...state.messages];
  }

  const contextText = retrievedChunks
    .map(
      (chunk, index) =>
        `[${index + 1}] ${chunk.documentName}\n${chunk.content}`,
    )
    .join("\n\n");

  return [
    ...(state.requestContextMessages ?? []),
    {
      role: "system",
      content: `以下是 Agent 检索到的上下文，请优先依据这些内容回答，并说明不确定性。\n\n${contextText}`,
      parts: [
        {
          type: "text",
          text: `以下是 Agent 检索到的上下文，请优先依据这些内容回答，并说明不确定性。\n\n${contextText}`,
        },
      ],
    },
    ...state.messages,
  ];
};

const buildGenerateContextBudget = (state: AgentNodeState) =>
  contextBudgetService.pack({
    policy: state.knowledgeBaseId ? "rag-chat" : "plain-chat",
    roleType: "llm",
    sections: {
      prefaceMessages: state.requestContextMessages,
      instructionMessages: [],
      payloads: state.retrievedChunks?.length
        ? [
            {
              id: "agent-retrieval-payload",
              required: true,
              messages: state.retrievedChunks.map((chunk, index) => ({
                role: "system",
                content: `[${index + 1}] ${chunk.documentName}\n${chunk.content}`,
              })),
            },
          ]
        : [],
      historyMessages: state.messages.slice(0, -1),
      latestUserMessage: {
        role: "user",
        content: getLatestUserQuestion(state.messages) || state.goal.text,
      },
    },
  });

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
  const answer = await agentGenerateTextRunnable.invoke({
    messages: budget.messages,
    params: state.params,
  });
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
      },
    });

    return {
      observations: [...(state.observations ?? []), observation],
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
    },
  });

  return {
    answer,
    observations: [...(state.observations ?? []), observation],
    contextBudget: budget.audit,
  };
};

export const evaluateNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  const answer = state.answer?.trim() ?? "";
  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-evaluate",
    nodeType: "evaluate",
    phase: "start",
    label: "检查结果",
    summary: "正在检查 Agent 执行结果",
  });

  const ok = answer.length > 0;
  const observation = createObservation({
    runId: state.runId,
    stepId: "evaluate",
    status: ok ? "ok" : "failed",
    facts: [ok ? "Agent run produced a final answer." : "Agent run did not produce an answer."],
    ...(ok ? {} : { errorMessage: "Agent run did not produce an answer." }),
  });

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-evaluate",
    nodeType: "evaluate",
    phase: ok ? "done" : "error",
    label: "检查结果",
    summary: ok ? "Agent 执行已完成" : "Agent 执行未产出回答",
  });

  return {
    observations: [...(state.observations ?? []), observation],
    ...(ok ? {} : { blockedReason: "Agent run did not produce an answer." }),
  };
};
