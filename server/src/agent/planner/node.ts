import { providerProxyService } from "@/services/provider-proxy.service/index";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol";
import { writeStructuredLog } from "@/logger";
import { getEvidencePayload, getTaskCompletionDecision } from "../evidence";
import type { AgentNextAction, AgentRepeatedActionGuardResult } from "../types";
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
import { getPlannerAnswerStopDecision } from "./answer-stop";
import {
  getReadOpenBridgeActionFromListEvidence,
  getReadOpenBridgeActionFromLocateEvidence,
} from "./locate-open-bridge";
import {
  getWorkspaceLocalIntentGuardAction,
  LOCAL_INTENT_GUARD_REASON,
} from "./local-intent-guard";
import {
  parseNextActionPlannerOutputWithDiagnostics,
} from "./parse";
import {
  buildAnswerCompletionReplanMessages,
  buildNextActionPlannerMessages,
  normalizeToolExposure,
} from "./prompt";
import { getPlannerRepeatedActionGuardResult } from "./repeated-action-guard";
import { validateNextAction } from "./validate";
import { getCoverageTransitionDecision } from "./coverage-transition";
import { reduceAgentCoverageState } from "../coverage-state";

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
  answerStopRuleTriggered: boolean;
  taskModelInvoked: boolean;
  nextAction?: AgentNextAction;
  rawOutput: string;
  sanitizedOutput: string;
  parseErrorReason?: string;
  parseWarnings?: string[];
  repeatedActionGuard?: AgentRepeatedActionGuardResult;
}) => {
  writeStructuredLog(input.parseErrorReason ? "warn" : "info", {
    msg: "Planner decision debug",
    event: "agent-next-action-planner-debug",
    runId: input.runId,
    threadId: input.threadId,
    iteration: input.iteration,
    maxIterations: input.maxIterations,
    answerStopRuleTriggered: input.answerStopRuleTriggered,
    taskModelInvoked: input.taskModelInvoked,
    selectedActionType: input.nextAction?.type ?? null,
    selectedToolId:
      input.nextAction?.type === "use_tool" ? input.nextAction.toolId : null,
    reason: input.nextAction?.reason ?? null,
    parseErrorReason: input.parseErrorReason,
    parseWarnings: input.parseWarnings,
    repeatedToolGuardTriggered: input.repeatedActionGuard?.triggered ?? false,
    repeatedToolGuardReason: input.repeatedActionGuard?.reason,
    guardedActionType: input.repeatedActionGuard?.guardedActionType,
    guardedToolId: input.repeatedActionGuard?.guardedToolId,
    guardedArgsHash: input.repeatedActionGuard?.guardedArgsHash,
    guardedQuery: input.repeatedActionGuard?.guardedQuery,
    matchedEvidenceIndex: input.repeatedActionGuard?.matchedEvidenceIndex,
    matchedToolCallId: input.repeatedActionGuard?.matchedToolCallId,
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
  const plannerEvidence = getEvidencePayload(state);
  const observationContext = buildPlannerObservationContext(state);
  const latestEvidenceSummary = observationContext.latestEvidenceSummary;
  const taskCoverageView = observationContext.taskCoverageView;
  const coverageState = reduceAgentCoverageState({
    question,
    currentTaskFrame: state.currentTaskFrame,
    evidence: plannerEvidence,
    latestSummary: latestEvidenceSummary,
  });
  const answerStopDecision = getPlannerAnswerStopDecision({
    latestSummary: latestEvidenceSummary,
    pendingApproval: observationContext.pendingApproval,
    errorMessage: state.errorMessage,
    question,
    currentTaskFrame: state.currentTaskFrame,
    evidence: plannerEvidence,
  });

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
      answerStopRuleTriggered: answerStopDecision.shouldAnswer,
      answerStopRuleReason: answerStopDecision.reason,
      schemaReplanAttemptCount: observationContext.recovery.attemptCount,
      schemaReplanError: observationContext.recovery.schemaError ?? null,
    },
  });

  let nextAction: AgentNextAction | undefined;
  let rawOutput = "";
  let sanitizedOutput = "";
  let parseErrorReason: string | undefined;
  let parseWarnings: string[] | undefined;
  let repeatedActionGuard: AgentRepeatedActionGuardResult | undefined;
  let localIntentGuardTriggered = false;
  let localIntentGuardReason: string | undefined;
  let coverageTransitionReason: string | undefined;
  const pendingApprovalActive = Boolean(observationContext.pendingApproval);
  const recoveryExhausted =
    observationContext.recovery.source !== "none" &&
    observationContext.recovery.exhausted;
  const taskModelInvoked =
    !answerStopDecision.shouldAnswer &&
    !pendingApprovalActive &&
    !recoveryExhausted &&
    !(maxIterations > 0 && iteration >= maxIterations);

  if (answerStopDecision.shouldAnswer) {
    nextAction = {
      type: "answer",
      reason: answerStopDecision.reason,
    };
  } else if (pendingApprovalActive) {
    nextAction = undefined;
  } else if (recoveryExhausted) {
    nextAction = getRecoveryExhaustedPlannerConclusion(observationContext);
  } else if (maxIterations > 0 && iteration >= maxIterations) {
    nextAction = toNextActionFallback(
      "Planner reached the iteration limit and must stop.",
    );
  } else {
    const coverageTransitionDecision = getCoverageTransitionDecision({
      question,
      coverageState,
      toolExposure,
      recovery: observationContext.recovery,
      latestObservation: observationContext.latestObservation,
      pendingApproval: observationContext.pendingApproval,
      iteration,
      maxIterations,
    });
    coverageTransitionReason = coverageTransitionDecision.reason;

    const listToOpenBridgeAction = getReadOpenBridgeActionFromListEvidence({
      question,
      toolExposure,
      evidence: plannerEvidence,
    });
    const locateToOpenBridgeAction = getReadOpenBridgeActionFromLocateEvidence({
      question,
      toolExposure,
      evidence: plannerEvidence,
    });

    if (coverageTransitionDecision.nextAction) {
      nextAction = coverageTransitionDecision.nextAction;
    } else if (listToOpenBridgeAction) {
      nextAction = listToOpenBridgeAction;
    } else if (locateToOpenBridgeAction) {
      nextAction = locateToOpenBridgeAction;
    } else {
      const messages: NormalizedChatMessage[] = buildNextActionPlannerMessages({
        question,
        plan: state.plan,
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

        const localIntentGuardAction = getWorkspaceLocalIntentGuardAction({
          question,
          nextAction,
          toolExposure,
          workspaceRoot: state.workspaceRoot,
          knowledgeBaseId: state.knowledgeBaseId,
        });
        if (localIntentGuardAction?.guarded) {
          nextAction = localIntentGuardAction.nextAction;
          localIntentGuardTriggered = true;
          localIntentGuardReason = localIntentGuardAction.reason;
        }

        repeatedActionGuard = getPlannerRepeatedActionGuardResult({
          evidence: plannerEvidence,
          nextAction,
        });
        if (repeatedActionGuard.triggered) {
          nextAction = {
            type: "answer",
            reason:
              repeatedActionGuard.reason ??
              "Repeated action guard blocked a duplicate action and will answer from existing evidence.",
          };
        }

        if (nextAction?.type === "answer") {
          const taskCompletionDecision = getTaskCompletionDecision({
            question,
            currentTaskFrame: state.currentTaskFrame,
            evidence: plannerEvidence,
            latestSummary: latestEvidenceSummary,
          });
          if (!taskCompletionDecision.taskCompleted) {
            const completionReplanMessages = buildAnswerCompletionReplanMessages({
              question,
              plan: state.plan,
              observationContext,
              toolExposure,
              iteration,
              maxIterations,
              blockedAnswerReason: taskCompletionDecision.reason,
              previousAnswerReason: nextAction.reason,
            });
            const completionReplanDecision = await resolvePlannerModelAction(
              completionReplanMessages,
            );
            nextAction = completionReplanDecision.action;
            rawOutput = completionReplanDecision.rawOutput;
            sanitizedOutput = completionReplanDecision.sanitizedOutput;
            parseErrorReason = completionReplanDecision.parseErrorReason;
            parseWarnings = completionReplanDecision.parseWarnings;

            if (nextAction?.type === "answer") {
              nextAction = toNextActionFallback(
                `Planner proposed answer again after completion check blocked it: ${taskCompletionDecision.reason}`,
              );
            }
          }
        }
      } catch (error) {
        nextAction = toNextActionFallback(
          error instanceof Error && error.message.trim()
            ? `Planner task model call failed: ${error.message.trim()}`
            : NEXT_ACTION_PLANNER_FALLBACK_REASON,
        );
      }
    }
  }

  logPlannerDecisionDebug({
    runId: state.runId,
    threadId: state.threadId,
    iteration,
    maxIterations,
    answerStopRuleTriggered: answerStopDecision.shouldAnswer,
    taskModelInvoked,
    nextAction,
    rawOutput,
    sanitizedOutput,
    parseErrorReason,
    parseWarnings,
    repeatedActionGuard,
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
      answerStopRuleTriggered: answerStopDecision.shouldAnswer,
      answerStopRuleReason: answerStopDecision.reason,
      coverageTransitionReason: coverageTransitionReason ?? null,
      rawOutputPreview: rawOutput ? toPreview(rawOutput) : undefined,
      sanitizedOutputPreview: sanitizedOutput ? toPreview(sanitizedOutput) : undefined,
      parseErrorReason,
      parseWarnings,
      repeatedToolGuardTriggered: repeatedActionGuard?.triggered ?? false,
      repeatedToolGuardReason: repeatedActionGuard?.reason,
      guardedActionType: repeatedActionGuard?.guardedActionType,
      guardedToolId: repeatedActionGuard?.guardedToolId ?? null,
      guardedArgsHash: repeatedActionGuard?.guardedArgsHash,
      guardedQuery: repeatedActionGuard?.guardedQuery,
      matchedEvidenceIndex: repeatedActionGuard?.matchedEvidenceIndex,
      matchedToolCallId: repeatedActionGuard?.matchedToolCallId,
      localIntentGuardTriggered,
      localIntentGuardReason: localIntentGuardReason ?? null,
      schemaReplanAttemptCount: observationContext.recovery.attemptCount,
      schemaReplanError: observationContext.recovery.schemaError ?? null,
      pendingApprovalActive,
      recoveryExhausted,
      allowedActionTypes: [...ALLOWED_ACTION_TYPES],
      localIntentLegacyGuardReason: LOCAL_INTENT_GUARD_REASON,
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
