import { agentRunStore } from "@/agent/run-store";
import {
  getSkillRegistration,
  resolveMatchingSkillRegistration,
} from "./registry";
import type {
  SkillActivationContext,
  SkillEvidenceInput,
  SkillInstance,
  SkillRegistration,
  SkillRunBinding,
  SkillRuntimeFrame,
} from "./types";

const SKILL_RUNTIME_PARAM_KEY = "__miraSkillRuntimeV1";
const inMemoryBindings = new Map<string, SkillRunBinding>();

const nowIso = () => new Date().toISOString();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isSkillInstance = (value: unknown): value is SkillInstance => {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === "string" &&
    typeof value.skillId === "string" &&
    typeof value.skillVersion === "string" &&
    typeof value.status === "string"
  );
};

const normalizePersistedBinding = (value: unknown): SkillRunBinding | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const resolvedSkillIds = Array.isArray(value.resolvedSkillIds)
    ? value.resolvedSkillIds.filter((item): item is string => typeof item === "string")
    : [];
  return {
    resolutionAttempted: value.resolutionAttempted === true,
    resolvedSkillIds,
    instance: isSkillInstance(value.instance) ? value.instance : undefined,
    lastInstance: isSkillInstance(value.lastInstance) ? value.lastInstance : undefined,
  };
};

const readPersistedBinding = (runId: string) => {
  const run = agentRunStore.get(runId);
  return normalizePersistedBinding(
    run?.runtimeInput?.params?.[SKILL_RUNTIME_PARAM_KEY],
  );
};

const getBinding = (runId: string): SkillRunBinding => {
  const inMemory = inMemoryBindings.get(runId);
  if (inMemory) {
    return inMemory;
  }
  const persisted = readPersistedBinding(runId);
  if (persisted) {
    inMemoryBindings.set(runId, persisted);
    return persisted;
  }
  const created: SkillRunBinding = {
    resolutionAttempted: false,
    resolvedSkillIds: [],
  };
  inMemoryBindings.set(runId, created);
  return created;
};

const persistBinding = (runId: string, binding: SkillRunBinding) => {
  inMemoryBindings.set(runId, binding);
  const run = agentRunStore.get(runId);
  if (!run?.runtimeInput) {
    return;
  }
  agentRunStore.update(runId, {
    runtimeInput: {
      ...run.runtimeInput,
      params: {
        ...(run.runtimeInput.params ?? {}),
        [SKILL_RUNTIME_PARAM_KEY]: binding,
      },
    },
  });
};

const getExplicitSkillRequest = (params?: Record<string, unknown>) => {
  const directSkillId = typeof params?.skillId === "string" ? params.skillId.trim() : "";
  const directVersion =
    typeof params?.skillVersion === "string" ? params.skillVersion.trim() : "";
  const nested = isRecord(params?.skill) ? params?.skill : undefined;
  const nestedSkillId = typeof nested?.id === "string" ? nested.id.trim() : "";
  const nestedVersion = typeof nested?.version === "string" ? nested.version.trim() : "";

  const skillId = directSkillId || nestedSkillId;
  if (!skillId) {
    return undefined;
  }
  return {
    skillId,
    version: directVersion || nestedVersion || undefined,
    input: nested?.input,
  };
};

const buildDefaultSkillInput = (context: SkillActivationContext) => ({
  goalText: context.goalText,
  latestUserText: context.latestUserText,
  params: context.params,
});

const intersectAllowedToolIds = (definitionIds: string[], frameIds?: string[]) => {
  if (!frameIds) {
    return [...definitionIds];
  }
  const stageAllowed = new Set(frameIds);
  return definitionIds.filter((toolId) => stageAllowed.has(toolId));
};

const buildRuntimeFrame = (
  registration: SkillRegistration,
  instance: SkillInstance,
): SkillRuntimeFrame => {
  const dynamic = registration.adapter.getRuntimeFrame(instance.state);
  const definition = registration.definition;
  const semanticContext = [
    definition.semantics.purpose,
    definition.semantics.usageGuidance,
    definition.semantics.decisionPolicy,
    dynamic.semanticContext,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    skillId: instance.skillId,
    skillVersion: instance.skillVersion,
    skillInstanceId: instance.id,
    name: definition.name,
    status: instance.status,
    stage: dynamic.stage ?? instance.stage,
    semanticContext,
    allowedToolIds:
      instance.status === "waiting"
        ? []
        : intersectAllowedToolIds(
            definition.allowedToolIds,
            dynamic.allowedToolIds,
          ),
    completionCriteria:
      dynamic.completionCriteria?.length
        ? dynamic.completionCriteria
        : definition.semantics.completionCriteria,
    qualityCriteria: definition.semantics.qualityCriteria,
  };
};

