import { getLatestEvidenceSummary } from "@/agent/evidence";
import type {
  AgentNodeState,
  EmitAgentExecutionNode,
} from "@/agent/node-runtime";
import { emitStepNode } from "@/agent/node-runtime";
import { evidenceNode as baseEvidenceNode } from "@/agent/nodes/evidence";
import { harnessAwareToolNode as baseHarnessAwareToolNode } from "@/agent/nodes/harness-tool-result";
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
  getSkillTraceMetadataForRun,
  reduceSkillAfterAcceptedEvidence,
} from "./runtime";
import type { SkillRuntimeFrame } from "./types";

const SKILL_MARKER_PREFIX = "skill-runtime:";
const SKILL_CRITERION_PREFIX = "[Skill:";
const SKILL_REMAINING_PREFIX = "Active Skill:";

type AgentNodeStateWithToolExposureConstraint = AgentNodeState & {
  toolExposureAllowlist?: string[];
};

const unique = (values: string[]) =>
  values.filter((value, index, items) => value && items.indexOf(value) === index);

/**
 * Defense-in-depth intersection for already-built exposure values. The primary
 * constraint is applied inside Harness candidate resolution before ranking.
 */
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
  const skillStillActive = skill.status === "running" || skill.status === "waiting";

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
    remainingWork: skillStillActive
      ? unique([
          ...(clean.remainingWork ?? []),
          `${SKILL_REMAINING_PREFIX} ${skill.name} (${skill.status}${
            skill.stage ? ` / ${skill.stage}` : ""
          })`,
        ])
      : clean.remainingWork,
  };
};

const prepareHarnessExposureForSkill = async (
  state: AgentNodeState,
  frame: SkillRuntimeFrame | undefined,
  emit?: EmitAgentExecutionNode,
) => {
  const constrainedState: AgentNodeStateWithToolExposureConstraint = {
    ...state,
    toolExposureAllowlist: frame?.allowedToolIds,
  };
  const patch = await basePrepareContextNode(constrainedState, emit);
  return {
    ...patch,
    toolExposure: patch.toolExposure
      ? filterToolExposureForSkill(patch.toolExposure, frame)
      : patch.toolExposure,
  };
};

const createSkillTraceEmitter = (
  runId: string,
  emit?: EmitAgentExecutionNode,
): EmitAgentExecutionNode | undefined => {
  if (!emit) {
    return undefined;
  }
  return async (event) => {
    const skillMeta = getSkillTraceMetadataForRun(runId);
    await emit({
      ...event,
      ...(skillMeta
        ? {
            details: {
              ...(event.details ?? {}),
              ...skillMeta,
            },
          }
        : {}),
    });
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

  const skillFrame = getActiveSkillRuntimeFrameForRun(state.runId);
  const patch = await prepareHarnessExposureForSkill(state, skillFrame, emit);

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
        exposedToolIds: patch.toolExposure?.exposedTools ?? [],
      },
    });
  }

  return patch;
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

export const skillAwareToolNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> =>
  baseHarnessAwareToolNode(state, createSkillTraceEmitter(state.runId, emit));

export const skillAwareEvidenceNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  const hadPendingEvidence = Boolean(
    state.pendingEvidenceObservation ||
      state.pendingToolExecution ||
      state.pendingRetrievalEvidence,
  );
  const evidencePatch = await baseEvidenceNode(state, emit);

  if (!hadPendingEvidence || !getActiveSkillRuntimeFrameForRun(state.runId)) {
    return evidencePatch;
  }

  const acceptedState: AgentNodeState = {
    ...state,
    ...evidencePatch,
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
  const latestFrame = getLatestSkillRuntimeFrameForRun(state.runId);
  const activeFrame = getActiveSkillRuntimeFrameForRun(state.runId);

  // A Skill stage may change its legal tool set after every accepted Evidence.
  // Re-enter the same Harness exposure construction path with the new runtime
  // constraint instead of maintaining a second Skill-owned tool list for Planner.
  // When the Skill reaches a terminal state, activeFrame is undefined and this
  // rebuild restores the normal parent-Agent Harness exposure.
  const exposurePatch = await prepareHarnessExposureForSkill(
    acceptedState,
    activeFrame,
    undefined,
  );

  if (updated && latestFrame) {
    await emitStepNode(emit, {
      runId: state.runId,
      nodeId: "agent-skill-runtime",
      nodeType: "reason",
      phase: "done",
      label: "推进技能",
      summary: `Skill 状态已更新：${latestFrame.name}`,
      details: {
        skillId: latestFrame.skillId,
        skillVersion: latestFrame.skillVersion,
        skillInstanceId: latestFrame.skillInstanceId,
        skillStatus: latestFrame.status,
        skillStage: latestFrame.stage ?? null,
        checkpointSequence: updated.checkpoint.sequence,
        allowedToolIds: activeFrame?.allowedToolIds ?? [],
        exposedToolIds: exposurePatch.toolExposure?.exposedTools ?? [],
        error: updated.error ?? null,
      },
    });
  }

  return {
    ...evidencePatch,
    toolIntent: exposurePatch.toolIntent,
    toolExposure: exposurePatch.toolExposure,
  };
};
