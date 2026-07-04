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

const hasPatchField = <K extends keyof Partial<Omit<AgentRun, "id" | "createdAt">>>(
  patch: Partial<Omit<AgentRun, "id" | "createdAt">>,
  key: K,
) => Object.prototype.hasOwnProperty.call(patch, key);

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
  blockedReason: row.blockedReason ?? undefined,
  terminalReason: row.terminalReason ?? undefined,
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

  if (hasPatchField(patch, "threadId") && patch.threadId !== undefined) {
    next.threadId = patch.threadId;
  }
  if (hasPatchField(patch, "userId") && patch.userId !== undefined) {
    next.userId = patch.userId;
  }
  if (hasPatchField(patch, "goal") && patch.goal !== undefined) {
    next.goalJson = serializeJson(patch.goal);
  }
  if (hasPatchField(patch, "plan") && patch.plan !== undefined) {
    next.planJson = serializeJson(patch.plan);
  }
  if (hasPatchField(patch, "status") && patch.status !== undefined) {
    next.status = patch.status;
  }
  if (hasPatchField(patch, "observations") && patch.observations !== undefined) {
    next.observationsJson = serializeJson(patch.observations);
  }
  if (hasPatchField(patch, "traceId") && patch.traceId !== undefined) {
    next.traceId = patch.traceId;
  }
  if (hasPatchField(patch, "currentStepId")) {
    next.currentStepId = patch.currentStepId ?? null;
  }
  if (hasPatchField(patch, "blockedReason")) {
    next.blockedReason = patch.blockedReason ?? null;
  }
  if (hasPatchField(patch, "terminalReason")) {
    next.terminalReason = patch.terminalReason ?? null;
  }
  if (hasPatchField(patch, "pendingApproval")) {
    next.pendingApprovalJson =
      patch.pendingApproval == null ? null : serializeJson(patch.pendingApproval);
  }
  if (
    hasPatchField(patch, "approvedInvocations") &&
    patch.approvedInvocations !== undefined
  ) {
    next.approvedInvocationsJson = serializeJson(patch.approvedInvocations);
  }
  if (hasPatchField(patch, "contextBudget")) {
    next.contextBudgetJson =
      patch.contextBudget == null ? null : serializeJson(patch.contextBudget);
  }
  if (hasPatchField(patch, "selectedToolId")) {
    next.selectedToolId = patch.selectedToolId ?? null;
  }
  if (hasPatchField(patch, "pendingToolCall")) {
    next.pendingToolCallJson =
      patch.pendingToolCall == null ? null : serializeJson(patch.pendingToolCall);
  }
  if (hasPatchField(patch, "lastToolExecution")) {
    next.lastToolExecutionJson =
      patch.lastToolExecution == null ? null : serializeJson(patch.lastToolExecution);
  }
  if (hasPatchField(patch, "assistantMessageId")) {
    next.assistantMessageId = patch.assistantMessageId ?? null;
  }
  if (hasPatchField(patch, "assistantParentId")) {
    next.assistantParentId = patch.assistantParentId ?? null;
  }
  if (hasPatchField(patch, "runtimeInput")) {
    next.runtimeInputJson =
      patch.runtimeInput == null ? null : serializeJson(patch.runtimeInput);
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
      blockedReason: null,
      terminalReason: null,
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
