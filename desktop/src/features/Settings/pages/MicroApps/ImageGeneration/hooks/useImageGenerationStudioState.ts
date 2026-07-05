import { useEffect, useMemo, useRef, useState } from "react";
import {
  createImageGeneration,
  getImageGeneration,
  type ImageGenerationArtifactSummary,
  type ImageGenerationCreateRequest,
  type GetImageGenerationOptions,
  type ImageGenerationJobError,
  type ImageGenerationJobStatus,
  type ImageGenerationRequestSummary,
} from "@/shared/api/imageGeneration";
import type {
  PromptFormValue,
  ResultMetadata,
  StudioFormStatus,
  StudioLogEntry,
  StudioPageStatus,
  StudioPreviewStatus,
  StudioProvider,
  StudioTaskStatus,
  SubmittedSnapshot,
  StudioMode,
  WorkflowFormValue,
  WorkflowJsonStatus,
} from "../model/view-model";
import {
  defaultPromptForm,
  defaultWorkflowForm,
} from "../model/view-model";

type ImageGenerationStudioApi = {
  createImageGeneration: typeof createImageGeneration;
  getImageGeneration: typeof getImageGeneration;
};

type NormalizedGenerationJob = {
  generationId: string;
  status: ImageGenerationJobStatus;
  executionKind: string;
  artifacts: ImageGenerationArtifactSummary[];
  requestSummary: ImageGenerationRequestSummary;
  providerJobId?: string;
  error?: ImageGenerationJobError;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  meta?: Record<string, unknown>;
};

const defaultApi: ImageGenerationStudioApi = {
  createImageGeneration,
  getImageGeneration,
};

const providerIdMap: Record<StudioProvider, string> = {
  "openai-images": "openai_images",
  wanx: "aliyun_wanx",
  hunyuan: "tencent_hunyuan",
  "comfyui-local": "comfyui_local",
};

const terminalStatuses: StudioTaskStatus[] = [
  "succeeded",
  "failed",
  "cancelled",
  "blocked",
];

const pollingStatuses: StudioTaskStatus[] = ["queued", "running"];

const isComfyUiApiFormat = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value as Record<string, unknown>).some((node) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      return false;
    }

    return (
      "class_type" in (node as Record<string, unknown>) &&
      "inputs" in (node as Record<string, unknown>)
    );
  });
};

const getWorkflowJsonStatus = (workflowJson: string): WorkflowJsonStatus => {
  const trimmed = workflowJson.trim();
  if (!trimmed) {
    return "empty";
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return isComfyUiApiFormat(parsed) ? "valid" : "invalid-comfyui-format";
  } catch {
    return "invalid-json";
  }
};

const createSnapshot = (
  mode: StudioMode,
  provider: StudioProvider,
  promptForm: PromptFormValue,
  workflowForm: WorkflowFormValue,
): SubmittedSnapshot => ({
  mode,
  provider,
  model: promptForm.model.trim() || "gpt-image-1",
  promptSummary: promptForm.prompt.trim(),
  workflowSummary: workflowForm.workflowJson.trim().slice(0, 140),
  size: promptForm.size,
  stylePreset: promptForm.stylePreset,
  seed:
    mode === "prompt"
      ? promptForm.seed.trim()
      : workflowForm.overrideSeed.trim(),
  providerParam: promptForm.providerParam.trim(),
  overridePrompt: workflowForm.overridePrompt.trim(),
  overrideSeed: workflowForm.overrideSeed.trim(),
});

const buildSignature = (
  mode: StudioMode,
  provider: StudioProvider,
  promptForm: PromptFormValue,
  workflowForm: WorkflowFormValue,
) => JSON.stringify(createSnapshot(mode, provider, promptForm, workflowForm));

const createLogEntry = (
  index: number,
  stageKey: string,
  detailKey: string,
  level: StudioLogEntry["level"],
): StudioLogEntry => ({
  id: `log-${index}`,
  at: new Date().toISOString(),
  stageKey,
  detailKey,
  level,
});

const normalizeTaskStatus = (
  status: string | undefined,
): StudioTaskStatus | null => {
  switch (status) {
    case "queued":
    case "running":
    case "succeeded":
    case "failed":
    case "cancelled":
    case "blocked":
      return status;
    default:
      return null;
  }
};

