import type { AssistantExecutionNodeEvent } from "@/services/chat-stream-events.js";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import type { RetrievedChunk } from "@/services/rag-nodes";
import type { ContextBudgetAudit } from "@/services/context-budget/index.js";
import type {
  AgentIntentEmbeddingConfig,
  ToolIntentResult,
} from "./intent/index.js";
import type { McpToolDefinition } from "@/mcp/core/definitions.js";

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
  summary?: AgentEvidenceSummary;
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

export interface AgentToolMeta {
  toolId: string;
  title: string;
  description: string;
  inputSchema?: McpToolDefinition["inputSchema"];
  domain?: McpToolDefinition["domain"];
  source?: McpToolDefinition["source"];
  tags?: string[];
  capabilities?: McpToolDefinition["capabilities"];
}

export interface PendingToolCall {
  id: string;
  toolId: string;
  args: Record<string, unknown>;
  reason?: string;
  inputHash: string;
  source: "planner";
  status: "frozen";
  toolMeta?: AgentToolMeta;
  createdAt: string;
}

export interface LegacyAgentToolCallRequest {
  toolId: string;
  args: Record<string, unknown>;
  inputHash: string;
  source: "planner_selection" | "llm_tool_call";
  createdAt: string;
}

export type AgentToolCallRequest =
  | PendingToolCall
  | LegacyAgentToolCallRequest;

export interface AgentApprovedInvocation {
  toolId: string;
  input: Record<string, unknown>;
  inputHash: string;
  approvedAt: string;
  approvalId: string;
}

export interface AgentPolicyDecision {
  type: "allow" | "require_approval" | "deny" | "skip" | "error";
  toolId?: string;
  inputHash?: string;
  reason: string;
}

export interface AgentToolExecutionResult {
  toolCallId?: string;
  toolId: string;
  inputHash?: string;
  args: Record<string, unknown>;
  invocationId?: string;
  status: "completed" | "failed" | "awaiting_approval";
  result?: unknown;
  errorMessage?: string;
  approval?: AgentApprovalRequest;
  summary?: AgentEvidenceSummary;
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
  summary?: AgentEvidenceSummary;
  createdAt: string;
}

export interface AgentEvidencePayload {
  observations: AgentObservation[];
  toolExecutions: AgentToolExecutionResult[];
  retrievals: AgentRetrievalEvidence[];
  latestSummary?: AgentEvidenceSummary;
}

export interface AgentEvidenceAnswerReadiness {
  canAnswer: boolean;
  reason: string;
  missingInfo?: string[];
}

export interface AgentReadListEvidenceData {
  kind: "read_list";
  path: string;
  entryCount: number;
  fileCount: number;
  directoryCount: number;
  entriesPreview: string[];
  truncated: boolean;
  canAnswerDirectoryQuestion: boolean;
}

export interface AgentReadOpenEvidenceData {
  kind: "read_open";
  path: string;
  contentPreview: string;
  contentLength: number;
  truncated: boolean;
  keySections?: string[];
  canAnswerFileQuestion: boolean;
}

export interface AgentWebSearchEvidenceData {
  kind: "web_search";
  query: string;
  resultCount: number;
  topFindings: string[];
  citationsPreview: Array<{
    title: string;
    link: string;
  }>;
  canAnswerSearchQuestion: boolean;
}

export interface AgentTerminalSessionEvidenceData {
  kind: "terminal_session";
  command: string;
  exitCode: number | null;
  stdoutPreview: string;
  stderrPreview: string;
  timedOut: boolean;
  canAnswerCommandQuestion: boolean;
}

export interface AgentRetrievalEvidenceData {
  kind: "retrieval";
  query: string;
  chunkCount: number;
  documentsPreview: string[];
}

export interface AgentObservationEvidenceData {
  kind: "observation";
  stepId: string;
  factsPreview: string[];
}

export type AgentEvidenceSummaryData =
  | AgentReadListEvidenceData
  | AgentReadOpenEvidenceData
  | AgentWebSearchEvidenceData
  | AgentTerminalSessionEvidenceData
  | AgentRetrievalEvidenceData
  | AgentObservationEvidenceData;

export interface AgentEvidenceSummary {
  source: "tool" | "retrieval" | "observation";
  status: "completed" | "failed" | "awaiting_approval" | "partial" | "blocked";
  toolId?: string;
  inputHash?: string;
  actionTaken: string;
  keyFindings: string[];
  answerReadiness: AgentEvidenceAnswerReadiness;
  data?: AgentEvidenceSummaryData;
  rawRef?: {
    evidenceIndex?: number;
    toolCallId?: string;
    invocationId?: string;
  };
}

export interface AgentRepeatedActionGuardResult {
  triggered: boolean;
  reason?: string;
  guardedActionType?: "use_tool" | "retrieve";
  guardedToolId?: string;
  guardedArgsHash?: string;
  guardedQuery?: string;
  matchedEvidenceIndex?: number;
  matchedToolCallId?: string;
}

export type AgentNextAction =
  | {
      type: "answer";
      reason: string;
    }
  | {
      type: "retrieve";
      query: string;
      reason: string;
    }
  | {
      type: "use_tool";
      toolId: string;
      args: Record<string, unknown>;
      reason: string;
    }
  | {
      type: "ask_user";
      question: string;
      reason: string;
    }
  | {
      type: "error";
      reason: string;
    };

export interface AgentToolExposureState {
  exposedTools: string[];
  toolMeta: AgentToolMeta[];
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
  blockedReason?: string;
  terminalReason?: string;
  pendingApproval?: AgentApprovalRequest;
  approvedInvocations?: AgentApprovedInvocation[];
  policyDecision?: AgentPolicyDecision;
  contextBudget?: ContextBudgetAudit;
  /**
   * Legacy / trace / UI compatibility only.
   * It must not be treated as a tool execution entry.
   * Real execution must always use pendingToolCall.toolId.
   */
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
    | "workspaceRoot"
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
      | "workspaceRoot"
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
  workspaceRoot?: string | null;
  approvedInvocations?: AgentApprovedInvocation[];
  policyDecision?: AgentPolicyDecision;
  /**
   * Legacy / trace / UI compatibility only.
   * Graph routing, policy approval and tool execution must not derive execution
   * from this field.
   */
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
  toolIntent?: ToolIntentResult;
  pendingApproval?: AgentApprovalRequest;
  policyDecision?: AgentPolicyDecision;
  /**
   * Legacy / trace / UI compatibility only.
   * This can be surfaced for diagnostics or UI continuity, but execution must
   * remain bound to pendingToolCall.toolId.
   */
  selectedToolId?: string;
  pendingToolCall?: AgentToolCallRequest;
  lastToolExecution?: AgentToolExecutionResult;
  blockedReason?: string;
  terminalReason?: string;
  errorMessage?: string;
  errorSourceNodeId?: string;
  contextBudget?: ContextBudgetAudit;
  status: Extract<
    AgentRunStatus,
    "completed" | "failed" | "blocked" | "waiting_approval"
  >;
}
