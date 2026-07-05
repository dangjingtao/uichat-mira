import {
  createComputerUseApprovalRequest,
  resolveComputerUseApprovalRequest,
} from "./planning.js";
import {
  createPlanningComputerUseTask,
  isTerminalComputerUseTaskStatus,
  markComputerUsePlanReady,
  transitionComputerUseTask,
} from "./task-lifecycle.js";
import type {
  ComputerUseEvidence,
  ComputerUseEvidenceStore,
  ComputerUseExecutionCheckpoint,
  ComputerUseGoalInput,
  ComputerUseRuntimeState,
  ComputerUseServiceDeps,
  ComputerUseTask,
  ComputerUseTaskError,
  ComputerUseTaskStore,
} from "./types.js";

const defaultNow = () => new Date().toISOString();
const defaultCreateId = () =>
  `cu_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const normalizeTaskError = (
  error: unknown,
  fallbackCode: string,
  fallbackMessage: string,
): ComputerUseTaskError => {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof error.code === "string" &&
    typeof error.message === "string"
  ) {
    return {
      code: error.code,
      message: error.message,
      retryable:
        "retryable" in error && typeof error.retryable === "boolean"
          ? error.retryable
          : undefined,
      details:
        "details" in error &&
        typeof error.details === "object" &&
        error.details !== null
          ? (error.details as Record<string, unknown>)
          : undefined,
    };
  }

  if (error instanceof Error) {
    return {
      code: fallbackCode,
      message: error.message,
    };
  }

  return {
    code: fallbackCode,
    message: fallbackMessage,
  };
};

const assertNonEmptyGoal = (goal: string) => {
  if (!goal.trim()) {
    throw new ComputerUseRequestValidationError(
      "Computer use goal must not be empty.",
    );
  }
};

const ensureRuntimeReady = (runtime: ComputerUseRuntimeState) => {
  if (runtime.status !== "ready") {
    throw new ComputerUseRuntimeUnavailableError(runtime);
  }
};

const createRejectedResult = (
  at: string,
  message: string,
  note?: string,
): Required<Pick<ComputerUseTask, "result">>["result"] => ({
  status: "cancelled",
  summary: message,
  completedAt: at,
  error: {
    code: "COMPUTER_USE_APPROVAL_REJECTED",
    message,
    details: note ? { resolutionNote: note } : undefined,
  },
});

export class ComputerUseTaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Computer use task was not found: ${taskId}`);
    this.name = "ComputerUseTaskNotFoundError";
  }
}

export class ComputerUseRequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComputerUseRequestValidationError";
  }
}

export class ComputerUseRuntimeUnavailableError extends Error {
  readonly runtime: ComputerUseRuntimeState;

  constructor(runtime: ComputerUseRuntimeState) {
    super(
      `Computer use runtime is not ready: ${runtime.status}${runtime.message ? ` (${runtime.message})` : ""}`,
    );
    this.name = "ComputerUseRuntimeUnavailableError";
    this.runtime = runtime;
  }
}

export class ComputerUseApprovalRequiredError extends Error {
  constructor(taskId: string) {
    super(`Computer use task is waiting for approval: ${taskId}`);
    this.name = "ComputerUseApprovalRequiredError";
  }
}

export class ComputerUseService {
  private readonly deps: Required<ComputerUseServiceDeps>;

  constructor(deps: ComputerUseServiceDeps) {
    this.deps = {
      ...deps,
      now: deps.now ?? defaultNow,
      createId: deps.createId ?? defaultCreateId,
    };
  }

