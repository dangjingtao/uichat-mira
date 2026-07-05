import type {
  ContextReadDecisionReason,
  ContextReadPlanDiagnostics,
  ContextReadPlanKind,
} from "./contract.js";

export interface BuildContextReadDiagnosticsInput {
  selectedKind: ContextReadPlanKind;
  normalizedQuery: string;
  inferredPath?: string;
  reasons: ContextReadDecisionReason[];
}

export const buildContextReadDiagnostics = (
  input: BuildContextReadDiagnosticsInput,
): ContextReadPlanDiagnostics => ({
  selectedKind: input.selectedKind,
  normalizedQuery: input.normalizedQuery,
  ...(input.inferredPath ? { inferredPath: input.inferredPath } : {}),
  reasons: input.reasons,
});
