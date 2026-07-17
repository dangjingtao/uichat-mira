import { providerProxyService } from "@/services/provider-proxy.service/index";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol";
import { writeStructuredLog } from "@/logger";
import type { AgentNextAction } from "../types";
import { getLatestEvidenceSummary } from "../evidence";
import {
  buildExecutionObservationView,
  buildPlannerObservationContext,
  emitStepNode,
  refreshCurrentTaskFrameFromEvidence,
  getToolTraceTargetPreview,
  summarizePlannerNextAction,
  updateCurrentTaskFrameFromPlanner,
  type AgentGraphState,
  type EmitAgentExecutionNode,
} from "../node-runtime";
import { getLatestUserQuestion } from "../nodes/shared";
import {
  ALLOWED_ACTION_TYPES,
  NEXT_ACTION_PLANNER_FALLBACK_REASON,
  toNextActionFallback,
  toPreview,
} from "./action-types";
import {
  parseNextActionPlannerOutputWithDiagnostics,
} from "./parse";
import { buildNextActionPlannerMessages, normalizeToolExposure } from "./prompt";
import { validateNextAction } from "./validate";

const PLANNER_EXECUTION_HISTORY_LIMIT = 12;
const PLANNER_COVERED_PROGRESS_LIMIT = 20;

const mergePlannerTaskFrameProgress = (
  previousFrame: AgentGraphState["currentTaskFrame"],
  refreshedFrame: AgentGraphState["currentTaskFrame"],
): AgentGraphState["currentTaskFrame"] => {
  if (!refreshedFrame) {
    return refreshedFrame;
  }

  const coveredProgress = [
    ...(previousFrame?.coveredProgress ?? []),
    ...(refreshedFrame.coveredProgress ?? []),
  ]
    .filter((item, index, items) => item && items.indexOf(item) === index)
    .slice(-PLANNER_COVERED_PROGRESS_LIMIT);

  return {
    ...refreshedFrame,
    coveredProgress: coveredProgress.length > 0 ? coveredProgress : undefined,
  };
};

const getRecoveryExhaustedPlannerConclusion = (observationContext: ReturnType<
  typeof buildPlannerObservationContext
>): AgentNextAction => {
  const latestObservation = observationContext.latestObservation;
  const failureReason =
    observationContext.recovery.errorMessage?.trim() ||
    observationContext.recovery.schemaError?.trim() ||
    latestObservation?.errorMessage?.trim() ||
    latestObservation?.reason?.trim();
  const actionLabel =
    observationContext.recovery.toolId ??
    latestObservation?.toolId ??
    (latestObservation?.actionType === "retrieve" ? "retrieval" : "the latest action");

  return {
    type: "error",
    reason: failureReason
      ? `Recovery budget exhausted after ${actionLabel} failed: ${failureReason}`
      : `Recovery budget exhausted after ${actionLabel} failed; planner must stop instead of proposing another tool action.`,
  };
};

const logPlannerDecisionDebug = (input: {
  runId: string;
  threadId: string;
  iteration: number;
  maxIterations: number;
  taskModelInvoked: boolean;
  nextAction?: AgentNextAction;
  rawOutput: string;
  sanitizedOutput: string;
  parseErrorReason?: string;
  parseWarnings?: string[];
}) => {
  writeStructuredLog(input.parseErrorReason ? "warn" : "info", {
    msg: "Planner decision debug",
    event: "agent-next-action-planner-debug",
    runId: input.runId,
    threadId: input.threadId,
    iteration: input.iteration,
    maxIterations: input.maxIterations,
    taskModelInvoked: input.taskModelInvoked,
    selectedActionType: input.nextAction?.type ?? null,
    selectedToolId:
      input.nextAction?.type === "use_tool" ? input.nextAction.toolId : null,
    reason: input.nextAction?.reason ?? null,
    parseErrorReason: input.parseErrorReason,
    parseWarnings: input.parseWarnings,
    rawOutputPreview: input.rawOutput ? toPreview(input.rawOutput) : undefined,
    sanitizedOutputPreview: input.sanitizedOutput
      ? toPreview(input.sanitizedOutput)
      : undefined,
    allowedActionTypes: [...ALLOWED_ACTION_TYPES],
  });
};