  async createPlan(input: ComputerUseGoalInput) {
    assertNonEmptyGoal(input.goal);
    const runtime = await this.deps.runtimeManager.getRuntimeState();
    ensureRuntimeReady(runtime);

    const createdAt = this.deps.now();
    const task = createPlanningComputerUseTask({
      id: this.deps.createId(),
      goal: input.goal.trim(),
      siteScope: input.siteScope,
      requestedBy: input.requestedBy,
      runtime,
      createdAt,
      meta: input.meta,
    });

    await this.deps.taskStore.create(task);

    try {
      const plan = await this.deps.executor.createPlan({
        taskId: task.id,
        goal: task.goal,
        siteScope: task.siteScope,
        runtime,
        meta: task.meta,
      });

      const nextTask = markComputerUsePlanReady(task, plan, this.deps.now());
      await this.deps.taskStore.update(nextTask);
      return nextTask;
    } catch (error) {
      const failedTask = transitionComputerUseTask(task, "failed", {
        at: this.deps.now(),
        result: {
          status: "failed",
          summary: "Failed to create a computer use plan.",
          completedAt: this.deps.now(),
          error: normalizeTaskError(
            error,
            "COMPUTER_USE_PLAN_FAILED",
            "Unknown planning failure.",
          ),
        },
      });

      await this.deps.taskStore.update(failedTask);
      return failedTask;
    }
  }

  async getTask(taskId: string) {
    return this.deps.taskStore.getById(taskId);
  }

  async startTask(taskId: string) {
    const task = await this.requireTask(taskId);
    if (!task.plan) {
      throw new ComputerUseRequestValidationError(
        `Computer use task does not have a plan: ${taskId}`,
      );
    }
    if (task.status !== "queued") {
      throw new ComputerUseRequestValidationError(
        `Computer use task is not ready to start: ${task.status}`,
      );
    }

    const runtime = await this.deps.runtimeManager.getRuntimeState();
    ensureRuntimeReady(runtime);

    const runningTask = transitionComputerUseTask(task, "running", {
      at: this.deps.now(),
      runtime,
    });
    await this.deps.taskStore.update(runningTask);

    return this.applyCheckpoint(
      runningTask,
      runtime,
      () => this.deps.executor.runTask({ task: runningTask, runtime }),
      "COMPUTER_USE_EXECUTION_FAILED",
      "Computer use task execution failed.",
    );
  }

  async resolveApproval(input: {
    taskId: string;
    approvalId: string;
    decision: "approved" | "rejected";
    resolvedBy?: string;
    resolutionNote?: string;
  }) {
    const task = await this.requireTask(input.taskId);
    const pendingApproval = task.pendingApproval;

    if (!pendingApproval || pendingApproval.id !== input.approvalId) {
      throw new ComputerUseApprovalRequiredError(task.id);
    }

    const resolvedApproval = resolveComputerUseApprovalRequest(pendingApproval, {
      status: input.decision,
      resolvedAt: this.deps.now(),
      resolvedBy: input.resolvedBy,
      resolutionNote: input.resolutionNote,
    });
    const approvals = task.approvals.map((approval) =>
      approval.id === resolvedApproval.id ? resolvedApproval : approval,
    );

    if (input.decision === "rejected") {
      const evidence = await this.appendEvidence(task.id, {
        entries: [
          {
            id: this.deps.createId(),
            kind: "approval",
            message: `Approval rejected for step ${resolvedApproval.stepId}.`,
            createdAt: this.deps.now(),
            stepId: resolvedApproval.stepId,
            meta: input.resolutionNote
              ? { resolutionNote: input.resolutionNote }
              : undefined,
          },
        ],
      });
      const cancelledTask = transitionComputerUseTask(task, "cancelled", {
        at: this.deps.now(),
        approvals,
        pendingApproval: undefined,
        evidence,
        result: createRejectedResult(
          this.deps.now(),
          "Computer use task was cancelled because approval was rejected.",
          input.resolutionNote,
        ),
      });
      await this.deps.taskStore.update(cancelledTask);
      return cancelledTask;
    }

    if (!this.deps.executor.resumeTask) {
      throw new ComputerUseRequestValidationError(
        "Computer use executor does not support approval resume.",
      );
    }

    const runtime = await this.deps.runtimeManager.getRuntimeState();
    ensureRuntimeReady(runtime);

    const resumedTask = transitionComputerUseTask(task, "running", {
      at: this.deps.now(),
      runtime,
      approvals,
      pendingApproval: undefined,
    });
    await this.deps.taskStore.update(resumedTask);

    return this.applyCheckpoint(
      resumedTask,
      runtime,
      () =>
        this.deps.executor.resumeTask!({
          task: resumedTask,
          approval: resolvedApproval,
          runtime,
        }),
      "COMPUTER_USE_RESUME_FAILED",
      "Computer use task resume failed.",
    );
  }

