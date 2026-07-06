import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol";
import type { RetrievedChunk } from "@/services/rag-nodes";
import type { ContextBudgetAudit } from "@/services/context-budget/index";
import { toAgentExecutionNode } from "./trace";
import { getEvidencePayload, getLatestEvidenceSummary } from "./evidence";
import type {
  AgentIntentEmbeddingConfig,
  ToolIntentResult,
} from "./intent/index";
import { SCHEMA_REPLAN_ATTEMPT_LIMIT } from "./planner/action-types";
import type {
  AgentApprovedInvocation,
  AgentApprovalRequest,
  AgentEvidencePayload,
  AgentExecutionObservation,
  AgentEvidenceSummary,
  AgentGoal,
  AgentNextAction,
  AgentObservation,
  AgentPlan,
  AgentPolicyDecision,
  AgentRetrievalEvidence,
  AgentSchemaReplanDiagnostics,
  AgentToolCallRequest,
  AgentToolExecutionResult,
  AgentToolExposureState,
  CurrentTaskFrame,
  CurrentTaskFrameConfirmedObject,
  PlannerObservationContext,
} from "./types";

const getLatestUserQuestionText = (
  messages: NormalizedChatMessage[] | undefined,
) => {
  const latest = messages
    ? [...messages].reverse().find((message) => message.role === "user")
    : undefined;
  const question = latest?.content.trim();
  return question ? question : undefined;
};

const getCurrentTaskFrameGoalText = (input: {
  goal: AgentGoal;
  latestQuestion?: string;
}) => {
  const latestQuestion = input.latestQuestion?.trim();
  return latestQuestion || input.goal.text;
};

export interface AgentNodeState {
  runId: string;
  threadId: string;
  userId: number;
  goal: AgentGoal;
  plan: AgentPlan;
  question?: string;
  currentTaskFrame?: CurrentTaskFrame;
  messages: NormalizedChatMessage[];
  requestContextMessages?: NormalizedChatMessage[];
  params?: Record<string, unknown>;
  knowledgeBaseId?: string | null;
  intentConfig?: AgentIntentEmbeddingConfig;
  workspaceRoot?: string | null;
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
  schemaReplanDiagnostics?: AgentSchemaReplanDiagnostics;
  generatedAnswerEmptyFallback?: boolean;
  iterationCount?: number;
  maxIterations?: number;
  continueIteration?: boolean;
  postToolReviewPending?: boolean;
  reviewDecision?: "tool" | "generate";
  reviewReason?: string;
}

export type AgentGraphState = AgentNodeState;

const buildExecutionObservationId = (input: {
  actionType: AgentExecutionObservation["actionType"];
  createdAt: string;
  stepId?: string;
  toolId?: string;
  toolCallId?: string;
  inputHash?: string;
}) =>
  [
    input.actionType,
    input.toolCallId ?? input.stepId ?? input.toolId ?? input.inputHash ?? "unknown",
    input.createdAt,
  ].join(":");

const getExecutionObservationActionType = (
  stepId: string | undefined,
): AgentExecutionObservation["actionType"] => {
  switch (stepId) {
    case "retrieve":
      return "retrieve";
    case "generate":
      return "generate";
    case "approval":
      return "approval";
    case "tool":
    default:
      return "tool";
  }
};

const getExecutionObservationStatusFromObservation = (
  observation: AgentObservation,
): AgentExecutionObservation["status"] => {
  switch (observation.status) {
    case "ok":
      return "completed";
    case "partial":
      return "failed_recoverable";
    case "blocked":
      return observation.stepId === "approval"
        ? "waiting_approval"
        : "failed_terminal";
    case "failed":
    default:
      return observation.stepId === "generate"
        ? "failed_terminal"
        : "failed_recoverable";
  }
};

