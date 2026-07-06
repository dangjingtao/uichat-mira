import type { ModelType, ProviderTemplateCode } from "@/db/schema.js";

/** Path params for provider-scoped settings endpoints. */
export interface ProviderIdParams {
  /** Provider connection id, with built-in ids matching legacy provider codes. */
  providerCode: string;
}

/** Body for creating a custom provider connection. */
export interface CreateProviderConnectionBody {
  templateCode: ProviderTemplateCode;
  displayName: string;
  baseUrl?: string;
  apiKey?: string;
}

/** Body for saving a provider connection. */
export interface SaveProviderConnectionBody {
  displayName?: string;
  /** Provider base URL used by backend-side discovery and proxy calls. */
  baseUrl: string;
  /** Plain API key from the client; service code encrypts it before persistence. */
  apiKey: string;
}

/** Path params for assigning a provider model to a model role. */
export interface SelectRoleModelParams extends ProviderIdParams {
  /** Model role whose default config should be replaced. */
  role: ModelType;
}

/** Body for selecting a remote provider model for a role. */
export interface SelectRoleModelBody {
  /** Remote model id previously synced from the provider. */
  remoteModelId: string;
  displayName?: string;
  /** Optional provider base URL to persist together with the default model selection. */
  baseUrl?: string;
  /** Optional plain API key to persist together with the default model selection. */
  apiKey?: string;
}

/** Path params for clearing a model role assignment. */
export interface ResetRoleModelParams {
  /** Model role whose provider and remote model fields should be cleared. */
  role: ModelType;
}