  async cancelTask(taskId: string, reason?: string) {
    const task = await this.requireTask(taskId);
    if (isTerminalComputerUseTaskStatus(task.status)) {
      return task;
    }

    if (this.deps.executor.cancelTask) {
      await this.deps.executor.cancelTask({
        task,
        reason,
      });
    }

    const evidence = await this.appendEvidence(task.id, {
      entries: [
        {
          id: this.deps.createId(),
          kind: "status",
          message: reason
            ? `Task cancelled: ${reason}`
            : "Task cancelled by request.",
          createdAt: this.deps.now(),
        },
      ],
    });
    const cancelledTask = transitionComputerUseTask(task, "cancelled", {
      at: this.deps.now(),
      evidence,
      pendingApproval: undefined,
      result: {
        status: "cancelled",
        summary: reason ?? "Computer use task was cancelled.",
        completedAt: this.deps.now(),
      },
    });

    await this.deps.taskStore.update(cancelledTask);
    return cancelledTask;
  }

  private async requireTask(taskId: string) {
    const task = await this.deps.taskStore.getById(taskId);
    if (!task) {
      throw new ComputerUseTaskNotFoundError(taskId);
    }

    return task;
  }

  private async appendEvidence(
    taskId: string,
    input: {
      entries?: ComputerUseEvidence["entries"];
      artifacts?: ComputerUseEvidence["artifacts"];
    },
  ) {
    return this.deps.evidenceStore.append({
      taskId,
      entries: input.entries,
      artifacts: input.artifacts,
    });
  }

  private async applyCheckpoint(
    task: ComputerUseTask,
    runtime: ComputerUseRuntimeState,
    invoke: () => Promise<ComputerUseExecutionCheckpoint>,
    fallbackCode: string,
    fallbackMessage: string,
  ) {
    try {
      const checkpoint = await invoke();
      const evidence = await this.appendEvidence(task.id, {
        entries: checkpoint.evidenceEntries,
        artifacts: checkpoint.artifacts,
      });

      if (checkpoint.status === "awaiting_approval") {
        if (!checkpoint.approvalRequest) {
          throw new ComputerUseRequestValidationError(
            "Computer use executor checkpoint is missing approvalRequest.",
          );
        }
        const approval =
          checkpoint.approvalRequest.status === "pending"
            ? checkpoint.approvalRequest
            : createComputerUseApprovalRequest({
                id: checkpoint.approvalRequest.id,
                stepId: checkpoint.approvalRequest.stepId,
                title: checkpoint.approvalRequest.title,
                reason: checkpoint.approvalRequest.reason,
                requestedAt: checkpoint.approvalRequest.requestedAt,
                expiresAt: checkpoint.approvalRequest.expiresAt,
                requestedBy: checkpoint.approvalRequest.requestedBy,
                meta: checkpoint.approvalRequest.meta,
              });
        const nextTask = transitionComputerUseTask(task, "awaiting_approval", {
          at: this.deps.now(),
          runtime,
          evidence,
          currentStepId: checkpoint.currentStepId,
          pendingApproval: approval,
          approvals: [...task.approvals, approval],
          meta: checkpoint.meta,
        });
        await this.deps.taskStore.update(nextTask);
        return nextTask;
      }

      const nextTask = transitionComputerUseTask(task, checkpoint.status, {
        at: this.deps.now(),
        runtime,
        evidence,
        result: checkpoint.result,
        currentStepId: checkpoint.currentStepId,
        pendingApproval: undefined,
        meta: checkpoint.meta,
      });
      await this.deps.taskStore.update(nextTask);
      return nextTask;
    } catch (error) {
      const failedTask = transitionComputerUseTask(task, "failed", {
        at: this.deps.now(),
        runtime,
        result: {
          status: "failed",
          summary: fallbackMessage,
          completedAt: this.deps.now(),
          error: normalizeTaskError(error, fallbackCode, fallbackMessage),
        },
      });
      await this.deps.taskStore.update(failedTask);
      return failedTask;
    }
  }
}