export const toExecutionObservationFromObservation = (
  observation: AgentObservation,
): AgentExecutionObservation => ({
  id: buildExecutionObservationId({
    actionType: getExecutionObservationActionType(observation.stepId),
    createdAt: observation.createdAt,
    stepId: observation.stepId,
  }),
  source: "observation",
  actionType: getExecutionObservationActionType(observation.stepId),
  status: getExecutionObservationStatusFromObservation(observation),
  createdAt: observation.createdAt,
  stepId: observation.stepId,
  resultPreview: observation.facts.slice(0, 3),
  summary: observation.summary,
  facts: observation.facts.slice(0, 5),
  errorMessage: observation.errorMessage,
  recoverable: getExecutionObservationStatusFromObservation(observation) === "failed_recoverable",
  suggestedNextActions:
    getExecutionObservationStatusFromObservation(observation) === "failed_terminal"
      ? ["report_terminal_failure"]
      : ["review_latest_evidence", "plan_next_action"],
});

export const toExecutionObservationFromToolExecution = (
  execution: AgentToolExecutionResult,
): AgentExecutionObservation => {
  const status: AgentExecutionObservation["status"] =
    execution.status === "completed"
      ? "completed"
      : execution.status === "awaiting_approval"
        ? "waiting_approval"
        : execution.status === "denied"
          ? "failed_terminal"
          : "failed_recoverable";
  const createdAt = execution.finishedAt || execution.startedAt;

  return {
    id: buildExecutionObservationId({
      actionType: "tool",
      createdAt,
      toolId: execution.toolId,
      toolCallId: execution.toolCallId,
      inputHash: execution.inputHash,
    }),
    source: "tool_execution",
    actionType: "tool",
    status,
    createdAt,
    toolId: execution.toolId,
    toolCallId: execution.toolCallId,
    inputHash: execution.inputHash,
    argsPreview: execution.args,
    resultPreview: execution.summary?.data ?? execution.result,
    summary: execution.summary,
    errorMessage: execution.errorMessage,
    errorCode: execution.status === "denied" ? "denied" : undefined,
    recoverable: status === "failed_recoverable",
    suggestedNextActions:
      status === "completed"
        ? ["review_tool_result", "plan_next_action"]
        : status === "waiting_approval"
          ? ["wait_for_approval", "resume_after_approval"]
          : status === "failed_terminal"
            ? ["report_terminal_failure"]
            : ["inspect_failure_cause", "retry_with_adjustment", "switch_action"],
    reason: execution.approval?.reason,
  };
};

export const toExecutionObservationFromRetrievalResult = (
  retrieval: AgentRetrievalEvidence,
): AgentExecutionObservation => {
  const status: AgentExecutionObservation["status"] =
    retrieval.chunkCount > 0 ? "completed" : "failed_recoverable";

  return {
    id: buildExecutionObservationId({
      actionType: "retrieve",
      createdAt: retrieval.createdAt,
      inputHash: retrieval.query,
    }),
    source: "retrieval",
    actionType: "retrieve",
    status,
    createdAt: retrieval.createdAt,
    argsPreview: {
      query: retrieval.query,
      knowledgeBaseId: retrieval.knowledgeBaseId,
    },
    resultPreview: {
      query: retrieval.query,
      chunkCount: retrieval.chunkCount,
      documents: retrieval.chunks.slice(0, 3).map((chunk) => chunk.documentName),
    },
    summary: retrieval.summary,
    recoverable: status === "failed_recoverable",
    suggestedNextActions:
      status === "completed"
        ? ["review_retrieval_evidence", "plan_next_action"]
        : ["refine_retrieval_query", "switch_to_local_evidence_or_tool"],
  };
};

