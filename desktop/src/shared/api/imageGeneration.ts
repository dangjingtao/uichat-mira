import { get, post } from "@/shared/lib/request";
import { client } from "@/shared/lib/request";
import { getSession } from "@/shared/lib/sessionStorage";
import { getApiBaseUrl } from "@/shared/platform/desktopRuntime";

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
  publicUrl?: string;
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
  generationId: string;
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

export interface ImageGenerationProgressSnapshot {
  generationId: string;
  providerJobId?: string;
  status: ImageGenerationJobStatus;
  stage: string;
  progressPercent: number;
  message?: string;
  updatedAt: string;
}

export async function createImageGeneration(
  payload: ImageGenerationCreateRequest,
): Promise<ImageGenerationJob> {
  return post<ImageGenerationJob>(IMAGE_GENERATION_ROUTE, payload, {
    timeout: 0,
  });
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

export async function getImageGenerationProgress(
  generationId: string,
): Promise<ImageGenerationProgressSnapshot> {
  return get<ImageGenerationProgressSnapshot>(
    `${IMAGE_GENERATION_ROUTE}/${encodeURIComponent(generationId)}/progress`,
  );
}

export function getImageGenerationArtifactContentUrl(
  generationId: string,
  artifactId: string,
) {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${IMAGE_GENERATION_ROUTE}/${encodeURIComponent(generationId)}/artifacts/${encodeURIComponent(artifactId)}/content`;
}

export async function getImageGenerationArtifactPreviewUrl(
  generationId: string,
  artifactId: string,
) {
  const response = await client.get<Blob>(
    getImageGenerationArtifactContentUrl(generationId, artifactId),
    {
      responseType: "blob",
    },
  );

  return URL.createObjectURL(response.data);
}

export function getImageGenerationRealtimeUrl(generationId: string) {
  const baseUrl = getApiBaseUrl();
  const token = getSession()?.token ?? "";
  const routePath = `${IMAGE_GENERATION_ROUTE}/${encodeURIComponent(generationId)}/events`;
  const normalizedBase = baseUrl.replace(/\/+$/, "");

  if (/^https?:\/\//i.test(normalizedBase)) {
    const wsBase = normalizedBase.replace(/^http/i, "ws");
    return `${wsBase}${routePath}?token=${encodeURIComponent(token)}`;
  }

  const protocol = globalThis.window?.location?.protocol === "https:" ? "wss:" : "ws:";
  const host = globalThis.window?.location?.host;
  if (!host) {
    throw new Error("Unable to resolve the desktop renderer host");
  }
  return `${protocol}//${host}${normalizedBase}${routePath}?token=${encodeURIComponent(token)}`;
}
