import type { AgentEvidencePayload } from "@/agent/types";
import { getLatestUserQuestion } from "@/agent/nodes/shared";
import { skillRegistry } from "./registry";
import { skillInstanceStore } from "./store";
import type {
  SkillEvidenceDelta,
  SkillInstance,
  SkillRegistration,
  SkillRuntimeFrame,
} from "./types";

const buildEvidenceDelta = (
  instance: SkillInstance,
  evidence: AgentEvidencePayload | undefined,
): SkillEvidenceDelta | undefined => {
  if (!evidence) {
    return undefined;
  }

  const observations = evidence.observations.slice(
    instance.evidenceCursor.observations,
  );
  const toolExecutions = evidence.toolExecutions.slice(
    instance.evidenceCursor.toolExecutions,
  );
  const retrievals = evidence.retrievals.slice(
    instance.evidenceCursor.retrievals,
  );

  if (
    observations.length === 0 &&
    toolExecutions.length === 0 &&
    retrievals.length === 0
  ) {
    return undefined;
  }

  return {
    observations,
    toolExecutions,
    retrievals,
    latestSummary: evidence.latestSummary,
  };
};

const toRuntimeFrame = (
  registration: SkillRegistration,
  instance: SkillInstance,
): SkillRuntimeFrame => {
  const frame = registration.adapter.getRuntimeFrame({
    instance,
    definition: registration.definition,
  });

  return {
    skillId: registration.definition.id,
    skillVersion: registration.definition.version,
    skillInstanceId: instance.id,
    ...frame,
    allowedToolIds: frame.allowedToolIds.filter((toolId) =>
      registration.definition.allowedToolIds.includes(toolId),
    ),
  };
};

const buildSkillInput = (input: {
  goalText: string;
  latestUserQuestion?: string;
  params?: Record<string, unknown>;
}) => ({
  goalText: input.goalText,
  latestUserQuestion: input.latestUserQuestion,
  params: input.params,
});

export const resolveSkillRuntime = (input: {
  runId: string;
  threadId: string;
  userId: number;
  goalText: string;
  messages?: Parameters<typeof getLatestUserQuestion>[0];
  params?: Record<string, unknown>;
}) => {
  const existing = skillInstanceStore.getByRunId(input.runId);
  if (existing) {
    const registration = skillRegistry.get(
      existing.skillId,
      existing.skillVersion,
    );
    if (!registration || existing.status === "cancelled") {
      return undefined;
    }
    return {
      instance: existing,
      registration,
      frame: toRuntimeFrame(registration, existing),
    };
  }

  const latestUserQuestion = getLatestUserQuestion(input.messages ?? []);
  const registration = skillRegistry.resolve({
    goalText: input.goalText,
    latestUserQuestion,
    params: input.params,
  });
  if (!registration) {
    return undefined;
  }

  const skillInput = buildSkillInput({
    goalText: input.goalText,
    latestUserQuestion,
    params: input.params,
  });
  const state = registration.adapter.initialize(skillInput);
  const instance = skillInstanceStore.create({
    runId: input.runId,
    threadId: input.threadId,
    userId: input.userId,
    skillId: registration.definition.id,
    skillVersion: registration.definition.version,
    input: skillInput,
    state,
  });
  const running = skillInstanceStore.update(instance.id, {
    status: "running",
  });

  return {
    instance: running,
    registration,
    frame: toRuntimeFrame(registration, running),
  };
};

export const reduceActiveSkillFromEvidence = (input: {
  runId: string;
  evidence?: AgentEvidencePayload;
}) => {
  const instance = skillInstanceStore.getByRunId(input.runId);
  if (!instance || instance.status === "cancelled" || instance.status === "failed") {
    return undefined;
  }

  const registration = skillRegistry.get(
    instance.skillId,
    instance.skillVersion,
  );
  if (!registration) {
    return skillInstanceStore.update(instance.id, {
      status: "failed",
      error: `Skill definition not found: ${instance.skillId}@${instance.skillVersion}`,
    });
  }

  const delta = buildEvidenceDelta(instance, input.evidence);
  if (!delta) {
    return instance;
  }

  const state = registration.adapter.reduceEvidence({
    state: instance.state,
    evidence: delta,
    instance,
    definition: registration.definition,
  });
  const evaluation = registration.adapter.evaluate({
    state,
    instance,
    definition: registration.definition,
  });

  const evidenceCursor = {
    observations: input.evidence?.observations.length ?? 0,
    toolExecutions: input.evidence?.toolExecutions.length ?? 0,
    retrievals: input.evidence?.retrievals.length ?? 0,
  };

  switch (evaluation.status) {
    case "completed":
      return skillInstanceStore.update(instance.id, {
        state,
        status: "completed",
        output: evaluation.output,
        evidenceCursor,
      });
    case "waiting":
      return skillInstanceStore.update(instance.id, {
        state,
        status: "waiting",
        error: evaluation.reason,
        evidenceCursor,
      });
    case "failed":
      return skillInstanceStore.update(instance.id, {
        state,
        status: "failed",
        error: evaluation.reason,
        evidenceCursor,
      });
    case "running":
    default:
      return skillInstanceStore.update(instance.id, {
        state,
        status: "running",
        error: undefined,
        evidenceCursor,
      });
  }
};

export const getActiveSkillRuntimeFrame = (runId: string) => {
  const instance = skillInstanceStore.getByRunId(runId);
  if (!instance || instance.status === "cancelled" || instance.status === "failed") {
    return undefined;
  }
  const registration = skillRegistry.get(instance.skillId, instance.skillVersion);
  return registration ? toRuntimeFrame(registration, instance) : undefined;
};

export const cancelSkillInstance = (runId: string) => {
  const instance = skillInstanceStore.getByRunId(runId);
  return instance
    ? skillInstanceStore.update(instance.id, { status: "cancelled" })
    : undefined;
};
