import { agentGraph } from "./graph";
import { agentRunStore } from "./run-store";
import { getAgentRunById } from "./run-read";
import type {
  AgentApprovalRequest,
  AgentApprovedInvocation,
  AgentToolCallRequest,
} from "./types";
import { persistAssistantMessage } from "@/routes/proxy-provider/message-persistence";
import { threadService } from "@/services/thread.service";
import type { AssistantExecutionNodeEvent } from "@/services/chat-stream-events";

const buildAssistantMetadata = (input: {
  runId: string;
  traceId: string;
  status: "completed" | "failed" | "blocked" | "waiting_approval";
  pendingApproval?: {
    id: string;
    stepId: string;
    toolId: string;
    toolCallId?: string;
    reason: string;
    input?: Record<string, unknown>;
    inputHash?: string;
    createdAt: string;
  };
  blockedReason?: string;
  terminalReason?: string;
  errorMessage?: string;
  errorSourceNodeId?: string;
}) => ({
  agent: {
    status: input.status,
    runId: input.runId,
    traceId: input.traceId,
    ...(input.pendingApproval
      ? {
          pendingApproval: input.pendingApproval,
        }
      : {}),
    ...(input.errorMessage
      ? {
          errorMessage: input.errorMessage,
        }
      : {}),
    ...(input.blockedReason
      ? {
          blockedReason: input.blockedReason,
        }
      : {}),
    ...(input.terminalReason
      ? {
          terminalReason: input.terminalReason,
        }
      : {}),
    ...(input.errorSourceNodeId
      ? {
          errorSourceNodeId: input.errorSourceNodeId,
        }
      : {}),
  },
});

const getExistingAssistantMessage = (input: {
  assistantMessageId?: string;
  userId: number;
}) => {
  if (!input.assistantMessageId) {
    return null;
  }

  return threadService.getMessageById(input.assistantMessageId, input.userId);
};

const toApprovedInvocation = (input: {
  pendingApproval: AgentApprovalRequest;
  pendingToolCall: AgentToolCallRequest;
}): AgentApprovedInvocation => ({
  toolId: input.pendingToolCall.toolId,
  input: input.pendingToolCall.args,
  inputHash: input.pendingToolCall.inputHash,
  approvedAt: new Date().toISOString(),
  approvalId: input.pendingApproval.id,
});

const getApprovalResumeMismatchReason = (input: {
  pendingApproval: AgentApprovalRequest;
  pendingToolCall: AgentToolCallRequest;
}) => {
  if (input.pendingApproval.toolId !== input.pendingToolCall.toolId) {
    return `Approval resume mismatch: approved toolId ${input.pendingApproval.toolId} does not match frozen pendingToolCall.toolId ${input.pendingToolCall.toolId}.`;
  }

  if (
    input.pendingApproval.inputHash &&
    input.pendingApproval.inputHash !== input.pendingToolCall.inputHash
  ) {
    return `Approval resume mismatch: approved inputHash ${input.pendingApproval.inputHash} does not match frozen pendingToolCall.inputHash ${input.pendingToolCall.inputHash}.`;
  }

  if (
    input.pendingApproval.toolCallId &&
    "id" in input.pendingToolCall &&
    input.pendingApproval.toolCallId !== input.pendingToolCall.id
  ) {
    return `Approval resume mismatch: approved toolCallId ${input.pendingApproval.toolCallId} does not match frozen pendingToolCall.id ${input.pendingToolCall.id}.`;
  }

  return null;
};

const buildAssistantParts = (input: {
  content: string;
  existingParts?: Array<
    | {
        type: "text";
        text: string;
      }
    | {
        type: "image";
        image: string;
        filename?: string;
        fileId?: string;
        mediaType?: string;
      }
    | {
        type: "file";
        data: string;
        filename: string;
        fileId?: string;
        mimeType: string;
      }
    | {
        type: "data";
        name: string;
        value: unknown;
      }
  >;
  executionNodes: AssistantExecutionNodeEvent[];
}) => {
  const baseParts = input.content.trim()
    ? [
        {
          type: "text" as const,
          text: input.content,
        },
      ]
    : [];
  const persistedDataParts = (input.existingParts ?? []).filter(
    (part): part is { type: "data"; name: string; value: unknown } =>
      part.type === "data",
  );
  const appendedDataParts = input.executionNodes.map((node) => ({
    type: "data" as const,
    name: "execution-node",
    value: node,
  }));
  const dedupedDataParts = new Map<
    string,
    { type: "data"; name: string; value: unknown }
  >();

  for (const part of [...persistedDataParts, ...appendedDataParts]) {
    dedupedDataParts.set(`${part.name}:${JSON.stringify(part.value)}`, part);
  }

  return [...baseParts, ...dedupedDataParts.values()];
};

