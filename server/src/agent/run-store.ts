import type {
  AgentGoal,
  AgentObservation,
  AgentRun,
  AgentRunStore,
} from "./types";
import {
  DEFAULT_RETENTION_CONFIG,
  sweepRetentionMap,
  type RetentionConfig,
} from "@/utils/retention";

const nowIso = () => new Date().toISOString();

type AgentRunPersistence = {
  create?: (run: AgentRun) => void;
  get?: (runId: string) => AgentRun | undefined;
  update?: (
    runId: string,
    patch: Partial<Omit<AgentRun, "id" | "createdAt">>,
  ) => void;
  addObservation?: (runId: string, observation: AgentObservation) => void;
  complete?: (
    runId: string,
    patch: Partial<Omit<AgentRun, "id" | "createdAt" | "status">> & {
      status: Extract<
        AgentRun["status"],
        | "completed"
        | "failed"
        | "blocked"
        | "cancelled"
        | "waiting_approval"
        | "waiting_user"
      >;
    },
  ) => void;
};

let agentRunPersistence: AgentRunPersistence | undefined;

export const configureAgentRunPersistence = (
  persistence?: AgentRunPersistence,
) => {
  agentRunPersistence = persistence;
};

export const hasAgentRunPersistence = () => Boolean(agentRunPersistence);

const getStoredRun = (runs: Map<string, AgentRun>, runId: string) => {
  const inMemoryRun = runs.get(runId);
  if (inMemoryRun) {
    return inMemoryRun;
  }

  const persistedRun = agentRunPersistence?.get?.(runId);
  if (persistedRun) {
    runs.set(runId, persistedRun);
    return persistedRun;
  }

  return undefined;
};

export class InMemoryAgentRunStore implements AgentRunStore {
  private readonly runs = new Map<string, AgentRun>();
  private retentionConfig: RetentionConfig = {
    ...DEFAULT_RETENTION_CONFIG,
  };

  configureRetention(config: Partial<RetentionConfig>) {
    this.retentionConfig = {
      ...this.retentionConfig,
      ...config,
    };
  }

  sweep() {
    sweepRetentionMap(this.runs, {
      config: this.retentionConfig,
      getUpdatedAt: (run) => run.updatedAt,
      keep: (run) => run.status === "running" || run.status === "waiting_approval",
    });
  }

  create(input: {
    threadId: string;
    userId: number;
    goal: AgentGoal;
    assistantMessageId?: string;
    assistantParentId?: string | null;
    runtimeInput?: AgentRun["runtimeInput"];
  }): AgentRun {
    const now = nowIso();
    const run: AgentRun = {
      id: crypto.randomUUID(),
      threadId: input.threadId,
      userId: input.userId,
      goal: input.goal,
      status: "queued",
      observations: [],
      traceId: crypto.randomUUID(),
      approvedInvocations: [],
      contextBudget: undefined,
      assistantMessageId: input.assistantMessageId,
      assistantParentId: input.assistantParentId,
      runtimeInput: input.runtimeInput,
      createdAt: now,
      updatedAt: now,
    };

    this.sweep();
    this.runs.set(run.id, run);
    agentRunPersistence?.create?.(run);
    return run;
  }

  get(runId: string): AgentRun | undefined {
    return getStoredRun(this.runs, runId);
  }

  update(
    runId: string,
    patch: Partial<Omit<AgentRun, "id" | "createdAt">>,
  ): AgentRun {
    const current = getStoredRun(this.runs, runId);
    if (!current) {
      throw new Error(`AgentRun not found: ${runId}`);
    }

    const next: AgentRun = {
      ...current,
      ...patch,
      updatedAt: nowIso(),
    };
    this.runs.set(runId, next);
    agentRunPersistence?.update?.(runId, patch);
    this.sweep();
    return next;
  }

  addObservation(runId: string, observation: AgentObservation): AgentRun {
    const current = getStoredRun(this.runs, runId);
    if (!current) {
      throw new Error(`AgentRun not found: ${runId}`);
    }
    if (current.observations.some((item) => item.id === observation.id)) {
      return current;
    }

    const next: AgentRun = {
      ...current,
      observations: [...current.observations, observation],
      updatedAt: nowIso(),
    };
    this.runs.set(runId, next);
    agentRunPersistence?.addObservation?.(runId, observation);
    this.sweep();
    return next;
  }

  complete(
    runId: string,
    patch: Partial<Omit<AgentRun, "id" | "createdAt" | "status">> & {
      status: Extract<
        AgentRun["status"],
        | "completed"
        | "failed"
        | "blocked"
        | "cancelled"
        | "waiting_approval"
        | "waiting_user"
      >;
    },
  ): AgentRun {
    const current = getStoredRun(this.runs, runId);
    if (!current) {
      throw new Error(`AgentRun not found: ${runId}`);
    }

    const next: AgentRun = {
      ...current,
      ...patch,
      status: patch.status,
      updatedAt: nowIso(),
    };
    this.runs.set(runId, next);
    agentRunPersistence?.complete?.(runId, patch);
    this.sweep();
    return next;
  }

  clear(): void {
    this.runs.clear();
  }
}

export const agentRunStore = new InMemoryAgentRunStore();
