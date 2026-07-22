import type {
  SkillInstance,
  SkillInstanceStore,
} from "./types";

const nowIso = () => new Date().toISOString();

type SkillInstancePersistence = {
  create?: (instance: SkillInstance) => void;
  get?: (instanceId: string) => SkillInstance | undefined;
  getByRunId?: (runId: string) => SkillInstance | undefined;
  update?: (
    instanceId: string,
    patch: Partial<Omit<SkillInstance, "id" | "createdAt">>,
  ) => void;
  clear?: () => void;
};

let skillInstancePersistence: SkillInstancePersistence | undefined;

export const configureSkillInstancePersistence = (
  persistence?: SkillInstancePersistence,
) => {
  skillInstancePersistence = persistence;
};

export class InMemorySkillInstanceStore implements SkillInstanceStore {
  private readonly instances = new Map<string, SkillInstance>();
  private readonly runIndex = new Map<string, string>();

  private cache(instance: SkillInstance) {
    this.instances.set(instance.id, instance);
    this.runIndex.set(instance.runId, instance.id);
    return instance;
  }

  create(input: {
    runId: string;
    threadId: string;
    userId: number;
    skillId: string;
    skillVersion: string;
    input: unknown;
    state: unknown;
  }): SkillInstance {
    const existing = this.getByRunId(input.runId);
    if (existing) {
      return existing;
    }

    const now = nowIso();
    const instance: SkillInstance = {
      id: crypto.randomUUID(),
      runId: input.runId,
      threadId: input.threadId,
      userId: input.userId,
      skillId: input.skillId,
      skillVersion: input.skillVersion,
      status: "created",
      input: input.input,
      state: input.state,
      artifactRefs: [],
      evidenceCursor: {
        observations: 0,
        toolExecutions: 0,
        retrievals: 0,
      },
      createdAt: now,
      updatedAt: now,
    };

    this.cache(instance);
    skillInstancePersistence?.create?.(instance);
    return instance;
  }

  get(instanceId: string): SkillInstance | undefined {
    const cached = this.instances.get(instanceId);
    if (cached) {
      return cached;
    }
    const persisted = skillInstancePersistence?.get?.(instanceId);
    return persisted ? this.cache(persisted) : undefined;
  }

  getByRunId(runId: string): SkillInstance | undefined {
    const cachedId = this.runIndex.get(runId);
    if (cachedId) {
      return this.instances.get(cachedId);
    }
    const persisted = skillInstancePersistence?.getByRunId?.(runId);
    return persisted ? this.cache(persisted) : undefined;
  }

  update(
    instanceId: string,
    patch: Partial<Omit<SkillInstance, "id" | "createdAt">>,
  ): SkillInstance {
    const current = this.get(instanceId);
    if (!current) {
      throw new Error(`SkillInstance not found: ${instanceId}`);
    }

    const next: SkillInstance = {
      ...current,
      ...patch,
      updatedAt: nowIso(),
    };
    this.cache(next);
    skillInstancePersistence?.update?.(instanceId, patch);
    return next;
  }

  clear() {
    this.instances.clear();
    this.runIndex.clear();
    skillInstancePersistence?.clear?.();
  }
}

export const skillInstanceStore = new InMemorySkillInstanceStore();
