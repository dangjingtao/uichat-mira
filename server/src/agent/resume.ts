import { agentGraph } from "./graph.js";
import { agentRunStore } from "./run-store.js";
import { getAgentRunById } from "./run-read.js";
import type {
  AgentApprovalRequest,
  AgentApprovedInvocation,
  AgentToolCallRequest,
} from "./types.js";
import { persistAssistantMessage } from "@/routes/proxy-provider/message-persistence.js";
import { threadService } from "@/services/thread.service.js";

const buildAssistantMetadata = (input: {
  runId: string;
  traceId: string;
  status: "completed" | "failed" | "blocked" | "waiting_approval";
  pendingApproval?: {
    id: string;
    stepId: string;
    toolId: string;
    reason: string;
    input?: Record<string, unknown>;
    inputHash?: string;
    createdAt: string;
  };
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
    ...(input.errorSourceNodeId
      ? {
          errorSourceNodeId: input.errorSourceNodeId,
        }
      : {}),
  },
});

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

  if (
    pendingApproval.toolId !== pendingToolCall.toolId ||
    (pendingApproval.inputHash &&
      pendingApproval.inputHash !== pendingToolCall.inputHash)
  ) {
    throw new Error(`AgentRun approval mismatch for frozen invocation: ${runId}`);
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
    selectedCapabilityId: run.selectedCapabilityId,
    selectedToolId: pendingToolCall.toolId,
    pendingToolCall,
  });

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
    approvedInvocations,
    selectedCapabilityId: run.selectedCapabilityId,
    selectedToolId: pendingToolCall.toolId,
    pendingToolCall,
  });

  for (const observation of output.observations) {
    agentRunStore.addObservation(runId, observation);
  }

  agentRunStore.complete(runId, {
    status: output.status,
    currentStepId: output.pendingApproval?.stepId ?? output.errorSourceNodeId,
    contextBudget: output.contextBudget,
    approvedInvocations,
    selectedCapabilityId: output.selectedCapabilityId,
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

  if (
    nextRun?.assistantMessageId &&
    typeof nextRun.assistantParentId !== "undefined"
  ) {
    const existingAssistantMessage = threadService.getMessageById(
      nextRun.assistantMessageId,
      nextRun.userId,
    );
    const content = output.answer.trim() || existingAssistantMessage?.content?.trim() || "";
    persistAssistantMessage({
      threadId: nextRun.threadId,
      userId: nextRun.userId,
      assistantMessageId: nextRun.assistantMessageId,
      parentId: nextRun.assistantParentId ?? null,
      content,
      metadata: buildAssistantMetadata({
        runId: nextRun.id,
        traceId: nextRun.traceId,
        status: output.status,
        pendingApproval: output.pendingApproval,
        errorMessage: output.errorMessage,
        errorSourceNodeId: output.errorSourceNodeId,
      }),
    });
  }

  return {
    run: nextRun,
    output,
  };
};
