/**
 * 工具执行节点：执行已审批或免审的工具调用，并将结果加入证据。
 */
import { executeHarnessInvocation } from "@/harness/invocations";
import { createHarnessEnvironmentSnapshot } from "@/harness/environment";
import { runWithWorkspaceRootOverride } from "@/mcp/workspace";
import { createInvocationInputHash } from "../approval-fingerprint";
import {
  emitStepNode,
  getIterativeNodeId,
  getTraceAttemptMeta,
  type AgentNodeState,
  type EmitAgentExecutionNode,
} from "../node-runtime";
import {
  appendObservationEvidence,
  appendToolExecutionEvidence,
  getEvidenceCounts,
} from "../evidence";
import type {
  AgentApprovalRequest,
  AgentObservation,
  AgentToolCallRequest,
  AgentToolExecutionResult,
  PendingToolCall,
} from "../types";

const nowIso = () => new Date().toISOString();

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

const createPendingApproval = (input: {
  runId: string;
  toolId: string;
  toolCallId: string;
  reason: string;
  args: Record<string, unknown>;
  inputHash: string;
}): AgentApprovalRequest => ({
  id: crypto.randomUUID(),
  runId: input.runId,
  stepId: "approval",
  toolId: input.toolId,
  toolCallId: input.toolCallId,
  reason: input.reason,
  input: input.args,
  inputHash: input.inputHash,
  createdAt: nowIso(),
});

const isFrozenPlannerPendingToolCall = (
  pendingToolCall: AgentToolCallRequest | undefined,
): pendingToolCall is PendingToolCall =>
  Boolean(
    pendingToolCall &&
      pendingToolCall.source === "planner" &&
      "status" in pendingToolCall &&
      pendingToolCall.status === "frozen",
  );

const buildExecutionRecord = (input: {
  pendingToolCall: PendingToolCall;
  toolId: string;
  status: AgentToolExecutionResult["status"];
  invocationId?: string;
  startedAt: string;
  finishedAt: string;
  errorMessage?: string;
  result?: unknown;
  approval?: AgentApprovalRequest;
}): AgentToolExecutionResult => ({
  toolCallId: input.pendingToolCall.id,
  toolId: input.toolId,
  inputHash: input.pendingToolCall.inputHash,
  args: input.pendingToolCall.args,
  invocationId: input.invocationId,
  status: input.status,
  errorMessage: input.errorMessage,
  result: input.result,
  approval: input.approval,
  startedAt: input.startedAt,
  finishedAt: input.finishedAt,
});

const getDurationMs = (startedAt: string, finishedAt: string) => {
  const startMs = Date.parse(startedAt);
  const endMs = Date.parse(finishedAt);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return undefined;
  }

  return Math.max(0, endMs - startMs);
};

const toHarnessApprovedInvocations = (
  approvedInvocations: AgentNodeState["approvedInvocations"],
) =>
  approvedInvocations?.map((invocation) => ({
    toolId: invocation.toolId,
    inputHash: createInvocationInputHash(invocation.input),
  }));

const emitEvidenceUpdateNode = async (
  emit: EmitAgentExecutionNode | undefined,
  input: {
    runId: string;
    summary: string;
    toolId: string;
    toolCallId?: string;
    inputHash?: string;
    status: AgentToolExecutionResult["status"];
    evidenceCounts: ReturnType<typeof getEvidenceCounts>;
    latestEvidenceSummary?: AgentToolExecutionResult["summary"];
    iteration: number;
    maxIterations?: number;
  },
) => {
  await emitStepNode(emit, {
    runId: input.runId,
    nodeId: "agent-evidence-update-tool",
    nodeType: "reason",
    phase: "done",
    label: "证据写回",
    summary: input.summary,
    details: {
      sourceNode: "toolNode",
      toolId: input.toolId,
      toolCallId: input.toolCallId ?? null,
      inputHash: input.inputHash ?? null,
      toolExecutionStatus: input.status,
      latestEvidenceSummary: input.latestEvidenceSummary ?? null,
      evidenceCounts: input.evidenceCounts,
      iteration: input.iteration,
      maxIterations: input.maxIterations ?? null,
    },
  });
};

