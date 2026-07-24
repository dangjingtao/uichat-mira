import {
  readSkillDeliveryFromRequestContext,
  readSkillDirectiveFromRequestContext,
} from "@/skills/flow/context.js";
import {
  nextActionPlannerNode as baseNextActionPlannerNode,
  parseNextActionPlannerOutput,
} from "../planner/index";
import {
  emitStepNode,
  getTraceAttemptMeta,
  updateCurrentTaskFrameFromPlanner,
  type AgentNodeState,
  type EmitAgentExecutionNode,
} from "../node-runtime";
import type { AgentFinalizationPacket, AgentNextAction } from "../types";

const runFrozenParentFinalizationPath = (
  state: AgentNodeState,
): Partial<AgentNodeState> | null => {
  if (state.nextAction?.type !== "answer" || !state.finalizationPacket) {
    return null;
  }

  // A completed forked Skill Agent has already transferred task-local execution
  // back to the Parent as a frozen finalization decision. Do not invoke Main
  // Planner again and accidentally reconstruct the deliverable a second time.
  return {
    nextAction: state.nextAction,
    finalizationPacket: state.finalizationPacket,
    schemaReplanDiagnostics: undefined,
  };
};

const runSkillDirectivePlannerPath = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState> | null> => {
  const directive = readSkillDirectiveFromRequestContext(
    state.requestContextMessages,
  );
  if (!directive) return null;

  let nextAction: AgentNextAction | undefined;
  let finalizationPacket: AgentFinalizationPacket | undefined;

  if (
    !directive.flowCompleted &&
    directive.requiredAction === "ask_user" &&
    directive.question?.trim()
  ) {
    nextAction = {
      type: "ask_user",
      question: directive.question.trim(),
      reason: `Active Skill ${directive.skillId} is still ${directive.phase}; continue the domain flow with the Skill-provided question.`,
    };
  } else if (
    directive.flowCompleted &&
    directive.phase === "ready" &&
    readSkillDeliveryFromRequestContext(state.requestContextMessages)
  ) {
    finalizationPacket = {
      type: "answer",
      reason: `Active Skill ${directive.skillId} completed its domain flow and prepared the requested deliverable.`,
      completionProof: [
        {
          criterion: `Complete ${directive.skillId} domain flow and deliver its prepared report.`,
          evidenceRefs: [],
        },
      ],
      unresolvedGaps: [],
    };
    nextAction = finalizationPacket;
  } else {
    return null;
  }

  const traceAttemptMeta = getTraceAttemptMeta(
    "agent-next-action-planner",
    state,
  );
  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-next-action-planner",
    ...traceAttemptMeta,
    nodeType: "plan",
    phase: "start",
    label: "下一步动作决策",
    summary: "正在执行 Active Skill 提供的流程指令",
    details: {
      skillDirective: {
        skillId: directive.skillId,
        phase: directive.phase,
        flowCompleted: directive.flowCompleted,
        round: directive.round ?? null,
        maxRounds: directive.maxRounds ?? null,
        requiredAction: directive.requiredAction ?? null,
        nextIntent: directive.next?.intent ?? null,
        targetSkillId: directive.next?.targetSkillId ?? null,
      },
      taskModelInvoked: false,
    },
  });

  const currentTaskFrame = updateCurrentTaskFrameFromPlanner({
    frame: state.currentTaskFrame,
    goal: state.goal,
    nextAction,
    latestQuestion:
      [...state.messages].reverse().find((message) => message.role === "user")
        ?.content ?? state.goal.text,
    latestEvidenceSummary: state.evidence?.latestSummary,
  });

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-next-action-planner",
    ...traceAttemptMeta,
    nodeType: "plan",
    phase: "done",
    label: "下一步动作决策",
    summary:
      nextAction.type === "ask_user"
        ? "Active Skill 流程未完成，继续询问下一项高价值信息"
        : "Active Skill 流程已完成，交付已生成报告",
    details: {
      selectedActionType: nextAction.type,
      selectedToolId: null,
      reason: nextAction.reason,
      plannerThought: nextAction.reason,
      plannerThoughtStreaming: false,
      taskModelInvoked: false,
      skillDirectiveHandled: true,
      skillId: directive.skillId,
      skillPhase: directive.phase,
      skillFlowCompleted: directive.flowCompleted,
      finalizationEvidenceRefs:
        finalizationPacket?.completionProof.flatMap((proof) => proof.evidenceRefs) ?? [],
    },
  });

  return {
    nextAction,
    ...(finalizationPacket ? { finalizationPacket } : {}),
    ...(currentTaskFrame ? { currentTaskFrame } : {}),
    schemaReplanDiagnostics: undefined,
  };
};

export const nextActionPlannerNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  const frozenFinalization = runFrozenParentFinalizationPath(state);
  if (frozenFinalization) return frozenFinalization;

  const skillDirectiveResult = await runSkillDirectivePlannerPath(state, emit);
  if (skillDirectiveResult) return skillDirectiveResult;
  return baseNextActionPlannerNode(state, emit);
};

export { parseNextActionPlannerOutput };
