import { get, post } from "@/shared/lib/request";

const IMAGE_GENERATION_ROUTE = "/microapps/image-generation/generations";

export type ImageGenerationExecutionKind =
  | "sync-http"
  | "async-job"
  | "workflow-runner";

export type ImageGenerationJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "blocked";

export type ImageGenerationArtifactSource =
  | "base64"
  | "remote-url"
  | "local-file";

export type ImageGenerationArtifactType = "image";

export type ImageGenerationInputFileRole = "image" | "mask" | "reference";

export interface ImageGenerationInputFileReference {
  fileId: string;
  role: ImageGenerationInputFileRole;
}

export interface ImageGenerationCreateRequest {
  providerId: string;
  model?: string;
  prompt?: string;
  negativePrompt?: string;
  size?: string;
  stylePreset?: string;
  count?: number;
  seed?: number;
  providerParams?: Record<string, unknown>;
  workflowApiJson?: Record<string, unknown>;
  inputFiles?: ImageGenerationInputFileReference[];
}

export interface ImageGenerationRequestSummary {
  providerId: string;
  model?: string;
  prompt?: string;
  negativePrompt?: string;
  size?: string;
  stylePreset?: string;
  count?: number;
  seed?: number;
  providerParamKeys: string[];
  inputFileCount: number;
  hasWorkflowApiJson: boolean;
}

export interface ImageGenerationArtifactSummary {
  id: string;
  type: ImageGenerationArtifactType;
  mimeType: string;
  source: ImageGenerationArtifactSource;
  localPath?: string;
  remoteUrl?: string;
  expiresAt?: string;
  width?: number;
  height?: number;
  byteSize?: number;
  fileName?: string;
  meta?: Record<string, unknown>;
}

export interface ImageGenerationJobError {
  code: string;
  message: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
}

export interface ImageGenerationJob {
  id: string;
  providerId: string;
  executionKind: ImageGenerationExecutionKind;
  status: ImageGenerationJobStatus;
  requestSummary: ImageGenerationRequestSummary;
  artifacts: ImageGenerationArtifactSummary[];
  providerJobId?: string;
  error?: ImageGenerationJobError;
  meta?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface GetImageGenerationOptions {
  refresh?: boolean;
}

export async function createImageGeneration(
  payload: ImageGenerationCreateRequest,
): Promise<ImageGenerationJob> {
  return post<ImageGenerationJob>(IMAGE_GENERATION_ROUTE, payload);
}

export async function getImageGeneration(
  generationId: string,
  options?: GetImageGenerationOptions,
): Promise<ImageGenerationJob> {
  return get<ImageGenerationJob>(
    `${IMAGE_GENERATION_ROUTE}/${encodeURIComponent(generationId)}`,
    options?.refresh === undefined
      ? undefined
      : {
          params: {
            refresh: String(options.refresh),
          },
        },
  );
}