export const toExecutionObservationFromPendingApproval = (
  approval: AgentApprovalRequest,
  summary?: AgentEvidenceSummary,
): AgentExecutionObservation => ({
  id: buildExecutionObservationId({
    actionType: "approval",
    createdAt: approval.createdAt,
    stepId: approval.stepId,
    toolId: approval.toolId,
    toolCallId: approval.toolCallId,
    inputHash: approval.inputHash,
  }),
  source: "approval",
  actionType: "approval",
  status: "waiting_approval",
  createdAt: approval.createdAt,
  stepId: approval.stepId,
  toolId: approval.toolId,
  toolCallId: approval.toolCallId,
  inputHash: approval.inputHash,
  argsPreview: approval.input,
  summary,
  resultPreview: {
    toolId: approval.toolId,
    reason: approval.reason,
  },
  recoverable: false,
  suggestedNextActions: ["wait_for_approval", "resume_after_approval"],
  reason: approval.reason,
});

const comparePlannerObservationItems = (
  left: AgentExecutionObservation,
  right: AgentExecutionObservation,
) => left.createdAt.localeCompare(right.createdAt);

/**
 * Fact-source boundary for T021:
 * - retrieve executor facts come from evidence.retrievals
 * - tool executor facts come from lastToolExecution
 * - approval facts come from pendingApproval
 * - generic node observations remain a fallback fact source for actions that
 *   still do not have a dedicated executor-result record, currently generate
 *   and legacy retrieve/tool observations
 *
 * Planner must not consume those scattered structures directly.
 * Planner only consumes the unified execution-observation view built here.
 */
export const buildExecutionObservationView = (
  state: Pick<
    AgentNodeState,
    | "observations"
    | "evidence"
    | "lastToolExecution"
    | "pendingApproval"
  >,
): AgentExecutionObservation[] => {
  const evidence = getEvidencePayload(state);
  const items: AgentExecutionObservation[] = [];

  for (const retrieval of evidence.retrievals) {
    items.push(toExecutionObservationFromRetrievalResult(retrieval));
  }

  if (state.lastToolExecution) {
    items.push(toExecutionObservationFromToolExecution(state.lastToolExecution));
  }

  if (state.pendingApproval) {
    items.push(
      toExecutionObservationFromPendingApproval(
        state.pendingApproval,
        state.lastToolExecution?.summary,
      ),
    );
  }

  const hasRetrievalFacts = evidence.retrievals.length > 0;
  for (const observation of evidence.observations) {
    if (observation.stepId === "generate") {
      items.push(toExecutionObservationFromObservation(observation));
      continue;
    }

    if (observation.stepId === "retrieve" && !hasRetrievalFacts) {
      items.push(toExecutionObservationFromObservation(observation));
      continue;
    }

    if (
      observation.stepId !== "retrieve" &&
      observation.stepId !== "tool" &&
      observation.stepId !== "approval"
    ) {
      items.push(toExecutionObservationFromObservation(observation));
    }
  }

  items.sort(comparePlannerObservationItems);
  return items;
};

export const createInitialCurrentTaskFrame = (input: {
  goal: AgentGoal;
  latestQuestion?: string;
  messages?: NormalizedChatMessage[];
  workspaceRoot?: string | null;
  knowledgeBaseId?: string | null;
}): CurrentTaskFrame => {
  const confirmedObjects: CurrentTaskFrameConfirmedObject[] = [];
  const currentGoal = getCurrentTaskFrameGoalText({
    goal: input.goal,
    latestQuestion: input.latestQuestion ?? getLatestUserQuestionText(input.messages),
  });

  if (input.workspaceRoot) {
    confirmedObjects.push({
      type: "file",
      id: input.workspaceRoot,
      label: input.workspaceRoot,
      confidence: 1,
    });
  }

  if (input.knowledgeBaseId) {
    confirmedObjects.push({
      type: "knowledge",
      id: input.knowledgeBaseId,
      label: input.knowledgeBaseId,
      confidence: 1,
    });
  }

  return {
    currentGoal,
    currentSubtask: "Prepare context and determine the next action.",
    currentBlocker: undefined,
    confirmedObjects,
    completionCriteria:
      input.goal.successCriteria.length > 0 ? [...input.goal.successCriteria] : [currentGoal],
  };
};

