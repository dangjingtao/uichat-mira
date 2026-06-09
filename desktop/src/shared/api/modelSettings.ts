import { get, post, put } from "../lib/request";

export type ProviderCode = "ollama" | "lmstudio" | "openai" | "cloudflare";
export type RoleModelType = "llm" | "embedding" | "rerank";
export type ProviderStatus = "idle" | "syncing" | "connected" | "error";

export interface RoleModelConfig {
  id: string;
  type: RoleModelType;
  name: string;
  providerCode: ProviderCode | null;
  remoteModelId: string | null;
  params: Record<string, unknown>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderSummary {
  code: ProviderCode;
  displayName: string;
  baseUrl: string;
  hasApiKey: boolean;
  status: ProviderStatus;
  lastError: string | null;
  lastSyncedAt: string | null;
  assignedRoles: RoleModelType[];
}

export interface ProviderDetail {
  provider: {
    code: ProviderCode;
    displayName: string;
    baseUrl: string;
    apiKey: string;
    hasApiKey: boolean;
    status: ProviderStatus;
    lastError: string | null;
    lastSyncedAt: string | null;
  };
  models: Array<{
    id: string;
    name: string;
  }>;
  assignments: Record<
    RoleModelType,
    {
      providerCode: ProviderCode;
      remoteModelId: string;
      modelName: string;
    } | null
  >;
}

export interface SyncModelsResponse {
  provider: ProviderSummary;
  models: Array<{
    id: string;
    name: string;
  }>;
}

export async function getRoleModelConfigs(): Promise<RoleModelConfig[]> {
  return get<RoleModelConfig[]>("/models");
}

export async function updateRoleModelConfigParams(
  type: RoleModelType,
  params: Record<string, unknown>,
): Promise<RoleModelConfig> {
  return put<RoleModelConfig>(`/models/${type}/config`, { params });
}

export async function getProviders(): Promise<ProviderSummary[]> {
  return get<ProviderSummary[]>("/providers");
}

export async function getProviderDetail(
  providerCode: ProviderCode,
): Promise<ProviderDetail> {
  return get<ProviderDetail>(`/providers/${providerCode}`);
}

export async function saveProviderConfig(
  providerCode: ProviderCode,
  payload: { baseUrl: string; apiKey: string },
) {
  return put(`/providers/${providerCode}`, payload);
}

export async function syncProviderModels(
  providerCode: ProviderCode,
): Promise<SyncModelsResponse> {
  return post<SyncModelsResponse>(`/providers/${providerCode}/sync-models`);
}

export async function selectProviderRoleModel(
  providerCode: ProviderCode,
  role: RoleModelType,
  remoteModelId: string,
): Promise<RoleModelConfig> {
  return put<RoleModelConfig>(`/providers/${providerCode}/select-model/${role}`, {
    remoteModelId,
  });
}