const normalizeGenerationJob = (value: unknown): NormalizedGenerationJob => {
  const raw = value as Record<string, unknown>;
  const generationId = String(raw.generationId ?? raw.id ?? "");
  const status = normalizeTaskStatus(String(raw.status ?? "")) ?? "failed";
  const requestSummary = (raw.requestSummary ?? {}) as ImageGenerationRequestSummary;
  const artifacts = Array.isArray(raw.artifacts)
    ? (raw.artifacts as ImageGenerationArtifactSummary[])
    : [];

  return {
    generationId,
    status,
    executionKind: String(raw.executionKind ?? ""),
    artifacts,
    requestSummary,
    providerJobId:
      typeof raw.providerJobId === "string" ? raw.providerJobId : undefined,
    error:
      raw.error && typeof raw.error === "object"
        ? (raw.error as ImageGenerationJobError)
        : undefined,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
    startedAt: typeof raw.startedAt === "string" ? raw.startedAt : undefined,
    completedAt:
      typeof raw.completedAt === "string" ? raw.completedAt : undefined,
    meta:
      raw.meta && typeof raw.meta === "object"
        ? (raw.meta as Record<string, unknown>)
        : undefined,
  };
};

const parseProviderParams = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        raw: trimmed,
      };
    }
    return parsed as Record<string, unknown>;
  } catch {
    return {
      raw: trimmed,
    };
  }
};

const buildRequestPayload = (
  mode: StudioMode,
  provider: StudioProvider,
  promptForm: PromptFormValue,
  workflowForm: WorkflowFormValue,
): ImageGenerationCreateRequest => {
  const providerId = providerIdMap[provider];
  const model = promptForm.model.trim() || undefined;
  const seedValue =
    mode === "prompt" ? promptForm.seed.trim() : workflowForm.overrideSeed.trim();
  const parsedSeed =
    seedValue.length > 0 && !Number.isNaN(Number(seedValue))
      ? Number(seedValue)
      : undefined;

  if (mode === "workflow") {
    return {
      providerId,
      model,
      workflowApiJson: JSON.parse(workflowForm.workflowJson) as Record<
        string,
        unknown
      >,
      prompt: workflowForm.overridePrompt.trim() || undefined,
      seed: parsedSeed,
    };
  }

  return {
    providerId,
    model,
    prompt: promptForm.prompt.trim(),
    negativePrompt: promptForm.negativePrompt.trim() || undefined,
    size: promptForm.size,
    stylePreset:
      promptForm.stylePreset === "none" ? undefined : promptForm.stylePreset,
    count: 1,
    seed: parsedSeed,
    providerParams: parseProviderParams(promptForm.providerParam),
  };
};

const normalizeFilePath = (value: string) => value.replace(/\\/g, "/");

const resolveLocalFilePreviewSrc = (localPath: string) => {
  const normalizedPath = normalizeFilePath(localPath.trim());
  if (!normalizedPath) {
    return "";
  }

  if (/^[a-zA-Z]:\//.test(normalizedPath)) {
    return encodeURI(`file:///${normalizedPath}`);
  }

  if (normalizedPath.startsWith("/")) {
    return encodeURI(`file://${normalizedPath}`);
  }

  return encodeURI(`file:///${normalizedPath.replace(/^\.\/?/, "")}`);
};

const resolveArtifactPreviewSrc = (
  artifact: ImageGenerationArtifactSummary | undefined,
) => {
  if (!artifact) {
    return "";
  }

  if (artifact.localPath) {
    return resolveLocalFilePreviewSrc(artifact.localPath);
  }

  if (artifact.remoteUrl) {
    return artifact.remoteUrl;
  }

  return "";
};