export const appendConfirmedObjectToTaskFrame = (
  frame: CurrentTaskFrame | undefined,
  confirmedObject: CurrentTaskFrameConfirmedObject,
): CurrentTaskFrame | undefined => {
  if (!frame) {
    return frame;
  }

  const exists = frame.confirmedObjects.some(
    (item) =>
      item.type === confirmedObject.type &&
      item.id === confirmedObject.id &&
      item.label === confirmedObject.label,
  );
  if (exists) {
    return frame;
  }

  return {
    ...frame,
    confirmedObjects: [...frame.confirmedObjects, confirmedObject],
  };
};

export const updateTaskFrameBlocker = (
  frame: CurrentTaskFrame | undefined,
  blocker?: string,
): CurrentTaskFrame | undefined => {
  if (!frame) {
    return frame;
  }

  return {
    ...frame,
    currentBlocker: blocker,
  };
};

const getPlannerSubtask = (nextAction: AgentNextAction): string => {
  switch (nextAction.type) {
    case "retrieve":
      return `Retrieve evidence for: ${nextAction.query}`;
    case "use_tool":
      return `Run ${nextAction.toolId} with reviewed parameters.`;
    case "answer":
      return "Draft the final answer from the current evidence.";
    case "ask_user":
      return "Ask the user for the missing information needed to continue.";
    case "error":
      return "Report why the planner cannot continue safely.";
    default:
      return "Determine the next action.";
  }
};

/**
 * PlannerNode is the primary runtime writer for goal/subtask/completion state.
 * Executor nodes may only append objective confirmed objects or blocker facts.
 */
export const updateCurrentTaskFrameFromPlanner = (input: {
  frame: CurrentTaskFrame | undefined;
  goal: AgentGoal;
  nextAction: AgentNextAction;
  latestQuestion?: string;
}): CurrentTaskFrame | undefined => {
  if (!input.frame) {
    return input.frame;
  }

  const currentGoal = getCurrentTaskFrameGoalText({
    goal: input.goal,
    latestQuestion: input.latestQuestion,
  });
  const completionCriteria =
    input.frame.completionCriteria.length > 0
      ? [...input.frame.completionCriteria]
      : input.goal.successCriteria.length > 0
        ? [...input.goal.successCriteria]
        : [currentGoal];

  return {
    ...input.frame,
    currentGoal,
    currentSubtask: getPlannerSubtask(input.nextAction),
    completionCriteria,
    currentBlocker:
      input.nextAction.type === "error"
        ? input.nextAction.reason
        : input.frame.currentBlocker,
  };
};

export const buildPlannerObservationContext = (
  state: Pick<
    AgentNodeState,
    | "currentTaskFrame"
    | "observations"
    | "evidence"
    | "lastToolExecution"
    | "pendingApproval"
    | "schemaReplanDiagnostics"
  >,
): PlannerObservationContext => {
  const items = buildExecutionObservationView(state);
  const recentObservations = items.slice(-5).reverse();
  const latestObservation = recentObservations[0];
  const recoveryAttemptCount = state.schemaReplanDiagnostics?.attemptCount ?? 0;

  return {
    currentTaskFrame: state.currentTaskFrame,
    latestObservation,
    recentObservations,
    latestEvidenceSummary: getLatestEvidenceSummary(state),
    recovery: {
      attemptCount: recoveryAttemptCount,
      maxAttempts: SCHEMA_REPLAN_ATTEMPT_LIMIT,
      exhausted: recoveryAttemptCount >= SCHEMA_REPLAN_ATTEMPT_LIMIT,
      schemaError: state.schemaReplanDiagnostics?.schemaError,
      toolId: state.schemaReplanDiagnostics?.toolId,
      invalidAction: state.schemaReplanDiagnostics?.invalidAction,
    },
    pendingApproval: state.pendingApproval
      ? {
          toolId: state.pendingApproval.toolId,
          inputHash: state.pendingApproval.inputHash,
          reason: state.pendingApproval.reason,
        }
      : undefined,
  };
};

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
