export const PROVIDER_CODES = [
  "ollama",
  "lmstudio",
  "openai",
  "cloudflare",
  "volcengine",
] as const;

export type ProviderCode = (typeof PROVIDER_CODES)[number];

export const DEFAULT_PROVIDER_CODE: ProviderCode = "ollama";

export const PROVIDER_LABELS: Record<ProviderCode, string> = {
  ollama: "Ollama",
  lmstudio: "LM Studio",
  openai: "OpenAI",
  cloudflare: "Cloudflare",
  volcengine: "火山引擎",
};

export const getProviderLabel = (providerCode: ProviderCode) =>
  PROVIDER_LABELS[providerCode];
