import type { ModelType, ParamType, ProviderCode } from "@/db/schema";

export { DEFAULT_PROVIDER_CONNECTIONS } from "@/providers/catalog.js";

export interface DefaultRoleConfig {
  type: ModelType;
  name: string;
  providerCode: ProviderCode | null;
  remoteModelId: string | null;
  params: Record<string, unknown>;
}

export interface ParamTemplateSeed {
  model_type: ModelType;
  param_key: string;
  param_label: string;
  param_type: ParamType;
  step: number | null;
  options: Array<{ value: string; label: string }> | null;
  default_value: number | string | boolean;
}

export const MANAGED_TASK_PARAMS = {
  enabled: true,
  temperature: 0,
  topP: 1,
  topK: 20,
  maxTokens: 128,
  frequencyPenalty: 0,
  presencePenalty: 0,
} as const;

export const DEFAULT_IMAGE_GENERATION_PARAMS = {
  enabled: true,
} as const;

export const DEFAULT_VOICE_PARAMS = {
  enabled: true,
} as const;

export const DEFAULT_EVALUATION_PARAMS = {
  enabled: true,
  temperature: 0.2,
  topP: 0.9,
  topK: 40,
  maxTokens: 512,
  frequencyPenalty: 0,
  presencePenalty: 0,
} as const;

export const DEFAULT_ROLE_CONFIGS: DefaultRoleConfig[] = [
  {
    type: "llm",
    name: "qwen2.5:latest",
    providerCode: "ollama",
    remoteModelId: "qwen2.5:latest",
    params: {
      enabled: true,
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      maxTokens: 2048,
      frequencyPenalty: 0,
      presencePenalty: 0,
    },
  },
  {
    type: "task",
    name: "qwen2.5:1.5b",
    providerCode: "ollama",
    remoteModelId: "qwen2.5:1.5b",
    params: { ...MANAGED_TASK_PARAMS },
  },
  {
    type: "agentTask",
    name: "",
    providerCode: null,
    remoteModelId: null,
    params: { ...MANAGED_TASK_PARAMS },
  },
  {
    type: "embedding",
    name: "bge-large:latest",
    providerCode: "ollama",
    remoteModelId: "bge-large:latest",
    params: {
      enabled: true,
      dimensions: 768,
      batchSize: 32,
      normalize: true,
      chunkSize: 512,
      chunkOverlap: 64,
    },
  },
  {
    type: "rerank",
    name: "BAAI/bge-reranker-v2-m3",
    providerCode: "volcengine",
    remoteModelId: "BAAI/bge-reranker-v2-m3",
    params: {
      enabled: true,
      topN: 5,
      scoreThreshold: 0.5,
    },
  },
  {
    type: "evaluation",
    name: "",
    providerCode: null,
    remoteModelId: null,
    params: { ...DEFAULT_EVALUATION_PARAMS },
  },
  {
    type: "imageGeneration",
    name: "",
    providerCode: null,
    remoteModelId: null,
    params: { ...DEFAULT_IMAGE_GENERATION_PARAMS },
  },
  {
    type: "voice",
    name: "",
    providerCode: null,
    remoteModelId: null,
    params: { ...DEFAULT_VOICE_PARAMS },
  },
];