const derivePreviewState = (
  job: NormalizedGenerationJob,
): { previewStatus: StudioPreviewStatus; result: ResultMetadata | null } => {
  if (job.status === "queued" || job.status === "running") {
    return {
      previewStatus: "preview-loading",
      result: null,
    };
  }

  const primaryArtifact = job.artifacts[0];
  const previewSrc = resolveArtifactPreviewSrc(primaryArtifact);

  if (job.status === "succeeded") {
    if (!primaryArtifact) {
      return {
        previewStatus: "preview-ready",
        result: {
          width: 0,
          height: 0,
          source: "base64",
          generatedAt: job.completedAt ?? job.updatedAt,
          providerJobId:
            job.providerJobId ??
            "settings.microApps.imageGenerationStudio.summary.pending",
          artifactId:
            "settings.microApps.imageGenerationStudio.summary.pending",
          previewSrc: "",
          artifactFileName: undefined,
          previewUnavailableReason:
            "settings.microApps.imageGenerationStudio.results.previewUnavailableNoArtifact",
          errorMessage: undefined,
        },
      };
    }

    return {
      previewStatus: "preview-ready",
      result: {
        width: primaryArtifact.width ?? 0,
        height: primaryArtifact.height ?? 0,
        source:
          primaryArtifact.source === "remote-url"
            ? "remote-url recovered"
            : primaryArtifact.source,
        generatedAt: job.completedAt ?? job.updatedAt,
        providerJobId:
          job.providerJobId ??
          "settings.microApps.imageGenerationStudio.summary.pending",
        artifactId: primaryArtifact.id,
        previewSrc,
        artifactFileName: primaryArtifact.fileName,
        previewUnavailableReason: previewSrc
          ? undefined
          : "settings.microApps.imageGenerationStudio.results.previewUnavailableNoUrl",
        errorMessage: undefined,
      },
    };
  }

  return {
    previewStatus: "preview-failed",
    result: {
      width: primaryArtifact?.width ?? 0,
      height: primaryArtifact?.height ?? 0,
      source:
        primaryArtifact?.source === "remote-url"
          ? "remote-url recovered"
          : primaryArtifact?.source ?? "base64",
      generatedAt: job.completedAt ?? job.updatedAt,
      providerJobId:
        job.providerJobId ??
        "settings.microApps.imageGenerationStudio.summary.pending",
      artifactId:
        primaryArtifact?.id ??
        "settings.microApps.imageGenerationStudio.summary.pending",
      previewSrc: "",
      artifactFileName: primaryArtifact?.fileName,
      previewUnavailableReason: undefined,
      failureSummary:
        job.status === "blocked"
          ? "settings.microApps.imageGenerationStudio.results.blockedSummary"
          : "settings.microApps.imageGenerationStudio.results.failedSummary",
      errorMessage: job.error?.message,
    },
  };
};

const derivePageStatus = (status: StudioTaskStatus | null): StudioPageStatus => {
  if (status === "queued") {
    return "submitting";
  }
  if (status === "running") {
    return "polling";
  }
  if (status === "succeeded") {
    return "terminal-success";
  }
  if (status === "failed" || status === "blocked" || status === "cancelled") {
    return "terminal-failed";
  }
  return "ready";
};

const detailKeyByStatus: Record<StudioTaskStatus, string> = {
  queued: "settings.microApps.imageGenerationStudio.logs.submissionQueued",
  running: "settings.microApps.imageGenerationStudio.logs.runningDetail",
  succeeded: "settings.microApps.imageGenerationStudio.logs.resultSucceeded",
  failed: "settings.microApps.imageGenerationStudio.logs.resultFailed",
  cancelled: "settings.microApps.imageGenerationStudio.logs.cancelUnavailable",
  blocked: "settings.microApps.imageGenerationStudio.logs.resultBlocked",
};

const levelByStatus: Record<StudioTaskStatus, StudioLogEntry["level"]> = {
  queued: "info",
  running: "info",
  succeeded: "success",
  failed: "danger",
  cancelled: "warning",
  blocked: "warning",
};

