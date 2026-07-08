export type StudioMode = "prompt" | "workflow";

export type StudioProvider =
  | "openai-images"
  | "wanx"
  | "hunyuan"
  | "comfyui-local";

export type StudioPageStatus =
  | "initial-loading"
  | "ready"
  | "submitting"
  | "polling"
  | "terminal-success"
  | "terminal-failed";

export type StudioFormStatus =
  | "clean"
  | "dirty"
  | "invalid"
  | "locked-by-running-job";

export type StudioPreviewStatus =
  | "empty"
  | "preview-loading"
  | "preview-ready"
  | "preview-failed";

export type StudioTaskStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "blocked";

export type WorkflowJsonStatus =
  | "empty"
  | "valid"
  | "invalid-json"
  | "invalid-comfyui-format";

export type StudioLogLevel = "info" | "success" | "warning" | "danger";

export type ProviderOption = {
  value: StudioProvider;
  labelKey: string;
  descriptionKey: string;
};

export type PromptFormValue = {
  prompt: string;
  negativePrompt: string;
  size: string;
  stylePreset: string;
  seed: string;
  model: string;
  providerParam: string;
};

export type WorkflowFormValue = {
  workflowJson: string;
  overridePrompt: string;
  overrideSeed: string;
  overrideSize: string;
};

export type StudioLogEntry = {
  id: string;
  at: string;
  stageKey: string;
  detailKey: string;
  level: StudioLogLevel;
};

export type ResultMetadata = {
  width: number;
  height: number;
  source: "base64" | "remote-url recovered" | "local-file";
  generatedAt: string;
  providerJobId: string;
  artifactId: string;
  previewSrc: string;
  artifactFileName?: string;
  previewUnavailableReason?: string;
  failureSummary?: string;
  errorMessage?: string;
};

export type SubmittedSnapshot = {
  mode: StudioMode;
  provider: StudioProvider;
  model: string;
  promptSummary: string;
  workflowSummary: string;
  size: string;
  stylePreset: string;
  seed: string;
  providerParam: string;
  overridePrompt: string;
  overrideSeed: string;
  overrideSize: string;
};

export const providerOptions: ProviderOption[] = [
  {
    value: "openai-images",
    labelKey: "settings.microApps.imageGenerationStudio.providers.openaiImages.label",
    descriptionKey:
      "settings.microApps.imageGenerationStudio.providers.openaiImages.description",
  },
  {
    value: "wanx",
    labelKey: "settings.microApps.imageGenerationStudio.providers.wanx.label",
    descriptionKey:
      "settings.microApps.imageGenerationStudio.providers.wanx.description",
  },
  {
    value: "hunyuan",
    labelKey: "settings.microApps.imageGenerationStudio.providers.hunyuan.label",
    descriptionKey:
      "settings.microApps.imageGenerationStudio.providers.hunyuan.description",
  },
  {
    value: "comfyui-local",
    labelKey:
      "settings.microApps.imageGenerationStudio.providers.comfyUiLocal.label",
    descriptionKey:
      "settings.microApps.imageGenerationStudio.providers.comfyUiLocal.description",
  },
];

export const promptProviderOptions = providerOptions;

export const workflowProviderOptions = providerOptions.filter(
  (option) => option.value === "comfyui-local",
);

export const sizeOptions = [
  { value: "1024x1024", labelKey: "settings.microApps.imageGenerationStudio.sizes.square" },
  { value: "1536x1024", labelKey: "settings.microApps.imageGenerationStudio.sizes.landscape" },
  { value: "1024x1536", labelKey: "settings.microApps.imageGenerationStudio.sizes.portrait" },
];

export const stylePresetOptions = [
  { value: "none", labelKey: "settings.microApps.imageGenerationStudio.styles.none" },
  { value: "cinematic", labelKey: "settings.microApps.imageGenerationStudio.styles.cinematic" },
  { value: "product", labelKey: "settings.microApps.imageGenerationStudio.styles.product" },
  { value: "illustration", labelKey: "settings.microApps.imageGenerationStudio.styles.illustration" },
];

export const taskStatusOrder: StudioTaskStatus[] = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "blocked",
];

export const defaultPromptForm: PromptFormValue = {
  prompt: "",
  negativePrompt: "",
  size: "1024x1024",
  stylePreset: "none",
  seed: "",
  model: "gpt-image-1",
  providerParam: "",
};

export const defaultWorkflowForm: WorkflowFormValue = {
  workflowJson: "",
  overridePrompt: "",
  overrideSeed: "",
  overrideSize: "1024x1024",
};
