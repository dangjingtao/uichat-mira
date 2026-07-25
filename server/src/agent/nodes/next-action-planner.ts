import {
  readSkillDeliveryFromRequestContext,
  readSkillDirectiveFromRequestContext,
} from "@/skills/flow/context.js";
import type { SkillRequirement } from "@/skills/flow/types.js";
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

const runFrozenParentDecisionPath = (
  state: AgentNodeState,
): Partial<AgentNodeState> | null => {
  if (state.nextAction?.type === "ask_user") {
    // A forked Skill Agent may hand back a governed needs_input boundary. The
    // Parent owns the user interaction, but Main Planner must not reinterpret
    // the missing-information decision or take construction ownership back.
    return {
      nextAction: state.nextAction,
      schemaReplanDiagnostics: undefined,
    };
  }

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

const stripSentenceEnding = (value: string) =>
  value.trim().replace(/[。！？!?]+$/u, "");

const toParentRequirementClause = (requirement: SkillRequirement) => {
  const description = stripSentenceEnding(requirement.description);
  if (!description) return "";

  if (/^需要用户确认/u.test(description)) {
    return description.replace(/^需要用户确认/u, "请确认");
  }
  if (/^还缺少/u.test(description)) {
    return description.replace(/^还缺少/u, "请补充");
  }
  if (/^缺少/u.test(description)) {
    return description.replace(/^缺少/u, "请补充");
  }
  return description;
};

const buildStructuredRequirementQuestion = (
  requirements: SkillRequirement[] | undefined,
): string | null => {
  const userInputRequirements = (requirements ?? [])
    .filter(
      (requirement) =>
        requirement.kind === "user_input" && requirement.description.trim(),
    )
    .slice(0, 3);
  if (userInputRequirements.length === 0) return null;

  const clauses = userInputRequirements
    .map(toParentRequirementClause)
    .filter(Boolean);
  if (clauses.length === 0) return null;

  const allowsExplicitNoMore = userInputRequirements.some((requirement) =>
    requirement.acceptedFormats?.includes("explicit_no_more_information"),
  );
  const guidance = allowsExplicitNoMore
    ? "如果没有补充，直接明确告诉我没有即可。"
    : "按你方便的方式说就好，不确定或不知道的部分可以直接说明。";

  if (clauses.length === 1) {
    return `${clauses[0]}。${guidance}`;
  }

  return `为了继续完成当前任务，请补充以下信息：\n${clauses
    .map((clause, index) => `${index + 1}. ${clause}`)
    .join("\n")}\n${guidance}`;
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
  const structuredRequirementQuestion = !directive.flowCompleted
    ? buildStructuredRequirementQuestion(directive.interruption?.requirements)
    : null;

  if (structuredRequirementQuestion) {
    nextAction = {
      type: "ask_user",
      question: structuredRequirementQuestion,
      reason: `Active Skill ${directive.skillId} is interrupted by structured user-input requirements; Parent must collect the missing information before the domain flow may continue.`,
    };
  } else if (
    !directive.flowCompleted &&
    directive.requiredAction === "ask_user" &&
    directive.question?.trim()
  ) {
    // Read-only compatibility for persisted sessions created before structured
    // interruptions replaced Skill-authored user questions.
    nextAction = {
      type: "ask_user",
      question: directive.question.trim(),
      reason: `Active Skill ${directive.skillId} is still ${directive.phase}; continue the domain flow with the persisted compatibility question.`,
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
        interruptionReason: directive.interruption?.reason ?? null,
        requirementIds:
          directive.interruption?.requirements.map((requirement) => requirement.id) ?? [],
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
        ? "Active Skill 流程未完成，由 Parent 继续询问下一项高价值信息"
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
      skillInterruptionReason: directive.interruption?.reason ?? null,
      skillRequirementCount: directive.interruption?.requirements.length ?? 0,
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
  const frozenParentDecision = runFrozenParentDecisionPath(state);
  if (frozenParentDecision) return frozenParentDecision;

  const skillDirectiveResult = await runSkillDirectivePlannerPath(state, emit);
  if (skillDirectiveResult) return skillDirectiveResult;
  return baseNextActionPlannerNode(state, emit);
};

export { parseNextActionPlannerOutput };
