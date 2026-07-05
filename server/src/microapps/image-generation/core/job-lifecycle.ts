import type {
  ImageGenerationArtifactSummary,
  ImageGenerationExecutionKind,
  ImageGenerationJob,
  ImageGenerationJobError,
  ImageGenerationJobStatus,
  ImageGenerationRequestSummary,
} from "./types.js";

const terminalStatuses = new Set<ImageGenerationJobStatus>([
  "succeeded",
  "failed",
  "cancelled",
  "blocked",
]);

const transitionMap: Record<
  ImageGenerationJobStatus,
  ReadonlySet<ImageGenerationJobStatus>
> = {
  queued: new Set(["running", "succeeded", "failed", "cancelled", "blocked"]),
  running: new Set(["succeeded", "failed", "cancelled", "blocked"]),
  succeeded: new Set(),
  failed: new Set(),
  cancelled: new Set(),
  blocked: new Set(),
};

export const isTerminalImageGenerationJobStatus = (
  status: ImageGenerationJobStatus,
) => terminalStatuses.has(status);

export const canTransitionImageGenerationJobStatus = (
  from: ImageGenerationJobStatus,
  to: ImageGenerationJobStatus,
) => from === to || transitionMap[from].has(to);

export const createImageGenerationJob = (input: {
  id: string;
  providerId: string;
  executionKind: ImageGenerationExecutionKind;
  requestSummary: ImageGenerationRequestSummary;
  createdAt: string;
}): ImageGenerationJob => ({
  id: input.id,
  providerId: input.providerId,
  executionKind: input.executionKind,
  status: "queued",
  requestSummary: input.requestSummary,
  artifacts: [],
  createdAt: input.createdAt,
  updatedAt: input.createdAt,
});

export const transitionImageGenerationJob = (
  job: ImageGenerationJob,
  nextStatus: ImageGenerationJobStatus,
  options: {
    at: string;
    providerJobId?: string;
    artifacts?: ImageGenerationArtifactSummary[];
    error?: ImageGenerationJobError;
    meta?: Record<string, unknown>;
    clearError?: boolean;
  },
): ImageGenerationJob => {
  if (!canTransitionImageGenerationJobStatus(job.status, nextStatus)) {
    throw new Error(
      `Invalid image generation job status transition: ${job.status} -> ${nextStatus}`,
    );
  }

  const nextJob: ImageGenerationJob = {
    ...job,
    status: nextStatus,
    updatedAt: options.at,
    providerJobId: options.providerJobId ?? job.providerJobId,
    artifacts: options.artifacts ?? job.artifacts,
    meta: options.meta === undefined ? job.meta : { ...job.meta, ...options.meta },
    error: options.clearError ? undefined : options.error ?? job.error,
  };

  if (nextStatus === "running" && !nextJob.startedAt) {
    nextJob.startedAt = options.at;
  }

  if (isTerminalImageGenerationJobStatus(nextStatus) && !nextJob.completedAt) {
    nextJob.completedAt = options.at;
  }

  return nextJob;
};
