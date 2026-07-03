export const PROVIDER_CODE_VALUES = [
  "ollama",
  "lmstudio",
  "openai",
  "cloudflare",
  "volcengine",
] as const;

export const PROVIDER_STATUS_VALUES = [
  "idle",
  "syncing",
  "connected",
  "error",
] as const;

export type ProviderCodeValue = (typeof PROVIDER_CODE_VALUES)[number];
export type ProviderStatusValue = (typeof PROVIDER_STATUS_VALUES)[number];

export const toSqlEnumValues = (values: readonly string[]) =>
  values.map((value) => `'${value}'`).join(", ");
