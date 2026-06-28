import type {
  AgentGoal,
  AgentObservation,
  AgentPlan,
  AgentRun,
  AgentRunStore,
} from "./types.js";

const nowIso = () => new Date().toISOString();

export class InMemoryAgentRunStore implements AgentRunStore {
  private readonly runs = new Map<string, AgentRun>();

  create(input: {
    threadId: string;
    userId: number;
    goal: AgentGoal;
    plan: AgentPlan;
    runtimeInput?: AgentRun["runtimeInput"];
  }): AgentRun {
    const now = nowIso();
    const run: AgentRun = {
      id: crypto.randomUUID(),
      threadId: input.threadId,
      userId: input.userId,
      goal: input.goal,
      plan: input.plan,
      status: "queued",
      observations: [],
      traceId: crypto.randomUUID(),
      contextBudget: undefined,
      runtimeInput: input.runtimeInput,
      createdAt: now,
      updatedAt: now,
    };

    this.runs.set(run.id, run);
    return run;
  }

  get(runId: string): AgentRun | undefined {
    return this.runs.get(runId);
  }

  update(
    runId: string,
    patch: Partial<Omit<AgentRun, "id" | "createdAt">>,
  ): AgentRun {
    const current = this.runs.get(runId);
    if (!current) {
      throw new Error(`AgentRun not found: ${runId}`);
    }

    const next: AgentRun = {
      ...current,
      ...patch,
      updatedAt: nowIso(),
    };
    this.runs.set(runId, next);
    return next;
  }

  addObservation(runId: string, observation: AgentObservation): AgentRun {
    const current = this.runs.get(runId);
    if (!current) {
      throw new Error(`AgentRun not found: ${runId}`);
    }

    const next: AgentRun = {
      ...current,
      observations: [...current.observations, observation],
      updatedAt: nowIso(),
    };
    this.runs.set(runId, next);
    return next;
  }

  complete(
    runId: string,
    patch: Partial<Omit<AgentRun, "id" | "createdAt" | "status">> & {
      status: Extract<
        AgentRun["status"],
        "completed" | "failed" | "blocked" | "cancelled" | "waiting_approval"
      >;
    },
  ): AgentRun {
    const current = this.runs.get(runId);
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
    return next;
  }

  clear(): void {
    this.runs.clear();
  }
}

export const agentRunStore = new InMemoryAgentRunStore();
