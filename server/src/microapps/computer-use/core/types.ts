export type ComputerUseTaskStatus =
  | "queued"
  | "planning"
  | "awaiting_approval"
  | "running"
  | "blocked"
  | "succeeded"
  | "failed"
  | "cancelled";

export type ComputerUseRuntimeStatus =
  | "ready"
  | "not_installed"
  | "downloading"
  | "broken";

export type ComputerUsePlanStepStatus =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

export type ComputerUseApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired";

export type ComputerUseArtifactKind =
  | "screenshot"
  | "dom_snapshot"
  | "log"
  | "json"
  | "download";

export type ComputerUseEvidenceEntryKind =
  | "status"
  | "action"
  | "observation"
  | "approval"
  | "error";

export type ComputerUseResultStatus =
  | "blocked"
  | "succeeded"
  | "failed"
  | "cancelled";

export type ComputerUseTaskError = {
  code: string;
  message: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
};

export type ComputerUseGoalInput = {
  goal: string;
  siteScope?: string[];
  requestedBy?: string;
  meta?: Record<string, unknown>;
};

export type ComputerUseRuntimeState = {
  status: ComputerUseRuntimeStatus;
  browserEngine?: string;
  version?: string;
  message?: string;
  checkedAt: string;
  details?: Record<string, unknown>;
};

export type ComputerUsePlanStep = {
  id: string;
  title: string;
  description: string;
  status: ComputerUsePlanStepStatus;
  requiresApproval: boolean;
  approvalReason?: string;
  riskSummary?: string;
  startedAt?: string;
  completedAt?: string;
  meta?: Record<string, unknown>;
};

export type ComputerUsePlan = {
  steps: ComputerUsePlanStep[];
  summary: string;
  riskSummary?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type ComputerUseApprovalRequest = {
  id: string;
  stepId: string;
  status: ComputerUseApprovalStatus;
  title: string;
  reason: string;
  requestedAt: string;
  resolvedAt?: string;
  expiresAt?: string;
  requestedBy?: string;
  resolvedBy?: string;
  resolutionNote?: string;
  meta?: Record<string, unknown>;
};

export type ComputerUseArtifactSummary = {
  id: string;
  kind: ComputerUseArtifactKind;
  label: string;
  mimeType?: string;
  filePath?: string;
  url?: string;
  createdAt: string;
  byteSize?: number;
  meta?: Record<string, unknown>;
};

export type ComputerUseEvidenceEntry = {
  id: string;
  kind: ComputerUseEvidenceEntryKind;
  message: string;
  createdAt: string;
  stepId?: string;
  artifactIds?: string[];
  meta?: Record<string, unknown>;
};

export type ComputerUseEvidence = {
  entries: ComputerUseEvidenceEntry[];
  artifacts: ComputerUseArtifactSummary[];
  lastUpdatedAt?: string;
};

export type ComputerUseResult = {
  status: ComputerUseResultStatus;
  summary: string;
  completedAt: string;
  finalUrl?: string;
  outputText?: string;
  error?: ComputerUseTaskError;
  meta?: Record<string, unknown>;
};

export type ComputerUseTask = {
  id: string;
  goal: string;
  siteScope: string[];
  requestedBy?: string;
  status: ComputerUseTaskStatus;
  runtime: ComputerUseRuntimeState;
  plan?: ComputerUsePlan;
  pendingApproval?: ComputerUseApprovalRequest;
  approvals: ComputerUseApprovalRequest[];
  evidence: ComputerUseEvidence;
  result?: ComputerUseResult;
  currentStepId?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
};

export interface ComputerUseRuntimeManager {
  getRuntimeState(): Promise<ComputerUseRuntimeState>;
}

export type ComputerUseExecutorPlanningInput = {
  taskId: string;
  goal: string;
  siteScope: string[];
  runtime: ComputerUseRuntimeState;
  meta?: Record<string, unknown>;
};

export type ComputerUseExecutorRunInput = {
  task: ComputerUseTask;
  runtime: ComputerUseRuntimeState;
};

export type ComputerUseExecutorResumeInput = {
  task: ComputerUseTask;
  approval: ComputerUseApprovalRequest;
  runtime: ComputerUseRuntimeState;
};

export type ComputerUseExecutionCheckpoint = {
  status:
    | "blocked"
    | "running"
    | "awaiting_approval"
    | "succeeded"
    | "failed"
    | "cancelled";
  currentStepId?: string;
  evidenceEntries?: ComputerUseEvidenceEntry[];
  artifacts?: ComputerUseArtifactSummary[];
  approvalRequest?: ComputerUseApprovalRequest;
  result?: ComputerUseResult;
  error?: ComputerUseTaskError;
  meta?: Record<string, unknown>;
};

export interface ComputerUseExecutor {
  createPlan(input: ComputerUseExecutorPlanningInput): Promise<ComputerUsePlan>;
  runTask(input: ComputerUseExecutorRunInput): Promise<ComputerUseExecutionCheckpoint>;
  resumeTask?(
    input: ComputerUseExecutorResumeInput,
  ): Promise<ComputerUseExecutionCheckpoint>;
  cancelTask?(input: {
    task: ComputerUseTask;
    reason?: string;
  }): Promise<void>;
}

export interface ComputerUseEvidenceStore {
  append(input: {
    taskId: string;
    entries?: ComputerUseEvidenceEntry[];
    artifacts?: ComputerUseArtifactSummary[];
  }): Promise<ComputerUseEvidence>;
}

export interface ComputerUseTaskStore {
  create(task: ComputerUseTask): Promise<void>;
  getById(taskId: string): Promise<ComputerUseTask | null>;
  update(task: ComputerUseTask): Promise<void>;
}

export type ComputerUseServiceDeps = {
  runtimeManager: ComputerUseRuntimeManager;
  executor: ComputerUseExecutor;
  evidenceStore: ComputerUseEvidenceStore;
  taskStore: ComputerUseTaskStore;
  now?: () => string;
  createId?: () => string;
};
