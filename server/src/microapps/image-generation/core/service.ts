import {
  createImageGenerationJob,
  isTerminalImageGenerationJobStatus,
  transitionImageGenerationJob,
} from "./job-lifecycle.js";
import type {
  ImageGenerationAdapterRunResult,
  ImageGenerationArtifactCandidate,
  ImageGenerationCreateRequest,
  ImageGenerationJob,
  ImageGenerationJobError,
  ImageGenerationJobStore,
  ImageGenerationRequestSummary,
  ImageGenerationServiceDeps,
} from "./types.js";

const defaultNow = () => new Date().toISOString();
const defaultCreateId = () =>
  `imggen_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const summarizeRequest = (
  request: ImageGenerationCreateRequest,
): ImageGenerationRequestSummary => ({
  providerId: request.providerId,
  model: request.model,
  prompt: request.prompt,
  negativePrompt: request.negativePrompt,
  size: request.size,
  stylePreset: request.stylePreset,
  count: request.count,
  seed: request.seed,
  providerParamKeys: Object.keys(request.providerParams ?? {}).sort(),
  inputFileCount: request.inputFiles?.length ?? 0,
  hasWorkflowApiJson: Boolean(request.workflowApiJson),
});

const normalizeUnknownError = (
  error: unknown,
  fallbackCode: string,
): ImageGenerationJobError => {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof error.code === "string" &&
    typeof error.message === "string"
  ) {
    return {
      code: error.code,
      message: error.message,
      retryable:
        "retryable" in error && typeof error.retryable === "boolean"
          ? error.retryable
          : undefined,
      details:
        "details" in error &&
        typeof error.details === "object" &&
        error.details !== null
          ? (error.details as Record<string, unknown>)
          : undefined,
    };
  }

  if (error instanceof Error) {
    return {
      code: fallbackCode,
      message: error.message,
    };
  }

  return {
    code: fallbackCode,
    message: "Unknown image generation failure.",
  };
};

const resolveArtifacts = async (
  deps: ImageGenerationServiceDeps,
  job: ImageGenerationJob,
  artifacts: ImageGenerationArtifactCandidate[] | undefined,
) => {
  if (!artifacts?.length) {
    return job.artifacts;
  }

  return deps.artifactStore.materializeArtifacts({
    job,
    artifacts,
  });
};

export class ImageGenerationProviderNotFoundError extends Error {
  constructor(providerId: string) {
    super(`Image generation provider is not registered: ${providerId}`);
    this.name = "ImageGenerationProviderNotFoundError";
  }
}

export class ImageGenerationJobNotFoundError extends Error {
  constructor(jobId: string) {
    super(`Image generation job was not found: ${jobId}`);
    this.name = "ImageGenerationJobNotFoundError";
  }
}

export class ImageGenerationJobOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageGenerationJobOperationError";
  }
}

export class ImageGenerationRequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageGenerationRequestValidationError";
  }
}

const validateCreateRequest = (request: ImageGenerationCreateRequest) => {
  const hasPrompt = Boolean(request.prompt?.trim());
  const hasWorkflowApiJson = Boolean(request.workflowApiJson);

  if (!hasPrompt && !hasWorkflowApiJson) {
    throw new ImageGenerationRequestValidationError(
      "Image generation request must include either a prompt or workflowApiJson.",
    );
  }
};

export class ImageGenerationService {
  private readonly deps: Required<ImageGenerationServiceDeps>;

  constructor(deps: ImageGenerationServiceDeps) {
    this.deps = {
      ...deps,
      now: deps.now ?? defaultNow,
      createId: deps.createId ?? defaultCreateId,
    };
  }

  async createGeneration(request: ImageGenerationCreateRequest) {
    validateCreateRequest(request);

    const adapter = this.deps.adapterRegistry.getAdapter(request.providerId);
    if (!adapter) {
      throw new ImageGenerationProviderNotFoundError(request.providerId);
    }

    const createdAt = this.deps.now();
    const job = createImageGenerationJob({
      id: this.deps.createId(),
      providerId: request.providerId,
      executionKind: adapter.executionKind,
      requestSummary: summarizeRequest(request),
      createdAt,
    });

    await this.deps.jobStore.create(job);

    return this.runAdapter(job, async () =>
      adapter.startGeneration({
        job,
        request,
        requestSummary: job.requestSummary,
      }),
    );
  }

  async getGeneration(jobId: string) {
    return this.deps.jobStore.getById(jobId);
  }

  async refreshGeneration(jobId: string) {
    const job = await this.requireJob(jobId);
    if (isTerminalImageGenerationJobStatus(job.status)) {
      return job;
    }

    const adapter = this.deps.adapterRegistry.getAdapter(job.providerId);
    if (!adapter) {
      throw new ImageGenerationProviderNotFoundError(job.providerId);
    }
    if (!adapter.getGeneration) {
      return job;
    }

    return this.runAdapter(job, async () => adapter.getGeneration!({ job }));
  }

  async cancelGeneration(jobId: string, reason?: string) {
    const job = await this.requireJob(jobId);
    if (isTerminalImageGenerationJobStatus(job.status)) {
      return job;
    }

    const adapter = this.deps.adapterRegistry.getAdapter(job.providerId);
    if (!adapter) {
      throw new ImageGenerationProviderNotFoundError(job.providerId);
    }
    if (!adapter.cancelGeneration) {
      throw new ImageGenerationJobOperationError(
        `Image generation provider does not support cancellation: ${job.providerId}`,
      );
    }

    return this.runAdapter(job, async () =>
      adapter.cancelGeneration!({
        job,
        reason,
      }),
    );
  }

  private async requireJob(jobId: string) {
    const job = await this.deps.jobStore.getById(jobId);
    if (!job) {
      throw new ImageGenerationJobNotFoundError(jobId);
    }

    return job;
  }

  private async runAdapter(
    job: ImageGenerationJob,
    invoke: () => Promise<ImageGenerationAdapterRunResult>,
  ) {
    try {
      const result = await invoke();
      const artifacts = await resolveArtifacts(this.deps, job, result.artifacts);
      const nextJob = transitionImageGenerationJob(job, result.status, {
        at: this.deps.now(),
        providerJobId: result.providerJobId,
        artifacts,
        error: result.error,
        meta: result.meta,
        clearError: result.status !== "failed" && result.status !== "blocked",
      });

      await this.deps.jobStore.update(nextJob);
      return nextJob;
    } catch (error) {
      const failedJob = transitionImageGenerationJob(job, "failed", {
        at: this.deps.now(),
        error: normalizeUnknownError(error, "IMAGE_GENERATION_EXECUTION_FAILED"),
      });

      await this.deps.jobStore.update(failedJob);
      return failedJob;
    }
  }
}

export const createImageGenerationService = (deps: ImageGenerationServiceDeps) =>
  new ImageGenerationService(deps);

export const createInMemoryImageGenerationJobStore = (): ImageGenerationJobStore => {
  const jobs = new Map<string, ImageGenerationJob>();

  return {
    async create(job) {
      jobs.set(job.id, { ...job });
    },
    async getById(jobId) {
      const job = jobs.get(jobId);
      return job ? { ...job, artifacts: [...job.artifacts] } : null;
    },
    async update(job) {
      jobs.set(job.id, { ...job, artifacts: [...job.artifacts] });
    },
  };
};
