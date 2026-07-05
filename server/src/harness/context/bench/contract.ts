export type ContextReadBenchCaseStatus = "passed" | "failed";

export interface ContextReadBenchCaseResult {
  caseId: string;
  operation: string;
  input: Record<string, unknown>;
  status: ContextReadBenchCaseStatus;
  filesRead: number;
  charsRead: number;
  encoding: string;
  truncated: boolean;
  diagnostics: string[];
}

export interface ContextReadBenchReport {
  runner: "context-read-bench";
  generatedAt: string;
  workspaceRoot: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  cases: ContextReadBenchCaseResult[];
}