export const toolNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  const nodeId = getIterativeNodeId("agent-tool", state);
  const traceAttemptMeta = getTraceAttemptMeta("agent-tool", state);
  const pendingToolCall = state.pendingToolCall;

  if (!pendingToolCall) {
    const errorMessage = "No pendingToolCall available for tool execution.";
    await emitStepNode(emit, {
      runId: state.runId,
      nodeId,
      ...traceAttemptMeta,
      nodeType: "tool",
      phase: "error",
      label: "工具执行",
      summary: "没有冻结工具调用，已阻断执行",
      details: {
        status: "error",
        reason: errorMessage,
      },
    });
    return {
      pendingToolCall: undefined,
      selectedToolId: undefined,
      errorMessage,
      errorSourceNodeId: "agent-tool",
      blockedReason: errorMessage,
      continueIteration: false,
      postToolReviewPending: false,
    };
  }

  if (!isFrozenPlannerPendingToolCall(pendingToolCall)) {
    const errorMessage =
      "toolNode requires a frozen planner pendingToolCall before execution.";
    await emitStepNode(emit, {
      runId: state.runId,
      nodeId,
      ...traceAttemptMeta,
      nodeType: "tool",
      phase: "error",
      label: "工具执行",
      summary: "待执行调用不是冻结后的 planner 调用，已阻断执行",
      details: {
        toolCallId: "id" in pendingToolCall ? pendingToolCall.id : null,
        toolId: pendingToolCall.toolId,
        inputHash: pendingToolCall.inputHash,
        status: "error",
        reason: errorMessage,
      },
    });
    return {
      pendingToolCall: undefined,
      selectedToolId: undefined,
      errorMessage,
      errorSourceNodeId: "agent-tool",
      blockedReason: errorMessage,
      continueIteration: false,
      postToolReviewPending: false,
    };
  }

  const policyDecision = state.policyDecision;
  if (
    policyDecision?.type !== "allow" ||
    policyDecision.toolId !== pendingToolCall.toolId ||
    policyDecision.inputHash !== pendingToolCall.inputHash
  ) {
    const errorMessage =
      policyDecision == null
        ? "No policy allow decision available for tool execution."
        : "Policy decision does not allow this frozen pendingToolCall.";
    await emitStepNode(emit, {
      runId: state.runId,
      nodeId,
      ...traceAttemptMeta,
      nodeType: "tool",
      phase: "error",
      label: "工具执行",
      summary: "审批结果未明确允许当前冻结调用，已阻断执行",
      details: {
        toolCallId: pendingToolCall.id,
        toolId: pendingToolCall.toolId,
        inputHash: pendingToolCall.inputHash,
        status: "error",
        reason: errorMessage,
        policyDecisionType: policyDecision?.type ?? null,
      },
    });
    return {
      pendingToolCall: undefined,
      selectedToolId: undefined,
      errorMessage,
      errorSourceNodeId: "agent-tool",
      blockedReason: errorMessage,
      continueIteration: false,
      postToolReviewPending: false,
    };
  }

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId,
    ...traceAttemptMeta,
    nodeType: "tool",
    phase: "start",
    label: "工具执行",
    summary: `准备执行 ${pendingToolCall.toolId}`,
    details: {
      toolCallId: pendingToolCall.id,
      toolId: pendingToolCall.toolId,
      inputHash: pendingToolCall.inputHash,
      status: "running",
    },
  });

  const invocationEnvironment = state.workspaceRoot
    ? createHarnessEnvironmentSnapshot({
        workspace: {
          rootPath: state.workspaceRoot,
          source: "selected",
        },
      })
    : undefined;

  const invocation = await runWithWorkspaceRootOverride(
    state.workspaceRoot,
    async () =>
      await executeHarnessInvocation({
        toolId: pendingToolCall.toolId,
        args: pendingToolCall.args,
        userId: state.userId,
        threadId: state.threadId,
        ...(invocationEnvironment ? { environment: invocationEnvironment } : {}),
        approvedInvocations: toHarnessApprovedInvocations(state.approvedInvocations),
      }),
  );

  const startedAt = invocation.startedAt ?? pendingToolCall.createdAt;
  const finishedAt = nowIso();
  const durationMs = getDurationMs(startedAt, finishedAt);

  if (invocation.status === "awaiting_approval") {
    const approval = createPendingApproval({
      runId: state.runId,
      toolId: pendingToolCall.toolId,
      toolCallId: pendingToolCall.id,
      reason: invocation.approval?.reason ?? `${pendingToolCall.toolId} requires approval.`,
      args: pendingToolCall.args,
      inputHash: pendingToolCall.inputHash,
    });

    const observation = createObservation({
      runId: state.runId,
      stepId: "tool",
      status: "blocked",
      facts: [`${pendingToolCall.toolId} paused for approval before completion.`],
      errorMessage: approval.reason,
    });

    const executionRecord = buildExecutionRecord({
      pendingToolCall,
      toolId: pendingToolCall.toolId,
      invocationId: invocation.id,
      status: "awaiting_approval",
      approval,
      startedAt,
      finishedAt,
    });

    await emitStepNode(emit, {
      runId: state.runId,
      nodeId,
      ...traceAttemptMeta,
      nodeType: "tool",
      phase: "done",
      label: "工具执行",
      summary: `${pendingToolCall.toolId} 进入审批等待`,
      details: {
        toolCallId: pendingToolCall.id,
        toolId: pendingToolCall.toolId,
        inputHash: pendingToolCall.inputHash,
        invocationId: invocation.id,
        status: "awaiting_approval",
        durationMs: durationMs ?? null,
      },
    });
    const evidence = appendToolExecutionEvidence(
      {
        ...state,
        evidence: appendObservationEvidence(state, observation),
      },
      executionRecord,
    );
    await emitEvidenceUpdateNode(emit, {
      runId: state.runId,
      summary: "工具审批等待结果已写入 evidence",
      toolId: pendingToolCall.toolId,
      toolCallId: pendingToolCall.id,
      inputHash: pendingToolCall.inputHash,
      status: executionRecord.status,
      evidenceCounts: getEvidenceCounts({ evidence }),
      latestEvidenceSummary: evidence.latestSummary,
      iteration: state.iterationCount ?? 0,
      maxIterations: state.maxIterations,
    });

    return {
      pendingApproval: approval,
      policyDecision: {
        type: "require_approval",
        toolId: pendingToolCall.toolId,
        inputHash: pendingToolCall.inputHash,
        reason: approval.reason,
      },
      selectedToolId: undefined,
      pendingToolCall,
      lastToolExecution: executionRecord,
      observations: [...(state.observations ?? []), observation],
      evidence,
      continueIteration: false,
      postToolReviewPending: false,
    };
  }

  if (invocation.status !== "completed") {
    const errorMessage =
      invocation.error?.message ??
      `${pendingToolCall.toolId} failed during Harness execution.`;
    const observation = createObservation({
      runId: state.runId,
      stepId: "tool",
      status: "failed",
      facts: [`${pendingToolCall.toolId} failed during Harness execution.`],
      errorMessage,
    });

    const executionRecord = buildExecutionRecord({
      pendingToolCall,
      toolId: pendingToolCall.toolId,
      invocationId: invocation.id,
      status: "failed",
      errorMessage,
      startedAt,
      finishedAt,
    });

    await emitStepNode(emit, {
      runId: state.runId,
      nodeId,
      ...traceAttemptMeta,
      nodeType: "tool",
      phase: "error",
      label: "工具执行",
      summary: `${pendingToolCall.toolId} 执行失败`,
      details: {
        toolCallId: pendingToolCall.id,
        toolId: pendingToolCall.toolId,
        inputHash: pendingToolCall.inputHash,
        invocationId: invocation.id,
        status: "failed",
        durationMs: durationMs ?? null,
      },
    });
    const evidence = appendToolExecutionEvidence(
      {
        ...state,
        evidence: appendObservationEvidence(state, observation),
      },
      executionRecord,
    );
    await emitEvidenceUpdateNode(emit, {
      runId: state.runId,
      summary: "工具失败结果已写入 evidence",
      toolId: pendingToolCall.toolId,
      toolCallId: pendingToolCall.id,
      inputHash: pendingToolCall.inputHash,
      status: executionRecord.status,
      evidenceCounts: getEvidenceCounts({ evidence }),
      latestEvidenceSummary: evidence.latestSummary,
      iteration: state.iterationCount ?? 0,
      maxIterations: state.maxIterations,
    });

    return {
      observations: [...(state.observations ?? []), observation],
      evidence,
      policyDecision: {
        type: "error",
        toolId: pendingToolCall.toolId,
        inputHash: pendingToolCall.inputHash,
        reason: errorMessage,
      },
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
    facts: [`${pendingToolCall.toolId} completed through Harness.`],
  });
  const executionRecord = buildExecutionRecord({
    pendingToolCall,
    toolId: pendingToolCall.toolId,
    invocationId: invocation.id,
    status: "completed",
    result: invocation.result,
    startedAt,
    finishedAt,
  });

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId,
    ...traceAttemptMeta,
    nodeType: "tool",
    phase: "done",
    label: "工具执行",
    summary: `${pendingToolCall.toolId} 已由 Harness 执行完成`,
    details: {
      toolCallId: pendingToolCall.id,
      toolId: pendingToolCall.toolId,
      inputHash: pendingToolCall.inputHash,
      invocationId: invocation.id,
      status: "completed",
      durationMs: durationMs ?? null,
    },
  });
  const evidence = appendToolExecutionEvidence(
    {
      ...state,
      evidence: appendObservationEvidence(state, observation),
    },
    executionRecord,
  );
  await emitEvidenceUpdateNode(emit, {
    runId: state.runId,
    summary: "工具执行结果已写入 evidence",
    toolId: pendingToolCall.toolId,
    toolCallId: pendingToolCall.id,
    inputHash: pendingToolCall.inputHash,
    status: executionRecord.status,
    evidenceCounts: getEvidenceCounts({ evidence }),
    latestEvidenceSummary: evidence.latestSummary,
    iteration: (state.iterationCount ?? 0) + 1,
    maxIterations: state.maxIterations,
  });

  return {
    observations: [...(state.observations ?? []), observation],
    evidence,
    policyDecision: undefined,
    selectedToolId: undefined,
    pendingToolCall: undefined,
    lastToolExecution: executionRecord,
    iterationCount: (state.iterationCount ?? 0) + 1,
    continueIteration: false,
    postToolReviewPending: false,
  };
};
