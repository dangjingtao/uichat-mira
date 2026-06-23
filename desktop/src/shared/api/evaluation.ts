import {
  ApiError,
  del,
  get,
  post,
  type ApiErrorResponse,
} from "@/shared/lib/request";
import { getSession } from "@/shared/lib/sessionStorage";
import { getApiBaseUrl } from "@/shared/platform/desktopRuntime";

export type EvaluationMode = "retrieve" | "retrieve-generate";

export type EvaluationRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";

export interface EvaluationDatasetDocument {
  id: string;
  name: string;
  type: "话术" | "案例" | "规章" | "未分类";
  sizeLabel: string;
}

export interface EvaluationDatasetSample {
  id: string;
  question: string;
  expectedAnswer: string;
  goldSources: string[];
  tags: string[];
}

export interface EvaluationDatasetValidationItem {
  id: string;
  label: string;
  status: "pass" | "warning" | "error";
  detail: string;
}

export interface EvaluationDatasetConfig {
  mode: EvaluationMode;
  topK: number;
  topN: number;
  repeat: number;
  concurrency: number;
  timeoutSeconds: number;
}

export interface EvaluationDatasetRecord {
  id: string;
  datasetName: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  knowledgeBaseId?: string | null;
  summary: {
    documentCount: number;
    sampleCount: number;
    hasReferenceAnswers: boolean;
    hasGoldSources: boolean;
  };
  config: EvaluationDatasetConfig;
  documents: EvaluationDatasetDocument[];
  previewSamples: EvaluationDatasetSample[];
  validations: EvaluationDatasetValidationItem[];
}

export interface EvaluationLogEntry {
  id: string;
  timestamp: string;
  level: "info" | "success" | "warning" | "error";
  text: string;
}

export interface EvaluationMetricSummary {
  hitAtK: number;
  recallAtK: number;
  mrr: number;
  faithfulness: number;
  answerRelevance: number;
  answerCompleteness: number;
  sourceHitRate: number;
  averageLatencyMs: number;
  failedCount: number;
}

export interface EvaluationRetrievedSource {
  documentName: string;
  chunkId?: number;
  score?: number;
  contentPreview?: string;
}

export interface EvaluationSampleAttempt {
  attempt: number;
  status: "success" | "failed";
  latencyMs: number;
  hit: boolean;
  recall: number;
  faithfulness: number;
  answerRelevance: number;
  answerCompleteness: number;
  retrievedSources: EvaluationRetrievedSource[];
  answerText?: string;
  errorMessage?: string;
}

export interface EvaluationSampleResult {
  id: string;
  question: string;
  goldSources: string[];
  matchedGoldSources: string[];
  retrievedSources: EvaluationRetrievedSource[];
  answerText?: string;
  referenceAnswer?: string;
  status: "success" | "failed";
  hit: boolean;
  recall: number;
  latencyMs: number;
  sourceHit: boolean;
  faithfulness: number;
  answerRelevance: number;
  answerCompleteness: number;
  attempts: EvaluationSampleAttempt[];
  errorMessage?: string;
}

export interface EvaluationRunRecord {
  id: string;
  name: string;
  dataset: EvaluationDatasetRecord;
  status: EvaluationRunStatus;
  startedAt: string;
  completedAt?: string;
  metrics: EvaluationMetricSummary;
  logs: EvaluationLogEntry[];
  sampleResults: EvaluationSampleResult[];
}

export interface CreateEvaluationRunInput {
  datasetId: string;
  name?: string;
}

export interface GenerateEvaluationPackageInput {
  datasetName: string;
  knowledgeBaseId: string;
  sampleCount: number;
  documentCount: number;
  chunksPerDocument: number;
  mode: EvaluationMode;
  topK: number;
  topN: number;
  repeat: number;
  concurrency: number;
  timeoutSeconds: number;
}

export interface EvaluationRunListQuery {
  status?: EvaluationRunStatus;
}

export interface DeleteEvaluationRunResponse {
  id: string;
  deleted: boolean;
}

export interface DeleteEvaluationRunsResponse {
  deletedIds: string[];
}

export async function parseEvaluationDataset(
  file: File,
): Promise<EvaluationDatasetRecord> {
  const formData = new FormData();
  formData.append("file", file);

  return post<EvaluationDatasetRecord>("/evaluation/datasets/parse", formData);
}

export async function createEvaluationRun(
  input: CreateEvaluationRunInput,
): Promise<EvaluationRunRecord> {
  return post<EvaluationRunRecord>("/evaluation/runs", input);
}

export async function generateEvaluationPackage(
  input: GenerateEvaluationPackageInput,
): Promise<{ blob: Blob; fileName: string }> {
  const requestTimeoutMs = Math.max(input.timeoutSeconds, 300) * 1000;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), requestTimeoutMs);
  const session = getSession();

  try {
    const response = await fetch(`${getApiBaseUrl()}/evaluation/packages/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.token
          ? { Authorization: `Bearer ${session.token}` }
          : {}),
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok) {
      if (contentType.includes("application/json")) {
        const parsed = (await response.json()) as ApiErrorResponse;
        throw new ApiError(parsed);
      }

      throw new Error(`HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const header = response.headers.get("content-disposition") ?? undefined;
    const fileNameMatch = header?.match(/filename="([^"]+)"/i);

    return {
      blob,
      fileName: fileNameMatch?.[1] ?? "evaluation-package.zip",
    };
  } finally {
    window.clearTimeout(timer);
  }
}

export async function getEvaluationRuns(
  query?: EvaluationRunListQuery,
): Promise<EvaluationRunRecord[]> {
  const params = new URLSearchParams();
  if (query?.status) {
    params.set("status", query.status);
  }

  const suffix = params.toString();
  return get<EvaluationRunRecord[]>(
    `/evaluation/runs${suffix ? `?${suffix}` : ""}`,
  );
}

export async function getEvaluationRun(
  runId: string,
): Promise<EvaluationRunRecord> {
  return get<EvaluationRunRecord>(`/evaluation/runs/${runId}`);
}

export async function deleteEvaluationRun(
  runId: string,
): Promise<DeleteEvaluationRunResponse> {
  return del<DeleteEvaluationRunResponse>(`/evaluation/runs/${runId}`);
}

export async function deleteEvaluationRuns(
  runIds: string[],
): Promise<DeleteEvaluationRunsResponse> {
  return post<DeleteEvaluationRunsResponse>("/evaluation/runs/batch-delete", {
    runIds,
  });
}