export const persistAgentAssistantState = (input: {
  run: {
    id: string;
    traceId: string;
    threadId: string;
    userId: number;
    assistantMessageId?: string;
    assistantParentId?: string | null;
  };
  status: "completed" | "failed" | "blocked" | "waiting_approval";
  content: string;
  pendingApproval?: AgentApprovalRequest;
  blockedReason?: string;
  terminalReason?: string;
  errorMessage?: string;
  errorSourceNodeId?: string;
  executionNodes?: AssistantExecutionNodeEvent[];
}) => {
  if (
    !input.run.assistantMessageId ||
    typeof input.run.assistantParentId === "undefined"
  ) {
    return;
  }

  const existingAssistantMessage = getExistingAssistantMessage({
    assistantMessageId: input.run.assistantMessageId,
    userId: input.run.userId,
  });
  const content =
    input.content.trim() || existingAssistantMessage?.content?.trim() || "";
  const parts = buildAssistantParts({
    content,
    existingParts: existingAssistantMessage?.parts,
    executionNodes: input.executionNodes ?? [],
  });

  persistAssistantMessage({
    threadId: input.run.threadId,
    userId: input.run.userId,
    assistantMessageId: input.run.assistantMessageId,
    parentId: input.run.assistantParentId ?? null,
    content,
    parts,
    metadata: buildAssistantMetadata({
      runId: input.run.id,
      traceId: input.run.traceId,
      status: input.status,
      pendingApproval: input.pendingApproval,
      blockedReason: input.blockedReason,
      terminalReason: input.terminalReason,
      errorMessage: input.errorMessage,
      errorSourceNodeId: input.errorSourceNodeId,
    }),
  });
};

export const resumeApprovedAgentRun = async (runId: string) => {
  const run = getAgentRunById(runId);
  if (!run) {
    throw new Error(`AgentRun not found: ${runId}`);
  }

  const runtimeInput = run.runtimeInput;
  if (!runtimeInput) {
    throw new Error(`AgentRun missing runtime input: ${runId}`);
  }

  const pendingApproval = run.pendingApproval;
  const pendingToolCall = run.pendingToolCall;
  if (!pendingApproval || !pendingToolCall) {
    throw new Error(`AgentRun missing frozen approval invocation: ${runId}`);
  }

  const mismatchReason = getApprovalResumeMismatchReason({
    pendingApproval,
    pendingToolCall,
  });
  if (mismatchReason) {
    const blockedRun = agentRunStore.complete(runId, {
      status: "blocked",
      currentStepId: undefined,
      pendingApproval: undefined,
      pendingToolCall: undefined,
      selectedToolId: undefined,
      blockedReason: mismatchReason,
      terminalReason: "approval_resume_mismatch",
    });
    persistAgentAssistantState({
      run: blockedRun,
      status: "blocked",
      content: "审批对象与待执行工具不一致，已阻断本次执行，工具没有运行。",
      blockedReason: mismatchReason,
      terminalReason: "approval_resume_mismatch",
    });
    throw new Error(mismatchReason);
  }

  const approvedInvocation = toApprovedInvocation({
    pendingApproval,
    pendingToolCall,
  });
  const approvedInvocations = [
    ...(run.approvedInvocations ?? []),
    approvedInvocation,
  ];

  agentRunStore.update(runId, {
    status: "running",
    pendingApproval: undefined,
    approvedInvocations,
    // Resume keeps selectedToolId only for diagnostics / UI continuity.
    selectedToolId: pendingToolCall.toolId,
    pendingToolCall,
  });

  const resumedExecutionNodes: AssistantExecutionNodeEvent[] = [];
  const output = await agentGraph.run({
    runId,
    threadId: run.threadId,
    userId: run.userId,
    goal: run.goal,
    plan: run.plan,
    messages: runtimeInput.messages,
    requestContextMessages: runtimeInput.requestContextMessages,
    params: runtimeInput.params,
    knowledgeBaseId: runtimeInput.knowledgeBaseId,
    intentConfig: runtimeInput.intentConfig,
    workspaceRoot: runtimeInput.workspaceRoot,
    approvedInvocations,
    selectedToolId: pendingToolCall.toolId,
    pendingToolCall,
    onExecutionNode: (event) => {
      resumedExecutionNodes.push(event);
    },
  });

  for (const observation of output.observations) {
    agentRunStore.addObservation(runId, observation);
  }

  agentRunStore.complete(runId, {
    status: output.status,
    currentStepId: output.pendingApproval?.stepId ?? output.errorSourceNodeId,
    contextBudget: output.contextBudget,
    blockedReason: output.blockedReason,
    terminalReason: output.terminalReason,
    approvedInvocations,
    // Resume output follows the same compatibility rule: no execution may be
    // derived from selectedToolId.
    selectedToolId:
      output.selectedToolId ??
      output.pendingApproval?.toolId ??
      pendingApproval.toolId,
    pendingToolCall: output.pendingToolCall,
    lastToolExecution: output.lastToolExecution,
    ...(output.pendingApproval
      ? { pendingApproval: output.pendingApproval }
      : { pendingApproval: undefined }),
    ...(output.status === "completed"
      ? { pendingApproval: undefined }
      : {}),
  });

  const nextRun = getAgentRunById(runId);

  if (nextRun) {
    persistAgentAssistantState({
      run: nextRun,
      status: output.status,
      content: output.answer,
      pendingApproval: output.pendingApproval,
      blockedReason: output.blockedReason,
      terminalReason: output.terminalReason,
      errorMessage: output.errorMessage,
      errorSourceNodeId: output.errorSourceNodeId,
      executionNodes: resumedExecutionNodes,
    });
  }

  return {
    run: nextRun,
    output,
  };
};
