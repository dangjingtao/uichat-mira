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

export type ImageGenerationInputFileReference = {
  fileId: string;
  role: ImageGenerationInputFileRole;
};

export type ImageGenerationCreateRequest = {
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
};

export type ImageGenerationRequestSummary = {
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
};

export type ImageGenerationArtifactSummary = {
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
};

export type ImageGenerationArtifactCandidate = {
  id?: string;
  type: ImageGenerationArtifactType;
  mimeType: string;
  source: ImageGenerationArtifactSource;
  base64Data?: string;
  localPath?: string;
  remoteUrl?: string;
  expiresAt?: string;
  width?: number;
  height?: number;
  byteSize?: number;
  fileName?: string;
  meta?: Record<string, unknown>;
};

export type ImageGenerationJobError = {
  code: string;
  message: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
};

export type ImageGenerationJob = {
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
};

export type ImageGenerationAdapterRunResult = {
  status: ImageGenerationJobStatus;
  providerJobId?: string;
  artifacts?: ImageGenerationArtifactCandidate[];
  error?: ImageGenerationJobError;
  meta?: Record<string, unknown>;
};

export type ImageGenerationAdapterStartInput = {
  job: ImageGenerationJob;
  request: ImageGenerationCreateRequest;
  requestSummary: ImageGenerationRequestSummary;
};

export type ImageGenerationAdapterGetInput = {
  job: ImageGenerationJob;
};

export type ImageGenerationAdapterCancelInput = {
  job: ImageGenerationJob;
  reason?: string;
};

export interface ImageGenerationProviderAdapter {
  readonly providerId: string;
  readonly executionKind: ImageGenerationExecutionKind;
  startGeneration(
    input: ImageGenerationAdapterStartInput,
  ): Promise<ImageGenerationAdapterRunResult>;
  getGeneration?(
    input: ImageGenerationAdapterGetInput,
  ): Promise<ImageGenerationAdapterRunResult>;
  cancelGeneration?(
    input: ImageGenerationAdapterCancelInput,
  ): Promise<ImageGenerationAdapterRunResult>;
}

export interface ImageGenerationAdapterRegistry {
  getAdapter(providerId: string): ImageGenerationProviderAdapter | null;
}

export interface ImageGenerationArtifactStore {
  materializeArtifacts(input: {
    job: ImageGenerationJob;
    artifacts: ImageGenerationArtifactCandidate[];
  }): Promise<ImageGenerationArtifactSummary[]>;
}

export interface ImageGenerationJobStore {
  create(job: ImageGenerationJob): Promise<void>;
  getById(jobId: string): Promise<ImageGenerationJob | null>;
  update(job: ImageGenerationJob): Promise<void>;
}

export type ImageGenerationServiceDeps = {
  adapterRegistry: ImageGenerationAdapterRegistry;
  artifactStore: ImageGenerationArtifactStore;
  jobStore: ImageGenerationJobStore;
  now?: () => string;
  createId?: () => string;
};
