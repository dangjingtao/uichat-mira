import { providerProxyService } from "@/services/provider-proxy.service/index";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol";
import { writeStructuredLog } from "@/logger";
import { getEvidencePayload } from "../evidence";
import type { AgentNextAction, AgentRepeatedActionGuardResult } from "../types";
import {
  buildPlannerObservationContext,
  emitStepNode,
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
import { buildNextActionPlannerMessages, normalizeToolExposure } from "./prompt";
import { getPlannerRepeatedActionGuardResult } from "./repeated-action-guard";
import { validateNextAction } from "./validate";

const logPlannerDecisionDebug = (input: {
  runId: string;
  threadId: string;
  iteration: number;
  maxIterations: number;
  answerStopRuleTriggered: boolean;
  taskModelInvoked: boolean;
  nextAction: AgentNextAction;
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
    selectedActionType: input.nextAction.type,
    selectedToolId: input.nextAction.type === "use_tool" ? input.nextAction.toolId : null,
    reason: input.nextAction.reason,
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
  const answerStopDecision = getPlannerAnswerStopDecision({
    latestSummary: latestEvidenceSummary,
    pendingApproval: observationContext.pendingApproval,
    errorMessage: state.errorMessage,
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
      answerStopRuleTriggered: answerStopDecision.shouldAnswer,
      answerStopRuleReason: answerStopDecision.reason,
      schemaReplanAttemptCount: observationContext.recovery.attemptCount,
      schemaReplanError: observationContext.recovery.schemaError ?? null,
    },
  });

  let nextAction: AgentNextAction;
  let rawOutput = "";
  let sanitizedOutput = "";
  let parseErrorReason: string | undefined;
  let parseWarnings: string[] | undefined;
  let repeatedActionGuard: AgentRepeatedActionGuardResult | undefined;
  let localIntentGuardTriggered = false;
  let localIntentGuardReason: string | undefined;
  const taskModelInvoked =
    !answerStopDecision.shouldAnswer && !(maxIterations > 0 && iteration >= maxIterations);

  if (answerStopDecision.shouldAnswer) {
    nextAction = {
      type: "answer",
      reason: answerStopDecision.reason,
    };
  } else if (maxIterations > 0 && iteration >= maxIterations) {
    nextAction = toNextActionFallback(
      "Planner reached the iteration limit and must stop.",
    );
  } else {
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

    if (listToOpenBridgeAction) {
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

      try {
        for await (const delta of providerProxyService.streamTaskChatText(messages)) {
          rawOutput += delta;
        }

        const validationResult = validateNextAction(
          parseNextActionPlannerOutputWithDiagnostics(rawOutput),
          toolExposure.exposedTools,
        );
        nextAction = validationResult.action;
        sanitizedOutput = validationResult.sanitizedOutput ?? "";
        parseErrorReason = validationResult.parseErrorReason;
        parseWarnings = validationResult.parseWarnings;

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
    summary: "已完成下一步动作决策",
    details: {
      exposedToolCount: toolExposure.exposedTools.length,
      selectedActionType: nextAction.type,
      selectedToolId: nextAction.type === "use_tool" ? nextAction.toolId : null,
      reason: nextAction.reason,
      iteration,
      maxIterations,
      latestEvidenceSummary: latestEvidenceSummary ?? null,
      answerStopRuleTriggered: answerStopDecision.shouldAnswer,
      answerStopRuleReason: answerStopDecision.reason,
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
      allowedActionTypes: [...ALLOWED_ACTION_TYPES],
      localIntentLegacyGuardReason: LOCAL_INTENT_GUARD_REASON,
    },
  });

  const plannerTaskFrame = updateCurrentTaskFrameFromPlanner({
    frame: state.currentTaskFrame,
    goal: state.goal,
    nextAction,
    latestQuestion: question,
  });

  return {
    nextAction,
    ...(plannerTaskFrame ? { currentTaskFrame: plannerTaskFrame } : {}),
    ...(nextAction.type === "error" && observationContext.recovery.schemaError
      ? {
          schemaReplanDiagnostics: {
            schemaError: observationContext.recovery.schemaError,
            toolId: observationContext.recovery.toolId,
            invalidAction: observationContext.recovery.invalidAction,
            attemptCount: observationContext.recovery.attemptCount,
          },
        }
      : {}),
    ...(nextAction.type === "error"
      ? {
          errorMessage: nextAction.reason,
          blockedReason: nextAction.reason,
          errorSourceNodeId: "agent-next-action-planner",
        }
      : {}),
  };
};
