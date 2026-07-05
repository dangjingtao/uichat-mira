import { buildContextReadDiagnostics } from "./diagnostics.js";
import { normalizeContextReadBudget } from "./budget.js";
import type {
  ContextReadBudget,
  ContextReadDecisionReason,
  ContextReadPlan,
  ContextReadPlanResult,
} from "./contract.js";

export interface BuildContextReadPlanResultInput {
  plan: ContextReadPlan;
  budget?: Partial<ContextReadBudget>;
  normalizedQuery: string;
  inferredPath?: string;
  reasons: ContextReadDecisionReason[];
}

export const buildContextReadPlanResult = (
  input: BuildContextReadPlanResultInput,
): ContextReadPlanResult => {
  const budget = normalizeContextReadBudget(input.budget);

  return {
    plan: input.plan,
    budget,
    diagnostics: buildContextReadDiagnostics({
      selectedKind: input.plan.kind,
      normalizedQuery: input.normalizedQuery,
      ...(input.inferredPath ? { inferredPath: input.inferredPath } : {}),
      reasons: input.reasons,
    }),
  };
};
