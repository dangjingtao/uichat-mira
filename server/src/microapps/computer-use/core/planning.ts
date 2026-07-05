import type {
  ComputerUseApprovalRequest,
  ComputerUsePlan,
  ComputerUsePlanStep,
} from "./types.js";

export const createComputerUsePlan = (input: {
  steps: ComputerUsePlanStep[];
  summary: string;
  riskSummary?: string;
  createdAt: string;
  version?: number;
}): ComputerUsePlan => {
  ensurePlanStepIdsUnique(input.steps);

  return {
    steps: input.steps.map((step) => ({ ...step })),
    summary: input.summary,
    riskSummary: input.riskSummary,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    version: input.version ?? 1,
  };
};

export const createComputerUseApprovalRequest = (input: {
  id: string;
  stepId: string;
  title: string;
  reason: string;
  requestedAt: string;
  expiresAt?: string;
  requestedBy?: string;
  meta?: Record<string, unknown>;
}): ComputerUseApprovalRequest => ({
  id: input.id,
  stepId: input.stepId,
  status: "pending",
  title: input.title,
  reason: input.reason,
  requestedAt: input.requestedAt,
  expiresAt: input.expiresAt,
  requestedBy: input.requestedBy,
  meta: input.meta ? { ...input.meta } : undefined,
});

export const resolveComputerUseApprovalRequest = (
  approval: ComputerUseApprovalRequest,
  input: {
    status: "approved" | "rejected" | "expired";
    resolvedAt: string;
    resolvedBy?: string;
    resolutionNote?: string;
  },
): ComputerUseApprovalRequest => ({
  ...approval,
  status: input.status,
  resolvedAt: input.resolvedAt,
  resolvedBy: input.resolvedBy,
  resolutionNote: input.resolutionNote,
});

const ensurePlanStepIdsUnique = (steps: ComputerUsePlanStep[]) => {
  const ids = new Set<string>();
  for (const step of steps) {
    if (ids.has(step.id)) {
      throw new Error(`Duplicate computer use plan step id: ${step.id}`);
    }
    ids.add(step.id);
  }
};
