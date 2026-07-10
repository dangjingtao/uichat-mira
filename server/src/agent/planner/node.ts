import { providerProxyService } from "@/services/provider-proxy.service/index";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol";
import { writeStructuredLog } from "@/logger";
import type { AgentNextAction } from "../types";
import {
  buildPlannerObservationContext,
  emitStepNode,
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
  const observationContext = buildPlannerObservationContext(state);
  const latestEvidenceSummary = observationContext.latestEvidenceSummary;
  const taskCoverageView = observationContext.taskCoverageView;

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
      taskCoverageView: taskCoverageView ?? null,
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
      taskCoverageView: taskCoverageView ?? null,
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

  const plannerTaskFrame = nextAction
    ? updateCurrentTaskFrameFromPlanner({
        frame: state.currentTaskFrame,
        goal: state.goal,
        nextAction,
        latestQuestion: question,
      })
    : undefined;

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
