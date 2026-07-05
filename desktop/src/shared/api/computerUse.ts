import { get, post } from "@/shared/lib/request";

const COMPUTER_USE_RUNTIME_ROUTE = "/microapps/computer-use/runtime";
const COMPUTER_USE_RUNTIME_INSTALL_ROUTE =
  "/microapps/computer-use/runtime/install";
const COMPUTER_USE_TASKS_ROUTE = "/microapps/computer-use/tasks";

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

export interface ComputerUseRuntimeInstallRequest {
  version: string;
  archiveUrl: string;
  executableRelativePath: string;
  expectedSha256?: string;
}

export interface ComputerUseRuntimeState {
  status: ComputerUseRuntimeStatus;
  browserEngine?: "chromium" | "chrome" | "edge";
  version?: string;
  message?: string;
  checkedAt: string;
  details?: Record<string, unknown>;
}

export interface ComputerUsePlanStep {
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
}

export interface ComputerUsePlan {
  steps: ComputerUsePlanStep[];
  summary: string;
  riskSummary?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ComputerUseApprovalRequest {
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
}

export interface ComputerUseArtifactSummary {
  id: string;
  kind: ComputerUseArtifactKind;
  label: string;
  mimeType?: string;
  filePath?: string;
  url?: string;
  createdAt: string;
  byteSize?: number;
  meta?: Record<string, unknown>;
}

export interface ComputerUseEvidenceEntry {
  id: string;
  kind: ComputerUseEvidenceEntryKind;
  message: string;
  createdAt: string;
  stepId?: string;
  artifactIds?: string[];
  meta?: Record<string, unknown>;
}

export interface ComputerUseEvidence {
  entries: ComputerUseEvidenceEntry[];
  artifacts: ComputerUseArtifactSummary[];
  lastUpdatedAt?: string;
}

export interface ComputerUseTaskError {
  code: string;
  message: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
}

export interface ComputerUseResult {
  status: ComputerUseResultStatus;
  summary: string;
  completedAt: string;
  finalUrl?: string;
  outputText?: string;
  error?: ComputerUseTaskError;
  meta?: Record<string, unknown>;
}

export interface ComputerUseTask {
  taskId: string;
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
}

export interface CreateComputerUseTaskRequest {
  goal: string;
  siteScope?: string[];
  requestedBy?: string;
  meta?: Record<string, unknown>;
  autoStart?: boolean;
}

export interface ResolveComputerUseApprovalRequest {
  approvalId: string;
  decision: "approved" | "rejected";
  resolvedBy?: string;
  resolutionNote?: string;
}

export interface CancelComputerUseTaskRequest {
  reason?: string;
}

export async function getComputerUseRuntime(): Promise<ComputerUseRuntimeState> {
  return get<ComputerUseRuntimeState>(COMPUTER_USE_RUNTIME_ROUTE);
}

export async function installComputerUseRuntime(
  payload: ComputerUseRuntimeInstallRequest,
): Promise<ComputerUseRuntimeState> {
  return post<ComputerUseRuntimeState>(COMPUTER_USE_RUNTIME_INSTALL_ROUTE, payload);
}

export async function createComputerUseTask(
  payload: CreateComputerUseTaskRequest,
): Promise<ComputerUseTask> {
  return post<ComputerUseTask>(COMPUTER_USE_TASKS_ROUTE, payload);
}

export async function getComputerUseTask(
  taskId: string,
): Promise<ComputerUseTask> {
  return get<ComputerUseTask>(
    `${COMPUTER_USE_TASKS_ROUTE}/${encodeURIComponent(taskId)}`,
  );
}

export async function startComputerUseTask(
  taskId: string,
): Promise<ComputerUseTask> {
  return post<ComputerUseTask>(
    `${COMPUTER_USE_TASKS_ROUTE}/${encodeURIComponent(taskId)}/start`,
  );
}

export async function resolveComputerUseApproval(
  taskId: string,
  payload: ResolveComputerUseApprovalRequest,
): Promise<ComputerUseTask> {
  return post<ComputerUseTask>(
    `${COMPUTER_USE_TASKS_ROUTE}/${encodeURIComponent(taskId)}/approval`,
    payload,
  );
}

export async function cancelComputerUseTask(
  taskId: string,
  payload?: CancelComputerUseTaskRequest,
): Promise<ComputerUseTask> {
  return post<ComputerUseTask>(
    `${COMPUTER_USE_TASKS_ROUTE}/${encodeURIComponent(taskId)}/cancel`,
    payload,
  );
}