export const createComputerUseService = (deps: ComputerUseServiceDeps) =>
  new ComputerUseService(deps);

export const createInMemoryComputerUseTaskStore = (): ComputerUseTaskStore => {
  const tasks = new Map<string, ComputerUseTask>();

  return {
    async create(task) {
      tasks.set(task.id, cloneTask(task));
    },
    async getById(taskId) {
      const task = tasks.get(taskId);
      return task ? cloneTask(task) : null;
    },
    async update(task) {
      tasks.set(task.id, cloneTask(task));
    },
  };
};

export const createInMemoryComputerUseEvidenceStore = (): ComputerUseEvidenceStore => {
  const evidences = new Map<string, ComputerUseEvidence>();

  return {
    async append({ taskId, entries, artifacts }) {
      const current = evidences.get(taskId) ?? {
        entries: [],
        artifacts: [],
      };
      const nextEvidence: ComputerUseEvidence = {
        entries: [
          ...current.entries.map((entry) => ({
            ...entry,
            artifactIds: entry.artifactIds ? [...entry.artifactIds] : undefined,
            meta: entry.meta ? { ...entry.meta } : undefined,
          })),
          ...(entries ?? []).map((entry) => ({
            ...entry,
            artifactIds: entry.artifactIds ? [...entry.artifactIds] : undefined,
            meta: entry.meta ? { ...entry.meta } : undefined,
          })),
        ],
        artifacts: [
          ...current.artifacts.map((artifact) => ({
            ...artifact,
            meta: artifact.meta ? { ...artifact.meta } : undefined,
          })),
          ...(artifacts ?? []).map((artifact) => ({
            ...artifact,
            meta: artifact.meta ? { ...artifact.meta } : undefined,
          })),
        ],
        lastUpdatedAt:
          [...(entries ?? []), ...(artifacts ?? [])]
            .map((item) => item.createdAt)
            .at(-1) ?? current.lastUpdatedAt,
      };
      evidences.set(taskId, nextEvidence);
      return {
        entries: nextEvidence.entries.map((entry) => ({
          ...entry,
          artifactIds: entry.artifactIds ? [...entry.artifactIds] : undefined,
          meta: entry.meta ? { ...entry.meta } : undefined,
        })),
        artifacts: nextEvidence.artifacts.map((artifact) => ({
          ...artifact,
          meta: artifact.meta ? { ...artifact.meta } : undefined,
        })),
        lastUpdatedAt: nextEvidence.lastUpdatedAt,
      };
    },
  };
};

const cloneTask = (task: ComputerUseTask): ComputerUseTask => ({
  ...task,
  siteScope: [...task.siteScope],
  runtime: {
    ...task.runtime,
    details: task.runtime.details ? { ...task.runtime.details } : undefined,
  },
  plan: task.plan
    ? {
        ...task.plan,
        steps: task.plan.steps.map((step) => ({
          ...step,
          meta: step.meta ? { ...step.meta } : undefined,
        })),
      }
    : undefined,
  approvals: task.approvals.map((approval) => ({
    ...approval,
    meta: approval.meta ? { ...approval.meta } : undefined,
  })),
  pendingApproval: task.pendingApproval
    ? {
        ...task.pendingApproval,
        meta: task.pendingApproval.meta ? { ...task.pendingApproval.meta } : undefined,
      }
    : undefined,
  evidence: {
    entries: task.evidence.entries.map((entry) => ({
      ...entry,
      artifactIds: entry.artifactIds ? [...entry.artifactIds] : undefined,
      meta: entry.meta ? { ...entry.meta } : undefined,
    })),
    artifacts: task.evidence.artifacts.map((artifact) => ({
      ...artifact,
      meta: artifact.meta ? { ...artifact.meta } : undefined,
    })),
    lastUpdatedAt: task.evidence.lastUpdatedAt,
  },
  result: task.result
    ? {
        ...task.result,
        error: task.result.error
          ? {
              ...task.result.error,
              details: task.result.error.details
                ? { ...task.result.error.details }
                : undefined,
            }
          : undefined,
        meta: task.result.meta ? { ...task.result.meta } : undefined,
      }
    : undefined,
  meta: task.meta ? { ...task.meta } : undefined,
});
