import type { ModelType, ProviderCode } from "@/db/schema.js";

/** Path params for provider-scoped settings endpoints. */
export interface ProviderCodeParams {
  /** Provider identifier from the centralized provider catalog. */
  providerCode: ProviderCode;
}

/** Body for saving a provider connection. */
export interface SaveProviderConnectionBody {
  /** Provider base URL used by backend-side discovery and proxy calls. */
  baseUrl: string;
  /** Plain API key from the client; service code encrypts it before persistence. */
  apiKey: string;
}

/** Path params for assigning a provider model to a model role. */
export interface SelectRoleModelParams extends ProviderCodeParams {
  /** Model role whose default config should be replaced. */
  role: ModelType;
}

/** Body for selecting a remote provider model for a role. */
export interface SelectRoleModelBody {
  /** Remote model id previously synced from the provider. */
  remoteModelId: string;
}

/** Path params for clearing a model role assignment. */
export interface ResetRoleModelParams {
  /** Model role whose provider and remote model fields should be cleared. */
  role: ModelType;
}