const createInstance = async (
  registration: SkillRegistration,
  context: SkillActivationContext,
  explicitInput?: unknown,
): Promise<SkillInstance> => {
  const input =
    explicitInput !== undefined
      ? explicitInput
      : registration.createInput
        ? await registration.createInput(context)
        : buildDefaultSkillInput(context);
  const state = await registration.adapter.initialize(input);
  const createdAt = nowIso();
  const draft: SkillInstance = {
    id: crypto.randomUUID(),
    skillId: registration.definition.id,
    skillVersion: registration.definition.version,
    status: "running",
    input,
    state,
    artifactRefs: [],
    checkpoint: {
      sequence: 0,
      createdAt,
    },
    createdAt,
    updatedAt: createdAt,
  };
  const frame = buildRuntimeFrame(registration, draft);
  draft.stage = frame.stage;
  return draft;
};

const selectRegistration = async (context: SkillActivationContext, binding: SkillRunBinding) => {
  const explicit = getExplicitSkillRequest(context.params);
  if (explicit) {
    return {
      registration: getSkillRegistration(explicit.skillId, explicit.version),
      explicitInput: explicit.input,
      explicitSkillId: explicit.skillId,
    };
  }

  return {
    registration: await resolveMatchingSkillRegistration(context, {
      excludedSkillIds: binding.resolvedSkillIds,
    }),
    explicitInput: undefined,
    explicitSkillId: undefined,
  };
};

export const ensureSkillResolvedForRun = async (
  context: SkillActivationContext,
): Promise<SkillInstance | undefined> => {
  const binding = getBinding(context.runId);
  if (binding.instance && ["running", "waiting"].includes(binding.instance.status)) {
    return binding.instance;
  }
  if (binding.resolutionAttempted) {
    return undefined;
  }

  const selected = await selectRegistration(context, binding);
  if (selected.explicitSkillId && !selected.registration) {
    throw new Error(`Requested Skill is not registered: ${selected.explicitSkillId}`);
  }

  if (!selected.registration) {
    persistBinding(context.runId, {
      ...binding,
      resolutionAttempted: true,
    });
    return undefined;
  }

  const instance = await createInstance(
    selected.registration,
    context,
    selected.explicitInput,
  );
  persistBinding(context.runId, {
    resolutionAttempted: true,
    resolvedSkillIds: [...new Set([...binding.resolvedSkillIds, instance.skillId])],
    instance,
    lastInstance: binding.lastInstance,
  });
  return instance;
};

export const getActiveSkillInstanceForRun = (runId: string) => {
  const instance = getBinding(runId).instance;
  return instance && ["running", "waiting"].includes(instance.status)
    ? instance
    : undefined;
};

export const getLatestSkillInstanceForRun = (runId: string) => {
  const binding = getBinding(runId);
  return binding.instance ?? binding.lastInstance;
};

export const getActiveSkillRuntimeFrameForRun = (
  runId: string,
): SkillRuntimeFrame | undefined => {
  const instance = getActiveSkillInstanceForRun(runId);
  if (!instance) {
    return undefined;
  }
  const registration = getSkillRegistration(instance.skillId, instance.skillVersion);
  if (!registration) {
    return undefined;
  }
  return buildRuntimeFrame(registration, instance);
};

export const getLatestSkillRuntimeFrameForRun = (
  runId: string,
): SkillRuntimeFrame | undefined => {
  const instance = getLatestSkillInstanceForRun(runId);
  if (!instance) {
    return undefined;
  }
  const registration = getSkillRegistration(instance.skillId, instance.skillVersion);
  if (!registration) {
    return undefined;
  }
  return buildRuntimeFrame(registration, instance);
};

