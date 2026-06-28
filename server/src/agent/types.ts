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
  createdAt: string;
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
  approvedToolIds?: string[];
  contextBudget?: ContextBudgetAudit;
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
  approvedToolIds?: string[];
  onExecutionNode?: (
    event: AssistantExecutionNodeEvent,
  ) => Promise<void> | void;
}

export interface AgentGraphOutput {
  answer: string;
  observations: AgentObservation[];
  retrievedChunks: RetrievedChunk[];
  capabilityIntent?: CapabilityIntentResult;
  pendingApproval?: AgentApprovalRequest;
  errorMessage?: string;
  contextBudget?: ContextBudgetAudit;
  status: Extract<
    AgentRunStatus,
    "completed" | "failed" | "blocked" | "waiting_approval"
  >;
}
