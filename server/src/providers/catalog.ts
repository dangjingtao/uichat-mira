import type {
  ModelType,
  ProviderCode,
  ProviderTemplateCode,
} from "@/db/schema.js";
import {
  PROVIDER_CODE_VALUES,
  PROVIDER_TEMPLATE_CODE_VALUES,
} from "@/providers/codes.js";

export const CLOUDFLARE_ACCOUNT_BASE_URL_GUIDE =
  "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai";

export type ProviderSyncAdapter =
  | "ollama"
  | "openai-compatible"
  | "cloudflare";
export type ProviderChatAdapter = "ollama" | "openai-compatible";
export type ProviderEmbeddingAdapter =
  | "ollama"
  | "openai-compatible"
  | "cloudflare";
export type ProviderRerankAdapter = "openai-compatible" | "none";
export type ProviderImageAdapter = "openai-images" | "none";

export interface ProviderCapabilitySummary {
  syncAdapter: ProviderSyncAdapter;
  chatAdapter: ProviderChatAdapter;
  embeddingAdapter: ProviderEmbeddingAdapter;
  rerankAdapter: ProviderRerankAdapter;
  imageAdapter: ProviderImageAdapter;
  supportsRoles: ModelType[];
}

export interface ProviderDefinition {
  code: ProviderTemplateCode;
  displayName: string;
  defaultBaseUrl: string;
  syncAdapter: ProviderSyncAdapter;
  chatAdapter: ProviderChatAdapter;
  embeddingAdapter: ProviderEmbeddingAdapter;
  rerankAdapter: ProviderRerankAdapter;
  imageAdapter: ProviderImageAdapter;
  callableModelIdPrefix?: string;
}

export const PROVIDER_CODE_ENUM = PROVIDER_CODE_VALUES;
export const PROVIDER_TEMPLATE_CODE_ENUM = PROVIDER_TEMPLATE_CODE_VALUES;

export const PROVIDER_DEFINITIONS = {
  ollama: {
    code: "ollama",
    displayName: "Ollama",
    defaultBaseUrl: "http://localhost:11434",
    syncAdapter: "ollama",
    chatAdapter: "ollama",
    embeddingAdapter: "ollama",
    rerankAdapter: "none",
    imageAdapter: "none",
  },
  lmstudio: {
    code: "lmstudio",
    displayName: "LM Studio",
    defaultBaseUrl: "http://127.0.0.1:1234/v1",
    syncAdapter: "openai-compatible",
    chatAdapter: "openai-compatible",
    embeddingAdapter: "openai-compatible",
    rerankAdapter: "none",
    imageAdapter: "none",
  },
  openai: {
    code: "openai",
    displayName: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    syncAdapter: "openai-compatible",
    chatAdapter: "openai-compatible",
    embeddingAdapter: "openai-compatible",
    rerankAdapter: "none",
    imageAdapter: "openai-images",
  },
  google: {
    code: "google",
    displayName: "Google Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    syncAdapter: "openai-compatible",
    chatAdapter: "openai-compatible",
    embeddingAdapter: "openai-compatible",
    rerankAdapter: "none",
    imageAdapter: "none",
  },
  cloudflare: {
    code: "cloudflare",
    displayName: "Cloudflare",
    defaultBaseUrl:
      "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai/v1",
    syncAdapter: "cloudflare",
    chatAdapter: "openai-compatible",
    embeddingAdapter: "cloudflare",
    rerankAdapter: "none",
    imageAdapter: "none",
    callableModelIdPrefix: "@cf/",
  },
  volcengine: {
    code: "volcengine",
    displayName: "OpenAI兼容服务商",
    defaultBaseUrl: "http://localhost:9997",
    syncAdapter: "openai-compatible",
    chatAdapter: "openai-compatible",
    embeddingAdapter: "openai-compatible",
    rerankAdapter: "openai-compatible",
    imageAdapter: "openai-images",
  },
  "openai-compatible-custom": {
    code: "openai-compatible-custom",
    displayName: "Custom OpenAI-Compatible",
    defaultBaseUrl: "https://api.example.com/v1",
    syncAdapter: "openai-compatible",
    chatAdapter: "openai-compatible",
    embeddingAdapter: "openai-compatible",
    rerankAdapter: "openai-compatible",
    imageAdapter: "openai-images",
  },
} satisfies Record<ProviderTemplateCode, ProviderDefinition>;

export const DEFAULT_PROVIDER_CONNECTIONS = PROVIDER_CODE_ENUM.map((code) => ({
  id: code,
  templateCode: code,
  providerCode: code,
  displayName: PROVIDER_DEFINITIONS[code].displayName,
  baseUrl: PROVIDER_DEFINITIONS[code].defaultBaseUrl,
})) as Array<{
  id: string;
  templateCode: ProviderTemplateCode;
  providerCode: ProviderCode;
  displayName: string;
  baseUrl: string;
}>;

export const providerCodeSchema = {
  type: "string",
  enum: PROVIDER_CODE_ENUM,
} as const;

export const proxyProviderEnum = ["default", ...PROVIDER_CODE_ENUM] as const;

export const proxyProviderSchema = {
  type: "string",
  enum: proxyProviderEnum,
} as const;

export const getProviderDefinition = (
  providerCode: ProviderCode,
): ProviderDefinition => PROVIDER_DEFINITIONS[providerCode];

export const getProviderTemplateDefinition = (
  templateCode: ProviderTemplateCode,
): ProviderDefinition => PROVIDER_DEFINITIONS[templateCode];

export const getProviderDisplayName = (providerCode: ProviderCode) =>
  getProviderDefinition(providerCode).displayName;

export const getProviderDefaultBaseUrl = (providerCode: ProviderCode) =>
  getProviderDefinition(providerCode).defaultBaseUrl;

export const getProviderCapabilities = (
  providerCode: ProviderTemplateCode,
): ProviderCapabilitySummary => {
  const definition = getProviderTemplateDefinition(providerCode);
  const supportsRoles: ModelType[] = [
    "llm",
    "task",
    "agentTask",
    "evaluation",
    "embedding",
    "voice",
  ];

  if (definition.rerankAdapter !== "none") {
    supportsRoles.push("rerank");
  }

  if (definition.imageAdapter !== "none") {
    supportsRoles.push("imageGeneration");
  }

  return {
    syncAdapter: definition.syncAdapter,
    chatAdapter: definition.chatAdapter,
    embeddingAdapter: definition.embeddingAdapter,
    rerankAdapter: definition.rerankAdapter,
    imageAdapter: definition.imageAdapter,
    supportsRoles,
  };
};

export const supportsRoleForProvider = (
  providerCode: ProviderTemplateCode,
  roleType: ModelType,
) => getProviderCapabilities(providerCode).supportsRoles.includes(roleType);

export const requiresCallableModelId = (providerCode: ProviderCode) =>
  Boolean(getProviderDefinition(providerCode).callableModelIdPrefix);

export const isCallableModelId = (
  providerCode: ProviderCode,
  modelId: string,
) => {
  const prefix = getProviderDefinition(providerCode).callableModelIdPrefix;
  return prefix ? modelId.startsWith(prefix) : true;
};
