import { getLatestEvidenceSummary } from "@/agent/evidence";
import type {
  AgentNodeState,
  EmitAgentExecutionNode,
} from "@/agent/node-runtime";
import { emitStepNode } from "@/agent/node-runtime";
import { evidenceNode as baseEvidenceNode } from "@/agent/nodes/evidence";
import { prepareContextNode as basePrepareContextNode } from "@/agent/nodes/prepare-context";
import { getLatestUserQuestion } from "@/agent/nodes/shared";
import { nextActionPlannerNode as baseNextActionPlannerNode } from "@/agent/planner/node";
import type {
  AgentToolExposureState,
  CurrentTaskFrame,
} from "@/agent/types";
import {
  ensureSkillResolvedForRun,
  getActiveSkillRuntimeFrameForRun,
  getLatestSkillRuntimeFrameForRun,
  reduceSkillAfterAcceptedEvidence,
} from "./runtime";
import type { SkillRuntimeFrame } from "./types";

const SKILL_MARKER_PREFIX = "skill-runtime:";
const SKILL_CRITERION_PREFIX = "[Skill:";
const SKILL_REMAINING_PREFIX = "Active Skill:";

/**
 * Base Harness exposure before Skill narrowing. It is run-scoped and rebuilt on
 * every prepareContext (including approval resume), so it never becomes a
 * second durable source of tool truth.
 */
const baseToolExposureByRunId = new Map<string, AgentToolExposureState>();

const unique = (values: string[]) =>
  values.filter((value, index, items) => value && items.indexOf(value) === index);

export const filterToolExposureForSkill = (
  toolExposure: AgentToolExposureState,
  frame: SkillRuntimeFrame | undefined,
): AgentToolExposureState => {
  if (!frame) {
    return toolExposure;
  }
  const allowed = new Set(frame.allowedToolIds);
  return {
    exposedTools: toolExposure.exposedTools.filter((toolId) => allowed.has(toolId)),
    toolMeta: toolExposure.toolMeta.filter((tool) => allowed.has(tool.toolId)),
  };
};

const stripSkillTaskFrameDecorations = (
  frame: CurrentTaskFrame | undefined,
): CurrentTaskFrame | undefined => {
  if (!frame) {
    return frame;
  }
  return {
    ...frame,
    confirmedObjects: frame.confirmedObjects.filter(
      (item) => !item.id?.startsWith(SKILL_MARKER_PREFIX),
    ),
    completionCriteria: frame.completionCriteria.filter(
      (item) => !item.startsWith(SKILL_CRITERION_PREFIX),
    ),
    remainingWork: frame.remainingWork?.filter(
      (item) => !item.startsWith(SKILL_REMAINING_PREFIX),
    ),
  };
};

export const decorateTaskFrameWithSkill = (
  frame: CurrentTaskFrame | undefined,
  skill: SkillRuntimeFrame | undefined,
): CurrentTaskFrame | undefined => {
  const clean = stripSkillTaskFrameDecorations(frame);
  if (!clean || !skill) {
    return clean;
  }

  const marker = {
    skillId: skill.skillId,
    version: skill.skillVersion,
    instanceId: skill.skillInstanceId,
    status: skill.status,
    stage: skill.stage ?? null,
    semanticContext: skill.semanticContext,
    qualityCriteria: skill.qualityCriteria,
  };

  return {
    ...clean,
    confirmedObjects: [
      ...clean.confirmedObjects,
      {
        type: "knowledge",
        id: `${SKILL_MARKER_PREFIX}${skill.skillInstanceId}`,
        label: JSON.stringify(marker),
        confidence: 1,
      },
    ],
    completionCriteria: unique([
      ...clean.completionCriteria,
      ...skill.completionCriteria.map(
        (criterion) => `[Skill:${skill.skillId}] ${criterion}`,
      ),
    ]),
    remainingWork: unique([
      ...(clean.remainingWork ?? []),
      `${SKILL_REMAINING_PREFIX} ${skill.name} (${skill.status}${
        skill.stage ? ` / ${skill.stage}` : ""
      })`,
    ]),
  };
};

