import { executeHarnessInvocation } from "@/mcp/harness/invocations.js";
import { listCapabilityDefinitions } from "@/mcp/harness/registry.js";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import { providerProxyService } from "@/services/provider-proxy.service/index.js";
import { contextBudgetService, type ContextBudgetAudit } from "@/services/context-budget/index.js";
import type { RetrievedChunk } from "@/services/rag-nodes";
import { agentGenerateTextRunnable, agentRagRunnable } from "./runnables.js";
import { createInvocationInputHash } from "./approval-fingerprint.js";
import type {
  AgentIntentEmbeddingConfig,
  CapabilityIntentResult,
} from "./intent/index.js";
import { evaluateAgentToolPolicy } from "./policy.js";
import { toAgentExecutionNode, toPlanNodeDetails } from "./trace.js";
import type {
  AgentApprovedInvocation,
  AgentApprovalRequest,
  AgentEvidencePayload,
  AgentGoal,
  AgentObservation,
  AgentPlan,
  AgentPlanStep,
  AgentRetrievalEvidence,
  AgentToolCallRequest,
  AgentToolExecutionResult,
} from "./types.js";

const nowIso = () => new Date().toISOString();

type ExecutionEnvironmentHint = {
  workspaceRoot?: string;
  cwd?: string;
  shellFamily?: "powershell" | "cmd" | "posix";
};

