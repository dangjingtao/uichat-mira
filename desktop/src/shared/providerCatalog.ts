export const PROVIDER_CODES = [
  "ollama",
  "lmstudio",
  "openai",
  "google",
  "cloudflare",
  "volcengine",
] as const;

export type BuiltinProviderCode = (typeof PROVIDER_CODES)[number];
export type ProviderCode = string;

export const DEFAULT_PROVIDER_CODE = "ollama";

export const PROVIDER_LABELS: Record<BuiltinProviderCode, string> = {
  ollama: "Ollama",
  lmstudio: "LM Studio",
  openai: "OpenAI",
  google: "Google Gemini",
  cloudflare: "Cloudflare",
  volcengine: "火山引擎",
};

export const getProviderLabel = (providerCode: ProviderCode) =>
  PROVIDER_LABELS[providerCode as BuiltinProviderCode] ?? providerCode;
