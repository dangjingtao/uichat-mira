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
import type { AssistantExecutionNodeEvent } from "@/services/chat-stream-events.js";

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
    const parts = buildAssistantParts({
      content,
      existingParts: existingAssistantMessage?.parts,
      executionNodes: resumedExecutionNodes,
    });
    persistAssistantMessage({
      threadId: nextRun.threadId,
      userId: nextRun.userId,
      assistantMessageId: nextRun.assistantMessageId,
      parentId: nextRun.assistantParentId ?? null,
      content,
      parts,
      metadata: buildAssistantMetadata({
        runId: nextRun.id,
        traceId: nextRun.traceId,
        status: output.status,
        pendingApproval: output.pendingApproval,
        blockedReason: output.blockedReason,
        terminalReason: output.terminalReason,
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