export const skillAwarePrepareContextNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  await ensureSkillResolvedForRun({
    runId: state.runId,
    goalText: state.goal.text,
    latestUserText: getLatestUserQuestion(state.messages),
    params: state.params,
    currentTaskFrame: state.currentTaskFrame,
  });

  const patch = await basePrepareContextNode(state, emit);
  const skillFrame = getActiveSkillRuntimeFrameForRun(state.runId);
  const baseExposure = patch.toolExposure ?? state.toolExposure;
  if (baseExposure) {
    baseToolExposureByRunId.set(state.runId, baseExposure);
  }
  const toolExposure = baseExposure
    ? filterToolExposureForSkill(baseExposure, skillFrame)
    : baseExposure;

  if (skillFrame) {
    await emitStepNode(emit, {
      runId: state.runId,
      nodeId: "agent-skill-runtime",
      nodeType: "reason",
      phase: "done",
      label: "加载技能",
      summary: `已加载 Skill：${skillFrame.name}`,
      details: {
        skillId: skillFrame.skillId,
        skillVersion: skillFrame.skillVersion,
        skillInstanceId: skillFrame.skillInstanceId,
        skillStatus: skillFrame.status,
        skillStage: skillFrame.stage ?? null,
        allowedToolIds: skillFrame.allowedToolIds,
        exposedToolIds: toolExposure?.exposedTools ?? [],
      },
    });
  }

  return {
    ...patch,
    toolExposure,
  };
};

export const skillAwareNextActionPlannerNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  const skillFrame = getLatestSkillRuntimeFrameForRun(state.runId);
  if (!skillFrame) {
    return baseNextActionPlannerNode(state, emit);
  }

  const plannerState: AgentNodeState = {
    ...state,
    currentTaskFrame: decorateTaskFrameWithSkill(state.currentTaskFrame, skillFrame),
  };
  const patch = await baseNextActionPlannerNode(plannerState, emit);

  return {
    ...patch,
    currentTaskFrame: stripSkillTaskFrameDecorations(
      patch.currentTaskFrame ?? state.currentTaskFrame,
    ),
  };
};

export const skillAwareEvidenceNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  const hadPendingEvidence = Boolean(
    state.pendingEvidenceObservation ||
      state.pendingToolExecution ||
      state.pendingRetrievalEvidence,
  );
  const patch = await baseEvidenceNode(state, emit);

  if (!hadPendingEvidence || !getActiveSkillRuntimeFrameForRun(state.runId)) {
    return patch;
  }

  const acceptedState: AgentNodeState = {
    ...state,
    ...patch,
  };
  const evidence = acceptedState.evidence;
  const updated = await reduceSkillAfterAcceptedEvidence({
    runId: state.runId,
    evidence: {
      evidence,
      latestEvidenceSummary: getLatestEvidenceSummary({ evidence }),
      latestToolExecution: evidence?.toolExecutions.at(-1),
    },
  });
  const skillFrame = getLatestSkillRuntimeFrameForRun(state.runId);
  const activeFrame = getActiveSkillRuntimeFrameForRun(state.runId);
  const baseExposure = baseToolExposureByRunId.get(state.runId);
  const toolExposure = baseExposure
    ? filterToolExposureForSkill(baseExposure, activeFrame)
    : patch.toolExposure;

  if (updated && skillFrame) {
    await emitStepNode(emit, {
      runId: state.runId,
      nodeId: "agent-skill-runtime",
      nodeType: "reason",
      phase: "done",
      label: "推进技能",
      summary: `Skill 状态已更新：${skillFrame.name}`,
      details: {
        skillId: skillFrame.skillId,
        skillVersion: skillFrame.skillVersion,
        skillInstanceId: skillFrame.skillInstanceId,
        skillStatus: skillFrame.status,
        skillStage: skillFrame.stage ?? null,
        checkpointSequence: updated.checkpoint.sequence,
        allowedToolIds: activeFrame?.allowedToolIds ?? [],
        exposedToolIds: toolExposure?.exposedTools ?? [],
        error: updated.error ?? null,
      },
    });
  }

  return {
    ...patch,
    toolExposure,
  };
};

export const clearSkillAgentIntegrationForTests = () => {
  baseToolExposureByRunId.clear();
};