const parseExecutionEnvironmentHint = (
  messages: NormalizedChatMessage[] | undefined,
): ExecutionEnvironmentHint => {
  const content = messages
    ?.find(
      (message) =>
        message.role === "system" &&
        message.content.includes("当前执行平台：") &&
        message.content.includes("当前 shell："),
    )
    ?.content.trim();

  if (!content) {
    return {};
  }

  const workspaceRoot = content.match(/当前 workspaceRoot：(.+)/)?.[1]?.trim();
  const cwd = content.match(/当前 cwd：(.+)/)?.[1]?.trim();
  const shellFamily = content.match(/当前 shell：([^(]+)\s*\(/)?.[1]?.trim();

  return {
    ...(workspaceRoot && workspaceRoot !== "unknown"
      ? { workspaceRoot }
      : {}),
    ...(cwd && cwd !== "unknown" ? { cwd } : {}),
    ...(shellFamily === "powershell" || shellFamily === "cmd" || shellFamily === "posix"
      ? { shellFamily }
      : {}),
  };
};

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

const extractPathAfterVerb = (query: string, pattern: RegExp) => {
  const match = query.match(pattern);
  if (!match?.[1]) {
    return null;
  }

  return cleanTrailingPunctuation(trimWrappedPath(match[1]));
};

const extractMovePaths = (query: string) => {
  const match = query.match(
    /(?:move|rename|移动|重命名)\s+(.+?)\s+(?:to|into|as|到|为)\s+(.+?)(?:[。．，,；;！!？?]|$)/iu,
  );
  if (!match?.[1] || !match?.[2]) {
    return null;
  }

  return {
    targetPath: cleanTrailingPunctuation(trimWrappedPath(match[1])),
    destinationPath: cleanTrailingPunctuation(trimWrappedPath(match[2])),
  };
};

const extractWriteArgs = (query: string) => {
  const quotedContent = extractQuotedValue(query);
  const targetPath = extractPathAfterVerb(
    query,
    /(?:write|overwrite|save|写入|覆盖|保存)(?:\s+["'`].+?["'`])?\s+(?:to|into|到)?\s*(.+?)(?:[。．，,；;！!？?]|$)/iu,
  );
  if (quotedContent && targetPath) {
    return {
      operation: "write",
      targetPath,
      content: quotedContent,
      overwrite: true,
    } as const;
  }

  const chineseMatch = query.match(
    /把\s*["'`](.+?)["'`]\s*(?:写入|保存到|覆盖到)\s*(.+?)(?:[。．，,；;！!？?]|$)/u,
  );
  if (chineseMatch?.[1] && chineseMatch?.[2]) {
    return {
      operation: "write",
      targetPath: cleanTrailingPunctuation(trimWrappedPath(chineseMatch[2])),
      content: chineseMatch[1],
      overwrite: true,
    } as const;
  }

  return null;
};

const buildWorkspaceMutationArgs = (query: string) => {
  const normalized = query.trim();
  if (!normalized) {
    return null;
  }

  if (/\b(delete|remove|rm)\b/i.test(normalized) || /(删除|移除|删掉)/.test(normalized)) {
    const targetPath =
      extractPathAfterVerb(
        normalized,
        /(?:delete|remove|rm|删除|移除|删掉)\s+(.+?)(?:[。．，,；;！!？?]|$)/iu,
      ) ?? extractQuotedValue(normalized);
    if (!targetPath) {
      return null;
    }

    return {
      operation: "delete",
      targetPath,
      recursive: true,
    } as const;
  }

  if (/\b(move|rename|mv)\b/i.test(normalized) || /(移动|重命名)/.test(normalized)) {
    const movePaths = extractMovePaths(normalized);
    if (!movePaths) {
      return null;
    }

    return {
      operation: "move",
      targetPath: movePaths.targetPath,
      destinationPath: movePaths.destinationPath,
      overwrite: false,
    } as const;
  }

  if (/\b(write|overwrite|save)\b/i.test(normalized) || /(写入|覆盖|保存|新建文件)/.test(normalized)) {
    return extractWriteArgs(normalized);
  }

  return null;
};

const getWorkspaceMutationBlockReason = (query: string) =>
  isHighRiskWorkspaceMutationRequest(query)
    ? "High-risk workspace mutation request could not be converted into reviewed structured parameters."
    : "Workspace mutation execution requires explicit structured parameters.";

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
  approvedInvocations?: AgentApprovedInvocation[];
  selectedCapabilityId?: string;
  selectedToolId?: string;
  pendingToolCall?: AgentToolCallRequest;
  lastToolExecution?: AgentToolExecutionResult;
  evidence?: AgentEvidencePayload;
  contextBudget?: ContextBudgetAudit;
  errorMessage?: string;
  errorSourceNodeId?: string;
  iterationCount?: number;
  maxIterations?: number;
  continueIteration?: boolean;
  postToolReviewPending?: boolean;
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

const getEvidencePayload = (
  state: Pick<AgentNodeState, "observations" | "evidence">,
): AgentEvidencePayload => ({
  observations: state.evidence?.observations ?? state.observations ?? [],
  toolExecutions: state.evidence?.toolExecutions ?? [],
  retrievals: state.evidence?.retrievals ?? [],
});

const appendObservationEvidence = (
  state: Pick<AgentNodeState, "observations" | "evidence">,
  observation: AgentObservation,
): AgentEvidencePayload => {
  const current = getEvidencePayload(state);
  return {
    ...current,
    observations: [...current.observations, observation],
  };
};

const appendToolExecutionEvidence = (
  state: Pick<AgentNodeState, "observations" | "evidence">,
  execution: AgentToolExecutionResult,
): AgentEvidencePayload => {
  const current = getEvidencePayload(state);
  return {
    ...current,
    toolExecutions: [...current.toolExecutions, execution],
  };
};

const appendRetrievalEvidence = (
  state: Pick<AgentNodeState, "observations" | "evidence">,
  retrieval: AgentRetrievalEvidence,
): AgentEvidencePayload => {
  const current = getEvidencePayload(state);
  return {
    ...current,
    retrievals: [...current.retrievals, retrieval],
  };
};

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

export const getIterativeNodeId = (baseNodeId: string, state: Pick<AgentNodeState, "iterationCount">) =>
  `${baseNodeId}-${state.iterationCount ?? 0}`;

export const getTraceAttemptMeta = (
  slotKey: string,
  state: Pick<AgentNodeState, "iterationCount">,
) => {
  const iteration = state.iterationCount ?? 0;
  return {
    slotKey,
    attemptKey: `${slotKey}#${iteration}`,
    iteration,
  } as const;
};

const buildToolArgs = (input: {
  toolId: string;
  state: AgentNodeState;
}): Record<string, unknown> => {
  const question = getLatestUserQuestion(input.state.messages) || input.state.goal.text;
  const executionEnvironment = parseExecutionEnvironmentHint(
    input.state.requestContextMessages,
  );

  switch (input.toolId) {
    case "web_search":
      return {
        query: question,
      };
    case "read_list":
      return {
        path: ".",
      };
    case "read_locate":
      return {
        query: question,
        searchMode: "auto",
      };
    case "read_open":
    case "read":
      return {};
    case "terminal_session":
      return {
        ...(executionEnvironment.cwd?.trim() ? { cwd: executionEnvironment.cwd.trim() } : {}),
      };
    case "workspace_mutation":
      return buildWorkspaceMutationArgs(question) ?? {};
    default:
      return {};
  }
};

const freezeToolCall = (
  toolId: string,
  args: Record<string, unknown>,
): AgentToolCallRequest => ({
  toolId,
  args,
  inputHash: createInvocationInputHash(args),
  createdAt: nowIso(),
});

const createPendingApproval = (input: {
  runId: string;
  toolId: string;
  reason: string;
  args: Record<string, unknown>;
}): AgentApprovalRequest => ({
  id: crypto.randomUUID(),
  runId: input.runId,
  stepId: "approval",
  toolId: input.toolId,
  reason: input.reason,
  input: input.args,
  inputHash: createInvocationInputHash(input.args),
  createdAt: nowIso(),
});

const hasApprovedInvocation = (
  approvedInvocations: AgentApprovedInvocation[] | undefined,
  pendingToolCall: AgentToolCallRequest,
): boolean =>
  approvedInvocations?.some(
    (invocation) =>
      invocation.toolId === pendingToolCall.toolId &&
      invocation.inputHash === pendingToolCall.inputHash,
  ) ?? false;

const selectToolDefinition = (
  state: AgentNodeState,
  toolDefinitions: ReturnType<typeof listCapabilityDefinitions>,
) => {
  const selectedCapabilityIds = state.capabilityIntent?.selectedCapabilityIds ?? [];
  const selectedToolIds = state.capabilityIntent?.selectedToolIds ?? [];
  if (selectedToolIds.length === 0) {
    return undefined;
  }

  const selectedById = new Map(
    toolDefinitions.map((definition) => [definition.id, definition] as const),
  );

  for (const toolId of selectedToolIds) {
    const definition = selectedById.get(toolId);
    if (definition) {
      return definition;
    }
  }

  return undefined;
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
  const nodeId = getIterativeNodeId("agent-policy", state);
  const traceAttemptMeta = getTraceAttemptMeta("agent-policy", state);
  const question = getLatestUserQuestion(state.messages) || state.goal.text;
  await emitStepNode(emit, {
    runId: state.runId,
    nodeId,
    ...traceAttemptMeta,
    nodeType: "reason",
    phase: "start",
    label: "审批策略",
    summary: "正在判断候选能力是否需要审批",
  });

  const selectedCapabilityIds = state.capabilityIntent?.selectedCapabilityIds ?? [];
  const selectedToolIds = state.capabilityIntent?.selectedToolIds ?? [];
  const selectedCapabilityId = selectedCapabilityIds[0];
  const toolDefinitions = listCapabilityDefinitions();
  const selectedDefinition = selectToolDefinition(
    state,
    toolDefinitions,
  );

  if (!selectedDefinition) {
    await emitStepNode(emit, {
      runId: state.runId,
      nodeId,
      ...traceAttemptMeta,
      nodeType: "reason",
      phase: "done",
      label: "审批策略",
      summary: "未命中需要审批的能力",
      details: {
        selectedCapabilityIds,
        selectedToolIds,
      },
    });
    return {
      selectedCapabilityId: undefined,
      selectedToolId: undefined,
      pendingToolCall: undefined,
      pendingApproval: undefined,
    };
  }

  const args = buildToolArgs({
    toolId: selectedDefinition.id,
    state,
  });
  const frozenToolCall = freezeToolCall(selectedDefinition.id, args);

  if (
    (selectedDefinition.id === "read_open" || selectedDefinition.id === "read") &&
    !("path" in args) &&
    !("uri" in args)
  ) {
    await emitStepNode(emit, {
      runId: state.runId,
      nodeId,
      ...traceAttemptMeta,
      nodeType: "reason",
      phase: "done",
      label: "审批策略",
      summary: "读取能力缺少明确目标，跳过直接执行",
      details: {
        selectedCapabilityIds,
        selectedToolIds,
        capabilityId: selectedDefinition.id,
        policyDecision: "skip-missing-read-target",
      },
    });
    return {
      selectedCapabilityId,
      selectedToolId: undefined,
      pendingToolCall: undefined,
      pendingApproval: undefined,
    };
  }

  if (selectedDefinition.id === "workspace_mutation") {
    if (
      typeof args.operation !== "string" ||
      typeof args.targetPath !== "string" ||
      !args.targetPath.trim()
    ) {
      const reason = getWorkspaceMutationBlockReason(question);
      await emitStepNode(emit, {
        runId: state.runId,
        nodeId,
        ...traceAttemptMeta,
        nodeType: "reason",
        phase: "done",
        label: "审批策略",
        summary: "工作区变更能力缺少可审查的结构化参数，已阻断执行",
        details: {
          selectedCapabilityIds,
          selectedToolIds,
          capabilityId: selectedDefinition.id,
          policyDecision: "blocked-missing-workspace-mutation-args",
        },
      });
      return {
        selectedCapabilityId: undefined,
        selectedToolId: undefined,
        pendingToolCall: undefined,
        pendingApproval: undefined,
        blockedReason: reason,
        errorMessage: reason,
        errorSourceNodeId: nodeId,
      };
    }
  }

  if (selectedDefinition.id === "terminal_session") {
    const reason = getTerminalAutoExecutionBlockReason(question);
    await emitStepNode(emit, {
      runId: state.runId,
      nodeId,
      ...traceAttemptMeta,
      nodeType: "reason",
      phase: "done",
      label: "审批策略",
      summary: "终端能力缺少受控参数，已阻断自动执行",
      details: {
        selectedCapabilityIds,
        selectedToolIds,
        capabilityId: selectedDefinition.id,
        policyDecision: isHighRiskWorkspaceMutationRequest(question)
          ? "blocked-high-risk-workspace-mutation"
          : "blocked-missing-terminal-command",
      },
    });
    return {
      selectedCapabilityId,
      selectedToolId: undefined,
      pendingToolCall: undefined,
      pendingApproval: undefined,
      blockedReason: reason,
      errorMessage: reason,
      errorSourceNodeId: nodeId,
    };
  }

  const decision = evaluateAgentToolPolicy(selectedDefinition);
  if (decision.type === "allow") {
    await emitStepNode(emit, {
      runId: state.runId,
      nodeId,
      ...traceAttemptMeta,
      nodeType: "reason",
      phase: "done",
      label: "审批策略",
      summary: "命中能力可直接执行",
      details: {
        selectedCapabilityIds,
        selectedToolIds,
        capabilityId: selectedDefinition.id,
        policyDecision: decision.type,
      },
    });
    return {
      selectedCapabilityId,
      selectedToolId: selectedDefinition.id,
      pendingToolCall: frozenToolCall,
    };
  }

  if (decision.type === "deny") {
    await emitStepNode(emit, {
      runId: state.runId,
      nodeId,
      ...traceAttemptMeta,
      nodeType: "reason",
      phase: "done",
      label: "审批策略",
      summary: "命中能力被策略拒绝执行",
      details: {
        selectedCapabilityIds,
        selectedToolIds,
        capabilityId: selectedDefinition.id,
        policyDecision: decision.type,
        denialReason: decision.reason,
      },
    });

    return {
      selectedCapabilityId,
      selectedToolId: undefined,
      pendingToolCall: undefined,
      pendingApproval: undefined,
      blockedReason: decision.reason,
      errorMessage: decision.reason,
      errorSourceNodeId: nodeId,
    };
  }

  if (hasApprovedInvocation(state.approvedInvocations, frozenToolCall)) {
    await emitStepNode(emit, {
      runId: state.runId,
      nodeId,
      ...traceAttemptMeta,
      nodeType: "reason",
      phase: "done",
      label: "审批策略",
      summary: "该能力已获得本轮批准，继续执行",
      details: {
        selectedCapabilityIds,
        selectedToolIds,
        capabilityId: selectedDefinition.id,
        policyDecision: "approved",
      },
    });
    return {
      selectedCapabilityId,
      selectedToolId: selectedDefinition.id,
      pendingToolCall: frozenToolCall,
    };
  }

  const pendingApproval = createPendingApproval({
    runId: state.runId,
    toolId: selectedDefinition.id,
    reason: decision.reason,
    args,
  });

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId,
    ...traceAttemptMeta,
    nodeType: "reason",
    phase: "done",
    label: "审批策略",
    summary: "已命中需要审批的能力",
    details: {
      selectedCapabilityIds,
      selectedToolIds,
      capabilityId: selectedDefinition.id,
      policyDecision: decision.type,
      approvalReason: decision.reason,
    },
  });

  return {
    pendingApproval,
    selectedCapabilityId,
    selectedToolId: selectedDefinition.id,
    pendingToolCall: frozenToolCall,
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
      evidence: appendObservationEvidence(state, observation),
    };
  }

  const ragResult = await agentRagRunnable.invoke({
    question,
    knowledgeBaseId: state.knowledgeBaseId,
    conversationHistory: state.messages,
    requestContextMessages: state.requestContextMessages,
  });
  const retrievedChunks = ragResult.sources ?? [];
  const retrievalEvidence: AgentRetrievalEvidence = {
    knowledgeBaseId: state.knowledgeBaseId,
    query: question,
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
    evidence: appendRetrievalEvidence(
      {
        ...state,
        evidence: appendObservationEvidence(state, observation),
      },
      retrievalEvidence,
    ),
  };
};

export const toolNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  const toolId = state.selectedToolId;

  if (!toolId) {
    return {};
  }

  const pendingToolCall = state.pendingToolCall;

  if (!pendingToolCall) {
    const errorMessage = `Missing frozen tool call for ${toolId}. toolNode requires policyNode to freeze the invocation before execution.`;
    const observation = createObservation({
      runId: state.runId,
      stepId: "tool",
      status: "failed",
      facts: [`${toolId} execution was blocked because no frozen tool call was available.`],
      errorMessage,
    });

    await emitStepNode(emit, {
      runId: state.runId,
      nodeId: "agent-tool",
      nodeType: "tool",
      phase: "error",
      label: "工具选择",
      summary: `${toolId} 缺少冻结调用对象，已阻断执行`,
      details: {
        toolId,
        errorMessage,
      },
    });

    return {
      observations: [...(state.observations ?? []), observation],
      evidence: appendObservationEvidence(state, observation),
      selectedCapabilityId: state.selectedCapabilityId,
      selectedToolId: undefined,
      pendingToolCall: undefined,
      errorMessage,
      blockedReason: errorMessage,
      errorSourceNodeId: "agent-tool",
      continueIteration: false,
      postToolReviewPending: false,
    };
  }

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-tool",
    nodeType: "tool",
    phase: "start",
    label: "工具选择",
    summary: `已选择 ${toolId}，准备调用 Harness`,
    details: {
      toolId,
      input: pendingToolCall.args,
    },
  });

  const invocation = await executeHarnessInvocation({
    toolId,
    args: pendingToolCall.args,
    userId: state.userId,
    threadId: state.threadId,
    approvedInvocations: state.approvedInvocations,
  });

  const finishedAt = nowIso();

  if (invocation.status === "awaiting_approval") {
    const approval = createPendingApproval({
      runId: state.runId,
      toolId,
      reason: invocation.approval?.reason ?? `${toolId} requires approval.`,
      args: pendingToolCall.args,
    });

    const observation = createObservation({
      runId: state.runId,
      stepId: "tool",
      status: "blocked",
      facts: [`${toolId} paused for approval before completion.`],
      errorMessage: approval.reason,
    });

    await emitStepNode(emit, {
      runId: state.runId,
      nodeId: "agent-tool",
      nodeType: "tool",
      phase: "done",
      label: "工具选择",
      summary: `${toolId} 进入审批等待`,
      details: {
        toolId,
        invocationId: invocation.id,
        input: pendingToolCall.args,
        approvalReason: approval.reason,
      },
    });

    const executionRecord: AgentToolExecutionResult = {
      toolId,
      args: pendingToolCall.args,
      invocationId: invocation.id,
      status: "awaiting_approval",
      approval,
      startedAt: invocation.startedAt ?? pendingToolCall.createdAt,
      finishedAt,
    };

    return {
      pendingApproval: approval,
      selectedCapabilityId: state.selectedCapabilityId,
      selectedToolId: undefined,
      pendingToolCall: undefined,
      lastToolExecution: executionRecord,
      observations: [...(state.observations ?? []), observation],
      evidence: appendToolExecutionEvidence(
        {
          ...state,
          evidence: appendObservationEvidence(state, observation),
        },
        executionRecord,
      ),
      continueIteration: false,
      postToolReviewPending: false,
    };
  }

  if (invocation.status !== "completed") {
    const errorMessage =
      invocation.error?.message ?? `${toolId} failed during Harness execution.`;
    const observation = createObservation({
      runId: state.runId,
      stepId: "tool",
      status: "failed",
      facts: [`${toolId} failed during Harness execution.`],
      errorMessage,
    });

    await emitStepNode(emit, {
      runId: state.runId,
      nodeId: "agent-tool",
      nodeType: "tool",
      phase: "error",
      label: "工具选择",
      summary: `${toolId} 执行失败`,
      details: {
        toolId,
        invocationId: invocation.id,
        input: pendingToolCall.args,
        errorMessage,
      },
    });

    const executionRecord: AgentToolExecutionResult = {
      toolId,
      args: pendingToolCall.args,
      invocationId: invocation.id,
      status: "failed",
      errorMessage,
      startedAt: invocation.startedAt ?? pendingToolCall.createdAt,
      finishedAt,
    };

    return {
      observations: [...(state.observations ?? []), observation],
      evidence: appendToolExecutionEvidence(
        {
          ...state,
          evidence: appendObservationEvidence(state, observation),
        },
        executionRecord,
      ),
      selectedCapabilityId: state.selectedCapabilityId,
      selectedToolId: undefined,
      pendingToolCall: undefined,
      lastToolExecution: executionRecord,
      errorMessage,
      errorSourceNodeId: "agent-tool",
      continueIteration: false,
      postToolReviewPending: false,
    };
  }

  const observation = createObservation({
    runId: state.runId,
    stepId: "tool",
    status: "ok",
    facts: [`${toolId} completed through Harness.`],
  });
  const executionRecord: AgentToolExecutionResult = {
    toolId,
    args: pendingToolCall.args,
    invocationId: invocation.id,
    status: "completed",
    result: invocation.result,
    startedAt: invocation.startedAt ?? pendingToolCall.createdAt,
    finishedAt,
  };

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-tool",
    nodeType: "tool",
    phase: "done",
    label: "工具选择",
    summary: `${toolId} 已由 Harness 执行完成`,
    details: {
      toolId,
      invocationId: invocation.id,
      input: pendingToolCall.args,
      output: invocation.result ?? null,
    },
  });

  return {
    observations: [...(state.observations ?? []), observation],
    evidence: appendToolExecutionEvidence(
      {
        ...state,
        evidence: appendObservationEvidence(state, observation),
      },
      executionRecord,
    ),
    selectedCapabilityId: state.selectedCapabilityId,
    selectedToolId: undefined,
    pendingToolCall: undefined,
    lastToolExecution: executionRecord,
    iterationCount: (state.iterationCount ?? 0) + 1,
    continueIteration: false,
    postToolReviewPending: false,
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
    label: "下一步判断",
    summary: "正在根据最新工具结果决定继续回看还是直接收口",
  });

  const maxIterations = state.maxIterations ?? 3;
  const iterationCount = state.iterationCount ?? 0;
  const evidence = getEvidencePayload(state);
  const completedToolExecutions = evidence.toolExecutions.filter(
    (execution) => execution.status === "completed",
  );
  const hasCompletedToolResult = completedToolExecutions.length > 0;
  const hasAnyEvidence =
    evidence.observations.length > 0 ||
    evidence.retrievals.length > 0 ||
    completedToolExecutions.length > 0;
  const continueIteration = hasCompletedToolResult && iterationCount < maxIterations;

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId,
    ...traceAttemptMeta,
    nodeType: "reason",
    phase: "done",
    label: "下一步判断",
    summary: continueIteration
      ? "已进入工具结果回看轮次"
      : "已结束自动回看，转入回答生成",
    details: {
      iterationCount,
      maxIterations,
      hasCompletedToolResult,
      completedToolExecutionCount: completedToolExecutions.length,
      retrievalEvidenceCount: evidence.retrievals.length,
      observationCount: evidence.observations.length,
      hasAnyEvidence,
      continueIteration,
      decisionReason: continueIteration
        ? "A completed tool execution exists in the evidence payload and the review budget is not exhausted."
        : hasCompletedToolResult
          ? "Reached the configured automatic review limit."
          : hasAnyEvidence
            ? "Evidence exists, but there is no completed tool execution that requires another review pass."
            : "No accumulated evidence is available for another review pass.",
    },
  });

  return {
    continueIteration,
    postToolReviewPending: continueIteration,
  };
};