const failInstance = (
  instance: SkillInstance,
  message: string,
  code?: string,
): SkillInstance => {
  const updatedAt = nowIso();
  return {
    ...instance,
    status: "failed",
    error: { message, code },
    checkpoint: {
      sequence: instance.checkpoint.sequence + 1,
      createdAt: updatedAt,
    },
    updatedAt,
  };
};

export const reduceSkillAfterAcceptedEvidence = async (input: {
  runId: string;
  evidence: SkillEvidenceInput;
}): Promise<SkillInstance | undefined> => {
  const binding = getBinding(input.runId);
  const instance = binding.instance;
  if (!instance || instance.status !== "running") {
    return instance;
  }

  const registration = getSkillRegistration(instance.skillId, instance.skillVersion);
  if (!registration) {
    const failed = failInstance(
      instance,
      `Skill definition is unavailable: ${instance.skillId}@${instance.skillVersion}`,
      "skill_definition_unavailable",
    );
    persistBinding(input.runId, {
      ...binding,
      instance: undefined,
      lastInstance: failed,
    });
    return failed;
  }

  try {
    const nextState = await registration.adapter.reduceEvidence(
      instance.state,
      input.evidence,
    );
    const evaluation = await registration.adapter.evaluate(nextState);
    const updatedAt = nowIso();
    const draft: SkillInstance = {
      ...instance,
      state: nextState,
      checkpoint: {
        sequence: instance.checkpoint.sequence + 1,
        createdAt: updatedAt,
      },
      updatedAt,
    };
    const dynamicFrame = registration.adapter.getRuntimeFrame(nextState);
    draft.stage = dynamicFrame.stage ?? draft.stage;

    switch (evaluation.status) {
      case "running":
        draft.status = "running";
        break;
      case "waiting":
        draft.status = "waiting";
        draft.error = { message: evaluation.reason, code: "skill_waiting" };
        break;
      case "completed":
        draft.status = "completed";
        draft.output = evaluation.output;
        break;
      case "failed":
        draft.status = "failed";
        draft.error = { message: evaluation.reason, code: evaluation.code };
        break;
    }

    const terminal = ["completed", "failed", "cancelled"].includes(draft.status);
    persistBinding(input.runId, {
      ...binding,
      instance: terminal ? undefined : draft,
      lastInstance: terminal ? draft : binding.lastInstance,
    });
    return draft;
  } catch (error) {
    const failed = failInstance(
      instance,
      error instanceof Error ? error.message : String(error),
      "skill_runtime_error",
    );
    persistBinding(input.runId, {
      ...binding,
      instance: undefined,
      lastInstance: failed,
    });
    return failed;
  }
};

export const cancelSkillForRun = (runId: string, reason = "Skill cancelled by caller.") => {
  const binding = getBinding(runId);
  const instance = binding.instance;
  if (!instance) {
    return binding.lastInstance;
  }
  const updatedAt = nowIso();
  const cancelled: SkillInstance = {
    ...instance,
    status: "cancelled",
    error: { message: reason, code: "skill_cancelled" },
    checkpoint: {
      sequence: instance.checkpoint.sequence + 1,
      createdAt: updatedAt,
    },
    updatedAt,
  };
  persistBinding(runId, {
    ...binding,
    instance: undefined,
    lastInstance: cancelled,
  });
  return cancelled;
};

export const resumeSkillForRun = (runId: string) => {
  const binding = getBinding(runId);
  const instance = binding.instance;
  if (!instance || instance.status !== "waiting") {
    return instance;
  }
  const updatedAt = nowIso();
  const resumed: SkillInstance = {
    ...instance,
    status: "running",
    error: undefined,
    updatedAt,
  };
  persistBinding(runId, {
    ...binding,
    instance: resumed,
  });
  return resumed;
};

export const getSkillTraceMetadataForRun = (runId: string) => {
  const frame = getLatestSkillRuntimeFrameForRun(runId);
  if (!frame) {
    return undefined;
  }
  return {
    skillId: frame.skillId,
    skillVersion: frame.skillVersion,
    skillInstanceId: frame.skillInstanceId,
    skillStage: frame.stage,
    skillStatus: frame.status,
  };
};

export const clearSkillRuntimeForTests = () => {
  inMemoryBindings.clear();
};
