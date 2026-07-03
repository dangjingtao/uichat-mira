import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import type { RetrievedChunk } from "@/services/rag-nodes";
import type { ContextBudgetAudit } from "@/services/context-budget/index.js";
import { toAgentExecutionNode } from "./trace.js";
import type {
  AgentIntentEmbeddingConfig,
  ToolIntentResult,
} from "./intent/index.js";
import type {
  AgentApprovedInvocation,
  AgentApprovalRequest,
  AgentEvidencePayload,
  AgentGoal,
  AgentNextAction,
  AgentObservation,
  AgentPlan,
  AgentPolicyDecision,
  AgentToolCallRequest,
  AgentToolExecutionResult,
  AgentToolExposureState,
} from "./types.js";

export interface AgentNodeState {
  runId: string;
  threadId: string;
  userId: number;
  goal: AgentGoal;
  plan: AgentPlan;
  question?: string;
  taskFrame?: Record<string, unknown> | string;
  messages: NormalizedChatMessage[];
  requestContextMessages?: NormalizedChatMessage[];
  params?: Record<string, unknown>;
  knowledgeBaseId?: string | null;
  intentConfig?: AgentIntentEmbeddingConfig;
  toolIntent?: ToolIntentResult;
  toolExposure?: AgentToolExposureState;
  nextAction?: AgentNextAction;
  answer?: string;
  retrievedChunks?: RetrievedChunk[];
  observations?: AgentObservation[];
  blockedReason?: string;
  terminalReason?: string;
  pendingApproval?: AgentApprovalRequest;
  approvedInvocations?: AgentApprovedInvocation[];
  policyDecision?: AgentPolicyDecision;
  /**
   * Legacy / trace / UI compatibility only.
   * Node execution must never branch to policy / tool from this field.
   * The only execution entry is pendingToolCall.
   */
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
  reviewDecision?: "tool" | "generate";
  reviewReason?: string;
}

export type AgentGraphState = AgentNodeState;

export type EmitAgentExecutionNode = (
  event: ReturnType<typeof toAgentExecutionNode>,
) => Promise<void> | void;

export const getIterativeNodeId = (
  baseNodeId: string,
  state: Pick<AgentNodeState, "iterationCount">,
) => `${baseNodeId}-${state.iterationCount ?? 0}`;

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

export const emitStepNode = async (
  emit: EmitAgentExecutionNode | undefined,
  input: Parameters<typeof toAgentExecutionNode>[0],
) => {
  await emit?.(toAgentExecutionNode(input));
};