export function useImageGenerationStudioState(api: ImageGenerationStudioApi = defaultApi) {
  const [mode, setMode] = useState<StudioMode>("prompt");
  const [provider, setProvider] = useState<StudioProvider>("openai-images");
  const [promptForm, setPromptForm] = useState<PromptFormValue>(defaultPromptForm);
  const [workflowForm, setWorkflowForm] =
    useState<WorkflowFormValue>(defaultWorkflowForm);
  const [pageStatus, setPageStatus] =
    useState<StudioPageStatus>("initial-loading");
  const [previewStatus, setPreviewStatus] =
    useState<StudioPreviewStatus>("empty");
  const [taskStatus, setTaskStatus] = useState<StudioTaskStatus | null>(null);
  const [submittedSnapshot, setSubmittedSnapshot] =
    useState<SubmittedSnapshot | null>(null);
  const [result, setResult] = useState<ResultMetadata | null>(null);
  const [logs, setLogs] = useState<StudioLogEntry[]>([]);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);
  const promptProviderRef = useRef<StudioProvider>("openai-images");
  const lastSubmittedSignatureRef = useRef<string | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const lastLoggedStatusRef = useRef<StudioTaskStatus | null>(null);

  const workflowJsonStatus = useMemo(
    () => getWorkflowJsonStatus(workflowForm.workflowJson),
    [workflowForm.workflowJson],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPageStatus("ready");
    }, 0);

    return () => {
      window.clearTimeout(timer);
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current);
      }
    };
  }, []);

  const promptValid = promptForm.prompt.trim().length > 0;
  const workflowValid = workflowJsonStatus === "valid";
  const isRunning = pageStatus === "submitting" || pageStatus === "polling";
  const currentSignature = buildSignature(
    mode,
    provider,
    promptForm,
    workflowForm,
  );

  const formStatus = useMemo<StudioFormStatus>(() => {
    if (isRunning) {
      return "locked-by-running-job";
    }
    if (mode === "prompt" && !promptValid) {
      return "invalid";
    }
    if (mode === "workflow" && !workflowValid) {
      return "invalid";
    }
    if (!lastSubmittedSignatureRef.current) {
      return currentSignature ===
        buildSignature(
          "prompt",
          "openai-images",
          defaultPromptForm,
          defaultWorkflowForm,
        )
        ? "clean"
        : "dirty";
    }
    return currentSignature === lastSubmittedSignatureRef.current
      ? "clean"
      : "dirty";
  }, [currentSignature, isRunning, mode, promptValid, workflowValid]);

  const appendLog = (
    stageKey: string,
    detailKey: string,
    level: StudioLogEntry["level"] = "info",
  ) => {
    setLogs((current) => [
      createLogEntry(current.length + 1, stageKey, detailKey, level),
      ...current,
    ]);
  };

  const applyJobToState = (job: NormalizedGenerationJob) => {
    const nextTaskStatus = normalizeTaskStatus(job.status);
    setGenerationId(job.generationId);
    setTaskStatus(nextTaskStatus);
    setPageStatus(derivePageStatus(nextTaskStatus));
    setApiErrorMessage(job.error?.message ?? null);
    const derived = derivePreviewState(job);
    setPreviewStatus(derived.previewStatus);
    setResult(derived.result);

    if (
      nextTaskStatus &&
      nextTaskStatus !== lastLoggedStatusRef.current
    ) {
      appendLog(
        "settings.microApps.imageGenerationStudio.logs.resultStage",
        detailKeyByStatus[nextTaskStatus],
        levelByStatus[nextTaskStatus],
      );
      lastLoggedStatusRef.current = nextTaskStatus;
    }
  };

  const pollGeneration = async (jobId: string) => {
    try {
      const rawJob = await api.getImageGeneration(
        jobId,
        { refresh: true } satisfies GetImageGenerationOptions,
      );
      const normalizedJob = normalizeGenerationJob(rawJob);
      applyJobToState(normalizedJob);

      if (
        normalizedJob.generationId &&
        pollingStatuses.includes(normalizedJob.status)
      ) {
        pollTimerRef.current = window.setTimeout(() => {
          void pollGeneration(normalizedJob.generationId);
        }, 1200);
      } else {
        pollTimerRef.current = null;
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "settings.microApps.imageGenerationStudio.errors.pollFailed";
      setApiErrorMessage(message);
      setPageStatus("terminal-failed");
      setPreviewStatus("preview-failed");
      setTaskStatus("failed");
      setResult((current) => ({
        width: current?.width ?? 0,
        height: current?.height ?? 0,
        source: current?.source ?? "base64",
        generatedAt: current?.generatedAt ?? new Date().toISOString(),
        providerJobId:
          current?.providerJobId ??
          "settings.microApps.imageGenerationStudio.summary.pending",
        artifactId:
          current?.artifactId ??
          "settings.microApps.imageGenerationStudio.summary.pending",
        previewSrc: current?.previewSrc ?? "",
        artifactFileName: current?.artifactFileName,
        previewUnavailableReason: current?.previewUnavailableReason,
        failureSummary:
          "settings.microApps.imageGenerationStudio.results.failedSummary",
        errorMessage: message,
      }));
      appendLog(
        "settings.microApps.imageGenerationStudio.logs.resultStage",
        "settings.microApps.imageGenerationStudio.logs.pollFailed",
        "danger",
      );
    }
  };

  const setModeWithRules = (nextMode: StudioMode) => {
    setMode(nextMode);
    setResult(null);
    setPreviewStatus("empty");
    setTaskStatus(null);
    setPageStatus("ready");
    setApiErrorMessage(null);

    if (nextMode === "workflow") {
      promptProviderRef.current = provider;
      setProvider("comfyui-local");
      return;
    }

    setProvider(
      promptProviderRef.current === "comfyui-local"
        ? "openai-images"
        : promptProviderRef.current,
    );
  };

  const submit = async () => {
    if (formStatus === "invalid" || isRunning) {
      return;
    }

    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    const snapshot = createSnapshot(mode, provider, promptForm, workflowForm);
    const payload = buildRequestPayload(mode, provider, promptForm, workflowForm);

    lastSubmittedSignatureRef.current = currentSignature;
    setSubmittedSnapshot(snapshot);
    setPageStatus("submitting");
    setPreviewStatus("preview-loading");
    setTaskStatus("queued");
    setResult(null);
    setApiErrorMessage(null);
    appendLog(
      "settings.microApps.imageGenerationStudio.logs.submissionStage",
      "settings.microApps.imageGenerationStudio.logs.submissionQueued",
    );
    lastLoggedStatusRef.current = "queued";

    try {
      const rawJob = await api.createImageGeneration(payload);
      const normalizedJob = normalizeGenerationJob(rawJob);
      applyJobToState(normalizedJob);

      if (
        normalizedJob.generationId &&
        pollingStatuses.includes(normalizedJob.status)
      ) {
        pollTimerRef.current = window.setTimeout(() => {
          void pollGeneration(normalizedJob.generationId);
        }, 1200);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "settings.microApps.imageGenerationStudio.errors.submitFailed";
      setApiErrorMessage(message);
      setPageStatus("terminal-failed");
      setPreviewStatus("preview-failed");
      setTaskStatus("failed");
      setResult({
        width: 0,
        height: 0,
        source: "base64",
        generatedAt: new Date().toISOString(),
        providerJobId:
          "settings.microApps.imageGenerationStudio.summary.pending",
        artifactId: "settings.microApps.imageGenerationStudio.summary.pending",
        previewSrc: "",
        artifactFileName: undefined,
        previewUnavailableReason: undefined,
        failureSummary:
          "settings.microApps.imageGenerationStudio.results.failedSummary",
        errorMessage: message,
      });
      appendLog(
        "settings.microApps.imageGenerationStudio.logs.resultStage",
        "settings.microApps.imageGenerationStudio.logs.submitFailed",
        "danger",
      );
    }
  };

  const cancel = () => {
    appendLog(
      "settings.microApps.imageGenerationStudio.logs.cancelStage",
      "settings.microApps.imageGenerationStudio.logs.cancelUnavailable",
      "warning",
    );
  };

  const reset = () => {
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setMode("prompt");
    setProvider("openai-images");
    promptProviderRef.current = "openai-images";
    setPromptForm(defaultPromptForm);
    setWorkflowForm(defaultWorkflowForm);
    setPageStatus("ready");
    setPreviewStatus("empty");
    setTaskStatus(null);
    setSubmittedSnapshot(null);
    setResult(null);
    setLogs([]);
    setGenerationId(null);
    setApiErrorMessage(null);
    lastSubmittedSignatureRef.current = null;
    lastLoggedStatusRef.current = null;
  };

  return {
    mode,
    provider,
    promptForm,
    workflowForm,
    pageStatus,
    previewStatus,
    taskStatus,
    formStatus,
    workflowJsonStatus,
    submittedSnapshot,
    result,
    logs,
    isRunning,
    generationId,
    apiErrorMessage,
    canCancel: false,
    setMode: setModeWithRules,
    setProvider: (nextProvider: StudioProvider) => {
      if (mode === "workflow") {
        setProvider("comfyui-local");
        return;
      }
      promptProviderRef.current = nextProvider;
      setProvider(nextProvider);
    },
    setPromptForm,
    setWorkflowForm,
    submit,
    cancel,
    reset,
  };
}
