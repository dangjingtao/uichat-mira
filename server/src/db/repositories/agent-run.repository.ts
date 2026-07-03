import { eq } from "drizzle-orm";
import { getDb } from "../index";
import { agentRuns } from "../schema";
import { nowIso } from "@/utils/time.js";
import type {
  AgentApprovedInvocation,
  AgentApprovalRequest,
  AgentGoal,
  AgentObservation,
  AgentPlan,
  AgentRun,
  AgentRunStatus,
  AgentRunStore,
} from "@/agent/types.js";

type AgentRunRow = typeof agentRuns.$inferSelect;

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const serializeJson = (value: unknown) => JSON.stringify(value);

const rowToRun = (row: AgentRunRow): AgentRun => ({
  id: row.id,
  threadId: row.threadId,
  userId: row.userId,
  goal: parseJson<AgentGoal>(row.goalJson, {
    id: "",
    text: "",
    successCriteria: [],
    constraints: [],
    riskLevel: "low",
  }),
  plan: parseJson<AgentPlan>(row.planJson, {
    id: "",
    goalId: "",
    version: 1,
    steps: [],
  }),
  status: row.status as AgentRunStatus,
  observations: parseJson<AgentObservation[]>(row.observationsJson, []),
  traceId: row.traceId,
  currentStepId: row.currentStepId ?? undefined,
  pendingApproval: parseJson<AgentApprovalRequest | undefined>(
    row.pendingApprovalJson,
    undefined,
  ),
  approvedInvocations: parseJson<AgentApprovedInvocation[]>(
    row.approvedInvocationsJson,
    [],
  ),
  contextBudget: parseJson(row.contextBudgetJson, undefined),
  selectedToolId: row.selectedToolId ?? undefined,
  pendingToolCall: parseJson(row.pendingToolCallJson, undefined),
  lastToolExecution: parseJson(row.lastToolExecutionJson, undefined),
  assistantMessageId: row.assistantMessageId ?? undefined,
  assistantParentId: row.assistantParentId ?? undefined,
  runtimeInput: parseJson(row.runtimeInputJson, undefined),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toPatch = (
  patch: Partial<Omit<AgentRun, "id" | "createdAt">>,
): Record<string, unknown> => {
  const next: Record<string, unknown> = {};

  if (patch.threadId !== undefined) next.threadId = patch.threadId;
  if (patch.userId !== undefined) next.userId = patch.userId;
  if (patch.goal !== undefined) next.goalJson = serializeJson(patch.goal);
  if (patch.plan !== undefined) next.planJson = serializeJson(patch.plan);
  if (patch.status !== undefined) next.status = patch.status;
  if (patch.observations !== undefined) next.observationsJson = serializeJson(patch.observations);
  if (patch.traceId !== undefined) next.traceId = patch.traceId;
  if (patch.currentStepId !== undefined) next.currentStepId = patch.currentStepId;
  if (patch.pendingApproval !== undefined) {
    next.pendingApprovalJson =
      patch.pendingApproval === undefined
        ? null
        : patch.pendingApproval === null
          ? null
          : serializeJson(patch.pendingApproval);
  }
  if (patch.approvedInvocations !== undefined) {
    next.approvedInvocationsJson = serializeJson(patch.approvedInvocations);
  }
  if (patch.contextBudget !== undefined) {
    next.contextBudgetJson =
      patch.contextBudget === undefined
        ? null
        : patch.contextBudget === null
          ? null
          : serializeJson(patch.contextBudget);
  }
  if (patch.selectedToolId !== undefined) {
    next.selectedToolId = patch.selectedToolId;
  }
  if (patch.pendingToolCall !== undefined) {
    next.pendingToolCallJson =
      patch.pendingToolCall === undefined
        ? null
        : patch.pendingToolCall === null
          ? null
          : serializeJson(patch.pendingToolCall);
  }
  if (patch.lastToolExecution !== undefined) {
    next.lastToolExecutionJson =
      patch.lastToolExecution === undefined
        ? null
        : patch.lastToolExecution === null
          ? null
          : serializeJson(patch.lastToolExecution);
  }
  if (patch.assistantMessageId !== undefined) {
    next.assistantMessageId = patch.assistantMessageId;
  }
  if (patch.assistantParentId !== undefined) {
    next.assistantParentId = patch.assistantParentId;
  }
  if (patch.runtimeInput !== undefined) {
    next.runtimeInputJson =
      patch.runtimeInput === undefined
        ? null
        : patch.runtimeInput === null
          ? null
          : serializeJson(patch.runtimeInput);
  }

  return next;
};

const createPersistedRun = (run: AgentRun) => {
    const db = getDb();

    db.insert(agentRuns).values({
      id: run.id,
      threadId: run.threadId,
      userId: run.userId,
      goalJson: serializeJson(run.goal),
      planJson: serializeJson(run.plan),
      status: run.status,
      observationsJson: serializeJson(run.observations),
      traceId: run.traceId,
      currentStepId: null,
      pendingApprovalJson: null,
      approvedInvocationsJson: serializeJson([]),
      contextBudgetJson: null,
      selectedToolId: null,
      pendingToolCallJson: null,
      lastToolExecutionJson: null,
      assistantMessageId: run.assistantMessageId ?? null,
      assistantParentId:
        run.assistantParentId === undefined ? null : run.assistantParentId,
      runtimeInputJson: run.runtimeInput ? serializeJson(run.runtimeInput) : null,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    }).run();

    return run;
};

export const agentRunRepository: AgentRunStore & {
  createPersistedRun(run: AgentRun): AgentRun;
} = {
  create(input) {
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
      assistantMessageId: input.assistantMessageId,
      assistantParentId: input.assistantParentId,
      runtimeInput: input.runtimeInput,
      createdAt: now,
      updatedAt: now,
    };

    return createPersistedRun(run);
  },

  createPersistedRun(run) {
    return createPersistedRun(run);
  },

  get(runId) {
    const db = getDb();
    const row = db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.id, runId))
      .limit(1)
      .get();

    return row ? rowToRun(row) : undefined;
  },

  update(runId, patch) {
    const db = getDb();
    const row = db
      .update(agentRuns)
      .set({
        ...toPatch(patch),
        updatedAt: nowIso(),
      })
      .where(eq(agentRuns.id, runId))
      .returning()
      .get();

    if (!row) {
      throw new Error(`AgentRun not found: ${runId}`);
    }

    return rowToRun(row);
  },

  addObservation(runId, observation) {
    const current = this.get(runId);
    if (!current) {
      throw new Error(`AgentRun not found: ${runId}`);
    }

    return this.update(runId, {
      observations: [...current.observations, observation],
    });
  },

  complete(runId, patch) {
    return this.update(runId, {
      ...patch,
      status: patch.status,
    });
  },

  clear() {
    getDb().delete(agentRuns).run();
  },
};
