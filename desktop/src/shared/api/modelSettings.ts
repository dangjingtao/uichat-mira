import { del, get, post, put } from "../lib/request";
import type { ProviderCode } from "../providerCatalog";

export type { ProviderCode } from "../providerCatalog";
export type RoleModelType =
  | "llm"
  | "embedding"
  | "rerank"
  | "task"
  | "agentTask"
  | "evaluation"
  | "imageGeneration"
  | "voice";
export type ProviderStatus = "idle" | "syncing" | "connected" | "error";

export interface RoleModelConfig {
  id: string;
  type: RoleModelType;
  name: string;
  providerCode: ProviderCode | null;
  providerConnectionId: string | null;
  providerConnectionDisplayName: string | null;
  providerTemplateCode: string | null;
  remoteModelId: string | null;
  params: Record<string, unknown>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderSummary {
  id: string;
  code: ProviderCode;
  templateCode: string;
  providerCode: string | null;
  displayName: string;
  baseUrl: string;
  hasApiKey: boolean;
  status: ProviderStatus;
  lastError: string | null;
  lastSyncedAt: string | null;
  assignedRoles: RoleModelType[];
  isSystem: boolean;
  capabilities: {
    syncAdapter: string;
    chatAdapter: string;
    embeddingAdapter: string;
    rerankAdapter: string;
    imageAdapter: string;
    supportsRoles: RoleModelType[];
  };
}

export interface ProviderDetail {
  provider: {
    id: string;
    code: ProviderCode;
    templateCode: string;
    providerCode: string | null;
    displayName: string;
    baseUrl: string;
    apiKey: string;
    hasApiKey: boolean;
    status: ProviderStatus;
    lastError: string | null;
    lastSyncedAt: string | null;
    isSystem: boolean;
    capabilities: ProviderSummary["capabilities"];
  };
  models: Array<{
    id: string;
    name: string;
  }>;
  assignments: Record<
    RoleModelType,
    {
      providerCode: ProviderCode;
      providerConnectionId: string;
      providerTemplateCode: string | null;
      remoteModelId: string;
      modelName: string;
    } | null
  >;
}

export interface ProviderTemplateSummary {
  code: string;
  displayName: string;
  defaultBaseUrl: string;
  capabilities: ProviderSummary["capabilities"];
  isCustomTemplate: boolean;
}

export interface SyncModelsResponse {
  provider: ProviderSummary;
  models: Array<{
    id: string;
    name: string;
  }>;
}

export interface CreateProviderConnectionPayload {
  templateCode: string;
  displayName: string;
  baseUrl?: string;
  apiKey?: string;
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

export async function getProviderTemplates(): Promise<ProviderTemplateSummary[]> {
  return get<ProviderTemplateSummary[]>("/provider-templates");
}

export async function getProviderDetail(
  providerCode: ProviderCode,
): Promise<ProviderDetail> {
  return get<ProviderDetail>(`/providers/${providerCode}`);
}

export async function createProviderConnection(
  payload: CreateProviderConnectionPayload,
) : Promise<ProviderSummary> {
  return post("/providers", payload);
}

export async function saveProviderConfig(
  providerCode: ProviderCode,
  payload: { displayName?: string; baseUrl: string; apiKey: string },
) {
  return put(`/providers/${providerCode}`, payload);
}

export async function deleteProviderConnection(providerCode: ProviderCode) {
  return del(`/providers/${providerCode}`);
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
  connectionPayload?: { displayName?: string; baseUrl: string; apiKey: string },
): Promise<RoleModelConfig> {
  return put<RoleModelConfig>(`/providers/${providerCode}/select-model/${role}`, {
    remoteModelId,
    ...(connectionPayload ?? {}),
  });
}

export async function resetProviderRoleModel(
  role: RoleModelType,
): Promise<RoleModelConfig> {
  return put<RoleModelConfig>(`/providers/reset-model/${role}`, {});
}