export const nextActionPlannerNode = async (
  state: AgentGraphState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentGraphState>> => {
  const iteration = state.iterationCount ?? 0;
  const maxIterations = state.maxIterations ?? 0;
  const question =
    state.question?.trim() || getLatestUserQuestion(state.messages) || state.goal.text;
  const toolExposure = normalizeToolExposure(state);
  const refreshedTaskFrame = refreshCurrentTaskFrameFromEvidence({
    frame: state.currentTaskFrame,
    goal: state.goal,
    latestQuestion: question,
    latestEvidenceSummary: getLatestEvidenceSummary(state),
  });
  const plannerVisibleTaskFrame = mergePlannerTaskFrameProgress(
    state.currentTaskFrame,
    refreshedTaskFrame,
  );
  const plannerState = {
    ...state,
    currentTaskFrame: plannerVisibleTaskFrame,
  };
  const executionHistory = buildExecutionObservationView(plannerState).slice(
    -PLANNER_EXECUTION_HISTORY_LIMIT,
  );
  const observationContext = {
    ...buildPlannerObservationContext(plannerState),
    executionHistory,
    evidenceHistory: executionHistory.flatMap((item) =>
      item.summary ? [item.summary] : [],
    ),
  };
  const latestEvidenceSummary = observationContext.latestEvidenceSummary;

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-next-action-planner",
    nodeType: "plan",
    phase: "start",
    label: "下一步动作决策",
    summary: "正在调用 task model 决定本轮下一步动作",
    details: {
      exposedToolCount: toolExposure.exposedTools.length,
      iteration,
      maxIterations,
      latestEvidenceSummary: latestEvidenceSummary ?? null,
      executionHistoryCount: executionHistory.length,
      evidenceHistoryCount: observationContext.evidenceHistory.length,
      schemaReplanAttemptCount: observationContext.recovery.attemptCount,
      schemaReplanError: observationContext.recovery.schemaError ?? null,
    },
  });

  let nextAction: AgentNextAction | undefined;
  let rawOutput = "";
  let sanitizedOutput = "";
  let parseErrorReason: string | undefined;
  let parseWarnings: string[] | undefined;
  const pendingApprovalActive = Boolean(observationContext.pendingApproval);
  const recoveryExhausted =
    observationContext.recovery.source !== "none" &&
    observationContext.recovery.exhausted;
  const taskModelInvoked =
    !pendingApprovalActive &&
    !recoveryExhausted &&
    !(maxIterations > 0 && iteration >= maxIterations);

  if (pendingApprovalActive) {
    nextAction = undefined;
  } else if (recoveryExhausted) {
    nextAction = getRecoveryExhaustedPlannerConclusion(observationContext);
  } else if (maxIterations > 0 && iteration >= maxIterations) {
    nextAction = toNextActionFallback(
      "Planner reached the iteration limit and must stop.",
    );
  } else {
    const messages: NormalizedChatMessage[] = buildNextActionPlannerMessages({
      question,
      messages: state.messages,
      observationContext,
      toolExposure,
      iteration,
      maxIterations,
    });

    const resolvePlannerModelAction = async (
      plannerMessages: NormalizedChatMessage[],
    ) => {
      let resolvedRawOutput = "";
      for await (const delta of providerProxyService.streamTaskChatText(plannerMessages)) {
        resolvedRawOutput += delta;
      }

      const validationResult = validateNextAction(
        parseNextActionPlannerOutputWithDiagnostics(resolvedRawOutput),
        toolExposure.exposedTools,
      );

      return {
        action: validationResult.action,
        rawOutput: resolvedRawOutput,
        sanitizedOutput: validationResult.sanitizedOutput ?? "",
        parseErrorReason: validationResult.parseErrorReason,
        parseWarnings: validationResult.parseWarnings,
      };
    };

    try {
      const initialPlannerDecision = await resolvePlannerModelAction(messages);
      nextAction = initialPlannerDecision.action;
      rawOutput = initialPlannerDecision.rawOutput;
      sanitizedOutput = initialPlannerDecision.sanitizedOutput;
      parseErrorReason = initialPlannerDecision.parseErrorReason;
      parseWarnings = initialPlannerDecision.parseWarnings;
    } catch (error) {
      nextAction = toNextActionFallback(
        error instanceof Error && error.message.trim()
          ? `Planner task model call failed: ${error.message.trim()}`
          : NEXT_ACTION_PLANNER_FALLBACK_REASON,
      );
    }
  }

  logPlannerDecisionDebug({
    runId: state.runId,
    threadId: state.threadId,
    iteration,
    maxIterations,
    taskModelInvoked,
    nextAction,
    rawOutput,
    sanitizedOutput,
    parseErrorReason,
    parseWarnings,
  });

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-next-action-planner",
    nodeType: "plan",
    phase: "done",
    label: "下一步动作决策",
    summary: summarizePlannerNextAction({
      nextAction,
      pendingApprovalActive,
      recoveryExhausted,
    }),
    details: {
      exposedToolCount: toolExposure.exposedTools.length,
      selectedActionType: nextAction?.type ?? null,
      selectedToolId: nextAction?.type === "use_tool" ? nextAction.toolId : null,
      selectedToolTarget:
        nextAction?.type === "use_tool"
          ? getToolTraceTargetPreview(nextAction.toolId, nextAction.args) ?? null
          : nextAction?.type === "retrieve"
            ? nextAction.query
            : nextAction?.type === "ask_user"
              ? nextAction.question
              : null,
      reason: nextAction?.reason ?? null,
      iteration,
      maxIterations,
      latestEvidenceSummary: latestEvidenceSummary ?? null,
      executionHistoryCount: executionHistory.length,
      evidenceHistoryCount: observationContext.evidenceHistory.length,
      rawOutputPreview: rawOutput ? toPreview(rawOutput) : undefined,
      sanitizedOutputPreview: sanitizedOutput ? toPreview(sanitizedOutput) : undefined,
      parseErrorReason,
      parseWarnings,
      schemaReplanAttemptCount: observationContext.recovery.attemptCount,
      schemaReplanError: observationContext.recovery.schemaError ?? null,
      pendingApprovalActive,
      recoveryExhausted,
      allowedActionTypes: [...ALLOWED_ACTION_TYPES],
    },
  });

  const updatedPlannerTaskFrame = nextAction
    ? updateCurrentTaskFrameFromPlanner({
        frame: plannerVisibleTaskFrame ?? state.currentTaskFrame,
        goal: state.goal,
        nextAction,
        latestQuestion: question,
        latestEvidenceSummary: observationContext.latestEvidenceSummary,
      })
    : undefined;
  const plannerTaskFrame = mergePlannerTaskFrameProgress(
    plannerVisibleTaskFrame,
    updatedPlannerTaskFrame,
  );

  return {
    ...(nextAction ? { nextAction } : {}),
    ...(plannerTaskFrame ? { currentTaskFrame: plannerTaskFrame } : {}),
    ...(nextAction?.type === "error" && observationContext.recovery.schemaError
      ? {
          schemaReplanDiagnostics: {
            schemaError: observationContext.recovery.schemaError,
            toolId: observationContext.recovery.toolId,
            invalidAction: observationContext.recovery.invalidAction,
            attemptCount: observationContext.recovery.attemptCount,
          },
        }
      : {}),
    ...(nextAction?.type === "error"
      ? {
          errorMessage: nextAction.reason,
          blockedReason: nextAction.reason,
          errorSourceNodeId: "agent-next-action-planner",
        }
      : {}),
  };
};
