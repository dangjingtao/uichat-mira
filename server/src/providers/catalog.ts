import type { ProviderCode } from "@/db/schema.js";
import { PROVIDER_CODE_VALUES } from "@/providers/codes.js";

export type ProviderSyncAdapter =
  | "ollama"
  | "openai-compatible"
  | "cloudflare";
export type ProviderChatAdapter = "ollama" | "openai-compatible";
export type ProviderEmbeddingAdapter =
  | "ollama"
  | "openai-compatible"
  | "cloudflare";

export interface ProviderDefinition {
  code: ProviderCode;
  displayName: string;
  defaultBaseUrl: string;
  syncAdapter: ProviderSyncAdapter;
  chatAdapter: ProviderChatAdapter;
  embeddingAdapter: ProviderEmbeddingAdapter;
  callableModelIdPrefix?: string;
}

export const PROVIDER_CODE_ENUM = PROVIDER_CODE_VALUES;

export const PROVIDER_DEFINITIONS = {
  ollama: {
    code: "ollama",
    displayName: "Ollama",
    defaultBaseUrl: "http://localhost:11434",
    syncAdapter: "ollama",
    chatAdapter: "ollama",
    embeddingAdapter: "ollama",
  },
  lmstudio: {
    code: "lmstudio",
    displayName: "LM Studio",
    defaultBaseUrl: "http://127.0.0.1:1234/v1",
    syncAdapter: "openai-compatible",
    chatAdapter: "openai-compatible",
    embeddingAdapter: "openai-compatible",
  },
  openai: {
    code: "openai",
    displayName: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    syncAdapter: "openai-compatible",
    chatAdapter: "openai-compatible",
    embeddingAdapter: "openai-compatible",
  },
  cloudflare: {
    code: "cloudflare",
    displayName: "Cloudflare",
    defaultBaseUrl:
      "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai/v1",
    syncAdapter: "cloudflare",
    chatAdapter: "openai-compatible",
    embeddingAdapter: "cloudflare",
    callableModelIdPrefix: "@cf/",
  },
  volcengine: {
    code: "volcengine",
    displayName: "火山引擎",
    defaultBaseUrl: "https://ark.cn-beijing.volces.com/api/coding/v3",
    syncAdapter: "openai-compatible",
    chatAdapter: "openai-compatible",
    embeddingAdapter: "openai-compatible",
  },
} satisfies Record<ProviderCode, ProviderDefinition>;

export const DEFAULT_PROVIDER_CONNECTIONS = PROVIDER_CODE_ENUM.map((code) => ({
  providerCode: code,
  displayName: PROVIDER_DEFINITIONS[code].displayName,
  baseUrl: PROVIDER_DEFINITIONS[code].defaultBaseUrl,
})) as Array<{
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

export const getProviderDisplayName = (providerCode: ProviderCode) =>
  getProviderDefinition(providerCode).displayName;

export const getProviderDefaultBaseUrl = (providerCode: ProviderCode) =>
  getProviderDefinition(providerCode).defaultBaseUrl;

export const requiresCallableModelId = (providerCode: ProviderCode) =>
  Boolean(getProviderDefinition(providerCode).callableModelIdPrefix);

export const isCallableModelId = (
  providerCode: ProviderCode,
  modelId: string,
) => {
  const prefix = getProviderDefinition(providerCode).callableModelIdPrefix;
  return prefix ? modelId.startsWith(prefix) : true;
};
