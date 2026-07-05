import type {
  ComputerUseApprovalRequest,
  ComputerUseEvidence,
  ComputerUsePlan,
  ComputerUsePlanStep,
  ComputerUseResult,
  ComputerUseRuntimeState,
  ComputerUseTask,
  ComputerUseTaskStatus,
} from "./types.js";

const terminalStatuses = new Set<ComputerUseTaskStatus>([
  "blocked",
  "succeeded",
  "failed",
  "cancelled",
]);

const transitionMap: Record<
  ComputerUseTaskStatus,
  ReadonlySet<ComputerUseTaskStatus>
> = {
  queued: new Set([
    "planning",
    "awaiting_approval",
    "running",
    "blocked",
    "failed",
    "cancelled",
  ]),
  planning: new Set(["queued", "awaiting_approval", "blocked", "failed", "cancelled"]),
  awaiting_approval: new Set(["running", "blocked", "failed", "cancelled"]),
  running: new Set(["awaiting_approval", "blocked", "succeeded", "failed", "cancelled"]),
  blocked: new Set(),
  succeeded: new Set(),
  failed: new Set(),
  cancelled: new Set(),
};

const cloneStep = (step: ComputerUsePlanStep): ComputerUsePlanStep => ({
  ...step,
  meta: step.meta ? { ...step.meta } : undefined,
});

const clonePlan = (plan: ComputerUsePlan | undefined) =>
  plan
    ? {
        ...plan,
        steps: plan.steps.map(cloneStep),
      }
    : undefined;

export const createEmptyComputerUseEvidence = (): ComputerUseEvidence => ({
  entries: [],
  artifacts: [],
});

export const isTerminalComputerUseTaskStatus = (status: ComputerUseTaskStatus) =>
  terminalStatuses.has(status);

export const canTransitionComputerUseTaskStatus = (
  from: ComputerUseTaskStatus,
  to: ComputerUseTaskStatus,
) => from === to || transitionMap[from].has(to);

export const createPlanningComputerUseTask = (input: {
  id: string;
  goal: string;
  siteScope?: string[];
  requestedBy?: string;
  runtime: ComputerUseRuntimeState;
  createdAt: string;
  meta?: Record<string, unknown>;
}): ComputerUseTask => ({
  id: input.id,
  goal: input.goal,
  siteScope: [...(input.siteScope ?? [])],
  requestedBy: input.requestedBy,
  status: "planning",
  runtime: { ...input.runtime },
  approvals: [],
  evidence: createEmptyComputerUseEvidence(),
  meta: input.meta ? { ...input.meta } : undefined,
  createdAt: input.createdAt,
  updatedAt: input.createdAt,
});

export const transitionComputerUseTask = (
  task: ComputerUseTask,
  nextStatus: ComputerUseTaskStatus,
  options: {
    at: string;
    runtime?: ComputerUseRuntimeState;
    plan?: ComputerUsePlan;
    pendingApproval?: ComputerUseApprovalRequest;
    approvals?: ComputerUseApprovalRequest[];
    evidence?: ComputerUseEvidence;
    result?: ComputerUseResult;
    currentStepId?: string;
    meta?: Record<string, unknown>;
  },
): ComputerUseTask => {
  if (!canTransitionComputerUseTaskStatus(task.status, nextStatus)) {
    throw new Error(
      `Invalid computer use task status transition: ${task.status} -> ${nextStatus}`,
    );
  }

  const hasPendingApprovalOverride = Object.prototype.hasOwnProperty.call(
    options,
    "pendingApproval",
  );

  const nextTask: ComputerUseTask = {
    ...task,
    status: nextStatus,
    updatedAt: options.at,
    runtime: options.runtime ? { ...options.runtime } : { ...task.runtime },
    plan: clonePlan(options.plan ?? task.plan),
    pendingApproval: hasPendingApprovalOverride
      ? options.pendingApproval
        ? { ...options.pendingApproval }
        : undefined
      : task.pendingApproval
        ? { ...task.pendingApproval }
        : undefined,
    approvals: (options.approvals ?? task.approvals).map((approval) => ({
      ...approval,
      meta: approval.meta ? { ...approval.meta } : undefined,
    })),
    evidence: options.evidence
      ? {
          entries: options.evidence.entries.map((entry) => ({
            ...entry,
            artifactIds: entry.artifactIds ? [...entry.artifactIds] : undefined,
            meta: entry.meta ? { ...entry.meta } : undefined,
          })),
          artifacts: options.evidence.artifacts.map((artifact) => ({
            ...artifact,
            meta: artifact.meta ? { ...artifact.meta } : undefined,
          })),
          lastUpdatedAt: options.evidence.lastUpdatedAt,
        }
      : {
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
    result: options.result
      ? {
          ...options.result,
          error: options.result.error
            ? {
                ...options.result.error,
                details: options.result.error.details
                  ? { ...options.result.error.details }
                  : undefined,
              }
            : undefined,
          meta: options.result.meta ? { ...options.result.meta } : undefined,
        }
      : task.result
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
    currentStepId: options.currentStepId ?? task.currentStepId,
    meta: options.meta ? { ...task.meta, ...options.meta } : task.meta,
  };

  if (nextStatus === "running" && !nextTask.startedAt) {
    nextTask.startedAt = options.at;
  }

  if (isTerminalComputerUseTaskStatus(nextStatus) && !nextTask.completedAt) {
    nextTask.completedAt = options.at;
  }

  return nextTask;
};

export const markComputerUsePlanReady = (
  task: ComputerUseTask,
  plan: ComputerUsePlan,
  at: string,
) =>
  transitionComputerUseTask(task, "queued", {
    at,
    plan,
  });
