import type {
  ContextBudgetAuditSection,
  ContextBudgetPolicy,
  ContextBudgetPolicyName,
} from "./types.js";

export const toAuditAction = (
  beforeTokens: number,
  afterTokens: number,
): ContextBudgetAuditSection["action"] => {
  if (afterTokens === 0 && beforeTokens > 0) {
    return "dropped";
  }
  if (afterTokens < beforeTokens) {
    return "trimmed";
  }
  return "kept";
};

export const createAuditSection = (input: {
  name: string;
  beforeTokens: number;
  afterTokens: number;
  reason?: string;
}): ContextBudgetAuditSection => ({
  name: input.name,
  beforeTokens: input.beforeTokens,
  afterTokens: input.afterTokens,
  action: toAuditAction(input.beforeTokens, input.afterTokens),
  ...(input.reason ? { reason: input.reason } : {}),
});

export const createBaseAudit = (input: {
  policy: ContextBudgetPolicy;
  policyName: ContextBudgetPolicyName;
  providerCode?: string;
  model?: string;
  sections: ContextBudgetAuditSection[];
  warnings: string[];
  totalEstimatedTokensBefore: number;
  totalEstimatedTokensAfter: number;
}) => {
  const maxInputTokens = Math.max(
    input.policy.modelContextTokens - input.policy.reservedOutputTokens,
    0,
  );

  return {
    policy: input.policyName,
    model: input.model?.trim() || "unknown",
    providerCode: input.providerCode?.trim() || "unknown",
    modelContextTokens: input.policy.modelContextTokens,
    reservedOutputTokens: input.policy.reservedOutputTokens,
    maxInputTokens,
    totalEstimatedTokensBefore: input.totalEstimatedTokensBefore,
    totalEstimatedTokensAfter: input.totalEstimatedTokensAfter,
    sections: input.sections,
    warnings: input.warnings,
  };
};
