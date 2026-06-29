import type { AssistantExecutionNodeEvent } from "@/services/chat-stream-events.js";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import type { RetrievedChunk } from "@/services/rag-nodes";
import type { ContextBudgetAudit } from "@/services/context-budget/index.js";
import type {
  AgentIntentEmbeddingConfig,
  CapabilityIntentResult,
} from "./intent/index.js";

export type AgentRunStatus =
  | "queued"
  | "running"
  | "waiting_approval"
  | "waiting_user"
  | "completed"
  | "failed"
  | "blocked"
  | "cancelled";

export type AgentStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export type AgentStepKind =
  | "reason"
  | "retrieve"
  | "tool"
  | "generate"
  | "memory"
  | "ask_user"
  | "approval";

export type AgentRiskLevel = "low" | "medium" | "high";

export interface AgentGoal {
  id: string;
  text: string;
  successCriteria: string[];
  constraints: string[];
  riskLevel: AgentRiskLevel;
}

export interface AgentPlanStep {
  id: string;
  kind: AgentStepKind;
  title: string;
  status: AgentStepStatus;
  riskLevel: AgentRiskLevel;
  requiresApproval: boolean;
  toolId?: string;
  input?: Record<string, unknown>;
}

export interface AgentPlan {
  id: string;
  goalId: string;
  version: number;
  steps: AgentPlanStep[];
}

export interface AgentObservation {
  id: string;
  runId: string;
  stepId: string;
  status: "ok" | "partial" | "failed" | "blocked";
  facts: string[];
  errorMessage?: string;
  rawRef?: string;
  createdAt: string;
}

export interface AgentApprovalRequest {
  id: string;
  runId: string;
  stepId: string;
  toolId: string;
  reason: string;
  input?: Record<string, unknown>;
  inputHash?: string;
  createdAt: string;
}

export interface AgentToolCallRequest {
  toolId: string;
  args: Record<string, unknown>;
  inputHash: string;
  createdAt: string;
}

export interface AgentApprovedInvocation {
  toolId: string;
  input: Record<string, unknown>;
  inputHash: string;
  approvedAt: string;
  approvalId: string;
}

export interface AgentToolExecutionResult {
  toolId: string;
  args: Record<string, unknown>;
  invocationId?: string;
  status: "completed" | "failed" | "awaiting_approval";
  result?: unknown;
  errorMessage?: string;
  approval?: AgentApprovalRequest;
  startedAt: string;
  finishedAt: string;
}

export interface AgentRetrievalEvidence {
  knowledgeBaseId?: string | null;
  query: string;
  chunkCount: number;
  chunks: Array<{
    chunkId: string | number;
    documentName: string;
    score?: number;
    content: string;
  }>;
  createdAt: string;
}

export interface AgentEvidencePayload {
  observations: AgentObservation[];
  toolExecutions: AgentToolExecutionResult[];
  retrievals: AgentRetrievalEvidence[];
}

export interface AgentRun {
  id: string;
  threadId: string;
  userId: number;
  goal: AgentGoal;
  plan: AgentPlan;
  status: AgentRunStatus;
  observations: AgentObservation[];
  traceId: string;
  currentStepId?: string;
  pendingApproval?: AgentApprovalRequest;
  approvedInvocations?: AgentApprovedInvocation[];
  contextBudget?: ContextBudgetAudit;
  selectedCapabilityId?: string;
  selectedToolId?: string;
  pendingToolCall?: AgentToolCallRequest;
  lastToolExecution?: AgentToolExecutionResult;
  evidence?: AgentEvidencePayload;
  assistantMessageId?: string;
  assistantParentId?: string | null;
  runtimeInput?: Pick<
    AgentGraphInput,
    | "messages"
    | "requestContextMessages"
    | "params"
    | "knowledgeBaseId"
    | "intentConfig"
  >;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRunStore {
  create(input: {
    threadId: string;
    userId: number;
    goal: AgentGoal;
    plan: AgentPlan;
    assistantMessageId?: string;
    assistantParentId?: string | null;
    runtimeInput?: Pick<
      AgentGraphInput,
      | "messages"
      | "requestContextMessages"
      | "params"
      | "knowledgeBaseId"
      | "intentConfig"
    >;
  }): AgentRun;
  get(runId: string): AgentRun | undefined;
  update(runId: string, patch: Partial<Omit<AgentRun, "id" | "createdAt">>): AgentRun;
  addObservation(runId: string, observation: AgentObservation): AgentRun;
  complete(
    runId: string,
    patch: Partial<Omit<AgentRun, "id" | "createdAt" | "status">> & {
      status: Extract<
        AgentRun["status"],
        "completed" | "failed" | "blocked" | "cancelled" | "waiting_approval"
      >;
    },
  ): AgentRun;
  configureRetention?(config: { maxEntries?: number; ttlMs?: number }): void;
  sweep?(): void;
  clear(): void;
}

export interface AgentGraphInput {
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
  approvedInvocations?: AgentApprovedInvocation[];
  selectedCapabilityId?: string;
  selectedToolId?: string;
  pendingToolCall?: AgentToolCallRequest;
  maxIterations?: number;
  continueIteration?: boolean;
  postToolReviewPending?: boolean;
  onExecutionNode?: (
    event: AssistantExecutionNodeEvent,
  ) => Promise<void> | void;
}

export interface AgentGraphOutput {
  answer: string;
  observations: AgentObservation[];
  evidence: AgentEvidencePayload;
  retrievedChunks: RetrievedChunk[];
  capabilityIntent?: CapabilityIntentResult;
  pendingApproval?: AgentApprovalRequest;
  selectedCapabilityId?: string;
  selectedToolId?: string;
  pendingToolCall?: AgentToolCallRequest;
  lastToolExecution?: AgentToolExecutionResult;
  errorMessage?: string;
  errorSourceNodeId?: string;
  contextBudget?: ContextBudgetAudit;
  status: Extract<
    AgentRunStatus,
    "completed" | "failed" | "blocked" | "waiting_approval"
  >;
}