export const PARAM_TEMPLATES: ParamTemplateSeed[] = [
  {
    model_type: "llm",
    param_key: "temperature",
    param_label: "Temperature",
    param_type: "number",
    step: 0.1,
    options: null,
    default_value: 0.7,
  },
  {
    model_type: "llm",
    param_key: "topP",
    param_label: "Top P",
    param_type: "number",
    step: 0.1,
    options: null,
    default_value: 0.9,
  },
  {
    model_type: "llm",
    param_key: "topK",
    param_label: "Top K",
    param_type: "number",
    step: null,
    options: null,
    default_value: 40,
  },
  {
    model_type: "llm",
    param_key: "maxTokens",
    param_label: "Max Tokens",
    param_type: "number",
    step: null,
    options: null,
    default_value: 2048,
  },
  {
    model_type: "llm",
    param_key: "frequencyPenalty",
    param_label: "Frequency Penalty",
    param_type: "number",
    step: 0.1,
    options: null,
    default_value: 0,
  },
  {
    model_type: "llm",
    param_key: "presencePenalty",
    param_label: "Presence Penalty",
    param_type: "number",
    step: 0.1,
    options: null,
    default_value: 0,
  },
  {
    model_type: "task",
    param_key: "temperature",
    param_label: "Temperature",
    param_type: "number",
    step: 0.1,
    options: null,
    default_value: 0,
  },
  {
    model_type: "agentTask",
    param_key: "temperature",
    param_label: "Temperature",
    param_type: "number",
    step: 0.1,
    options: null,
    default_value: 0,
  },
  {
    model_type: "agentTask",
    param_key: "topP",
    param_label: "Top P",
    param_type: "number",
    step: 0.1,
    options: null,
    default_value: 1,
  },
  {
    model_type: "agentTask",
    param_key: "topK",
    param_label: "Top K",
    param_type: "number",
    step: null,
    options: null,
    default_value: 20,
  },
  {
    model_type: "agentTask",
    param_key: "maxTokens",
    param_label: "Max Tokens",
    param_type: "number",
    step: null,
    options: null,
    default_value: 128,
  },
  {
    model_type: "agentTask",
    param_key: "frequencyPenalty",
    param_label: "Frequency Penalty",
    param_type: "number",
    step: 0.1,
    options: null,
    default_value: 0,
  },
  {
    model_type: "agentTask",
    param_key: "presencePenalty",
    param_label: "Presence Penalty",
    param_type: "number",
    step: 0.1,
    options: null,
    default_value: 0,
  },
  {
    model_type: "task",
    param_key: "topP",
    param_label: "Top P",
    param_type: "number",
    step: 0.1,
    options: null,
    default_value: 1,
  },
  {
    model_type: "task",
    param_key: "topK",
    param_label: "Top K",
    param_type: "number",
    step: null,
    options: null,
    default_value: 20,
  },
  {
    model_type: "task",
    param_key: "maxTokens",
    param_label: "Max Tokens",
    param_type: "number",
    step: null,
    options: null,
    default_value: 128,
  },
  {
    model_type: "task",
    param_key: "frequencyPenalty",
    param_label: "Frequency Penalty",
    param_type: "number",
    step: 0.1,
    options: null,
    default_value: 0,
  },
  {
    model_type: "task",
    param_key: "presencePenalty",
    param_label: "Presence Penalty",
    param_type: "number",
    step: 0.1,
    options: null,
    default_value: 0,
  },
  {
    model_type: "evaluation",
    param_key: "temperature",
    param_label: "Temperature",
    param_type: "number",
    step: 0.1,
    options: null,
    default_value: 0.2,
  },
  {
    model_type: "evaluation",
    param_key: "topP",
    param_label: "Top P",
    param_type: "number",
    step: 0.1,
    options: null,
    default_value: 0.9,
  },
  {
    model_type: "evaluation",
    param_key: "topK",
    param_label: "Top K",
    param_type: "number",
    step: null,
    options: null,
    default_value: 40,
  },
  {
    model_type: "evaluation",
    param_key: "maxTokens",
    param_label: "Max Tokens",
    param_type: "number",
    step: null,
    options: null,
    default_value: 512,
  },
  {
    model_type: "evaluation",
    param_key: "frequencyPenalty",
    param_label: "Frequency Penalty",
    param_type: "number",
    step: 0.1,
    options: null,
    default_value: 0,
  },
  {
    model_type: "evaluation",
    param_key: "presencePenalty",
    param_label: "Presence Penalty",
    param_type: "number",
    step: 0.1,
    options: null,
    default_value: 0,
  },
  {
    model_type: "embedding",
    param_key: "dimensions",
    param_label: "Dimensions",
    param_type: "number",
    step: null,
    options: null,
    default_value: 768,
  },
  {
    model_type: "embedding",
    param_key: "batchSize",
    param_label: "Batch Size",
    param_type: "number",
    step: null,
    options: null,
    default_value: 32,
  },
  {
    model_type: "embedding",
    param_key: "normalize",
    param_label: "Normalize",
    param_type: "select",
    step: null,
    options: [
      { value: "true", label: "True" },
      { value: "false", label: "False" },
    ],
    default_value: "true",
  },
  {
    model_type: "embedding",
    param_key: "chunkSize",
    param_label: "Chunk Size",
    param_type: "number",
    step: null,
    options: null,
    default_value: 512,
  },
  {
    model_type: "embedding",
    param_key: "chunkOverlap",
    param_label: "Chunk Overlap",
    param_type: "number",
    step: null,
    options: null,
    default_value: 64,
  },
  {
    model_type: "rerank",
    param_key: "topN",
    param_label: "Top N",
    param_type: "number",
    step: null,
    options: null,
    default_value: 5,
  },
  {
    model_type: "rerank",
    param_key: "scoreThreshold",
    param_label: "Score Threshold",
    param_type: "number",
    step: 0.1,
    options: null,
    default_value: 0.5,
  },
  {
    model_type: "imageGeneration",
    param_key: "enabled",
    param_label: "Enabled",
    param_type: "boolean",
    step: null,
    options: null,
    default_value: true,
  },
  {
    model_type: "voice",
    param_key: "enabled",
    param_label: "Enabled",
    param_type: "boolean",
    step: null,
    options: null,
    default_value: true,
  },
];

export const buildDefaultParams = (type: ModelType) => {
  const config = DEFAULT_ROLE_CONFIGS.find((item) => item.type === type);
  return { ...(config?.params ?? {}) };
};