const buildGenerateMessages = (state: AgentNodeState): NormalizedChatMessage[] => {
  const evidence = getEvidencePayload(state);
  const sanitizedHistoryMessages = state.messages
    .slice(0, -1)
    .filter((message) => message.role === "user" || message.role === "system");
  const evidenceMessages: NormalizedChatMessage[] = [];

  const completedToolExecutions = evidence.toolExecutions.filter(
    (execution) =>
      execution.status === "completed" &&
      typeof execution.result !== "undefined",
  );

  if (completedToolExecutions.length > 0) {
    const toolEvidenceText = [
      "以下是本轮 Agent 已实际执行完成的工具结果证据。",
      ...completedToolExecutions.map((execution, index) =>
        [
          `#${index + 1}`,
          `toolId: ${execution.toolId}`,
          `result: ${JSON.stringify(execution.result, null, 2)}`,
        ].join("\n"),
      ),
      "你只能基于这些真实结果描述工具执行结论；如果结果不足以支持结论，要明确说明不足。",
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

  const baseMessages = [
    ...(state.requestContextMessages ?? []),
    ...evidenceMessages,
  ];

  const retrievalEvidenceChunks =
    evidence.retrievals.length > 0
      ? evidence.retrievals.flatMap((retrieval) => retrieval.chunks)
      : (state.retrievedChunks ?? []).map((chunk) => ({
          chunkId: chunk.chunkId,
          documentName: chunk.documentName,
          score: chunk.score,
          content: chunk.content,
        }));

  if (retrievalEvidenceChunks.length > 0) {
    const contextText = retrievalEvidenceChunks
      .map(
        (chunk, index) =>
          `[${index + 1}] ${chunk.documentName}\n${chunk.content}`,
      )
      .join("\n\n");

    baseMessages.push({
      role: "system",
      content: `以下是 Agent 检索到的上下文，请优先依据这些内容回答，并说明不确定性。\n\n${contextText}`,
      parts: [
        {
          type: "text",
          text: `以下是 Agent 检索到的上下文，请优先依据这些内容回答，并说明不确定性。\n\n${contextText}`,
        },
      ],
    });
  } else {
    const noEvidenceGuardText =
      "如果当前上下文里没有真实检索结果或已完成的工具结果，不要声称自己已经查看过文件、目录、网页、知识库或外部系统。";
    baseMessages.push({
      role: "system",
      content: noEvidenceGuardText,
      parts: [
        {
          type: "text",
          text: noEvidenceGuardText,
        },
      ],
    });
  }

  return [
    ...baseMessages,
    ...sanitizedHistoryMessages,
    state.messages[state.messages.length - 1]!,
  ];
};

const buildGenerateInstructionMessages = (
  state: AgentNodeState,
): NormalizedChatMessage[] => {
  const messages: NormalizedChatMessage[] = [];
  const evidence = getEvidencePayload(state);
  const completedToolExecutions = evidence.toolExecutions.filter(
    (execution) =>
      execution.status === "completed" &&
      typeof execution.result !== "undefined",
  );

  if (completedToolExecutions.length > 0) {
    messages.push({
      role: "system",
      content: [
        "以下是本轮 Agent 已实际执行完成的工具结果证据。",
        ...completedToolExecutions.map((execution, index) =>
          [
            `#${index + 1}`,
            `toolId: ${execution.toolId}`,
            `result: ${JSON.stringify(execution.result, null, 2)}`,
          ].join("\n"),
        ),
        "你只能基于这些真实结果描述工具执行结论；如果结果不足以支持结论，要明确说明不足。",
      ].join("\n\n"),
    });
  } else {
    messages.push({
      role: "system",
      content:
        "如果当前上下文里没有真实检索结果或已完成的工具结果，不要声称自己已经查看过文件、目录、网页、知识库或外部系统。",
    });
  }

  return messages;
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
  const generationMessages = budget.messages.length > 0 ? budget.messages : messages;
  const generationInvocation = providerProxyService.describeChatInvocation(
    "default",
    generationMessages,
  );
  let answer: string;
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
    facts: [
      ok
        ? "Agent run produced a final answer."
        : "Agent run did not produce an answer.",
    ],
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
    evidence: appendObservationEvidence(state, observation),
    ...(ok ? {} : { blockedReason: "Agent run did not produce an answer." }),
  };
};
