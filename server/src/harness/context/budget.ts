import type { ContextReadBudget } from "./contract.js";

export const DEFAULT_CONTEXT_READ_BUDGET: ContextReadBudget = {
  maxFiles: 8,
  maxChars: 12000,
  maxDepth: 2,
};

const MIN_BUDGET_VALUE = 1;

const normalizeBudgetValue = (value: number | undefined, fallback: number): number => {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(MIN_BUDGET_VALUE, Math.floor(value as number));
};

export const normalizeContextReadBudget = (
  budget?: Partial<ContextReadBudget>,
): ContextReadBudget => ({
  maxFiles: normalizeBudgetValue(budget?.maxFiles, DEFAULT_CONTEXT_READ_BUDGET.maxFiles),
  maxChars: normalizeBudgetValue(budget?.maxChars, DEFAULT_CONTEXT_READ_BUDGET.maxChars),
  maxDepth: normalizeBudgetValue(budget?.maxDepth, DEFAULT_CONTEXT_READ_BUDGET.maxDepth),
});
