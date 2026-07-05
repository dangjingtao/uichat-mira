export interface ContextReadBudget {
  maxFiles: number;
  maxChars: number;
  maxDepth: number;
}

export type ContextReadPlan =
  | { kind: "list"; path: string; maxDepth: number }
  | { kind: "open"; path: string }
  | { kind: "locate"; query: string; maxFiles: number }
  | { kind: "inspect"; query: string; maxFiles: number; maxChars: number };

export type ContextReadPlanKind = ContextReadPlan["kind"];

export type ContextReadDecisionReasonCode =
  | "explicit_path"
  | "directory_intent"
  | "fuzzy_lookup"
  | "inspect_intent"
  | "default_locate";

export interface ContextReadDecisionReason {
  code: ContextReadDecisionReasonCode;
  message: string;
}

export interface ContextReadPlanDiagnostics {
  selectedKind: ContextReadPlanKind;
  normalizedQuery: string;
  inferredPath?: string;
  reasons: ContextReadDecisionReason[];
}

export interface ContextReadPlanResult {
  plan: ContextReadPlan;
  budget: ContextReadBudget;
  diagnostics: ContextReadPlanDiagnostics;
}

export interface ContextReadPlannerInput {
  query: string;
  path?: string;
  budget?: Partial<ContextReadBudget>;
}
