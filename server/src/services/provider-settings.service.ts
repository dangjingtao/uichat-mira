import {
  modelConfigRepository,
  providerConnectionRepository,
  providerModelRepository,
} from "@/db/repositories";
import type {
  ModelType,
  ProviderCode,
  ProviderConnection,
  ProviderModel,
  ProviderStatus,
} from "@/db/schema";
import {
  DEFAULT_PROVIDER_CONNECTIONS,
  buildDefaultParams,
} from "@/services/model-config.defaults.js";
import { listCloudflareModels } from "@/services/cloudflare-provider.js";
import { listOpenAICompatibleModels } from "@/services/openai-compatible-provider.js";
import { decryptSecret, encryptSecret } from "@/utils/crypto.js";

export interface ProviderSummaryResponse {
  code: ProviderCode;
  displayName: string;
  baseUrl: string;
  hasApiKey: boolean;
  status: ProviderStatus;
  lastError: string | null;
  lastSyncedAt: string | null;
  assignedRoles: ModelType[];
}

export interface ProviderDetailResponse {
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
    ModelType,
    {
      providerCode: ProviderCode;
      remoteModelId: string;
      modelName: string;
    } | null
  >;
}

export interface SyncModelsResponse {
  provider: ProviderSummaryResponse;
  models: Array<{ id: string; name: string }>;
}

const providerDefaults = Object.fromEntries(
  DEFAULT_PROVIDER_CONNECTIONS.map((item) => [item.providerCode, item]),
) as Record<ProviderCode, (typeof DEFAULT_PROVIDER_CONNECTIONS)[number]>;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
};

const listProviderModels = async (
  providerCode: ProviderCode,
  baseUrl: string,
  apiKey: string,
) => {
  if (providerCode === "ollama") {
    const url = `${trimTrailingSlash(baseUrl)}/api/tags`;
    const result = await fetchJson<{ models?: Array<{ name: string }> }>(url);

    return (result.models ?? []).map((model) => ({
      id: model.name,
      name: model.name,
      raw: model,
    }));
  }

  if (providerCode === "cloudflare") {
    return listCloudflareModels(baseUrl, apiKey);
  }

  return listOpenAICompatibleModels(baseUrl, apiKey);
};

const toProviderSummary = (
  connection: ProviderConnection,
  assignedRoles: ModelType[],
): ProviderSummaryResponse => ({
  code: connection.providerCode,
  displayName: connection.displayName,
  baseUrl: connection.baseUrl,
  hasApiKey: Boolean(connection.apiKeyEncrypted),
  status: connection.status,
  lastError: connection.lastError ?? null,
  lastSyncedAt: connection.lastSyncedAt ?? null,
  assignedRoles,
});

const getAssignments = () => {
  const defaults = modelConfigRepository.findAllDefaults();

  return {
    llm:
      defaults.find((config) => config.type === "llm" && config.providerCode && config.remoteModelId) ??
      null,
    embedding:
      defaults.find(
        (config) =>
          config.type === "embedding" && config.providerCode && config.remoteModelId,
      ) ?? null,
    rerank:
      defaults.find(
        (config) =>
          config.type === "rerank" && config.providerCode && config.remoteModelId,
      ) ?? null,
  };
};

export const providerSettingsService = {
  getProviderSummaries(): ProviderSummaryResponse[] {
    const connections = providerConnectionRepository.findAll();
    const assignments = getAssignments();

    return connections.map((connection) => {
      const assignedRoles = (Object.entries(assignments) as Array<
        [ModelType, typeof assignments.llm]
      >)
        .filter(([, value]) => value?.providerCode === connection.providerCode)
        .map(([role]) => role);

      return toProviderSummary(connection, assignedRoles);
    });
  },

  getProviderDetail(providerCode: ProviderCode): ProviderDetailResponse {
    const connection =
      providerConnectionRepository.findByCode(providerCode) ??
      providerConnectionRepository.upsert({
        providerCode,
        displayName: providerDefaults[providerCode].displayName,
        baseUrl: providerDefaults[providerCode].baseUrl,
        apiKeyEncrypted: null,
        isEnabled: true,
        status: "idle",
        lastError: null,
        lastSyncedAt: null,
      });
    const models = providerModelRepository.findByProvider(providerCode);
    const assignments = getAssignments();

    return {
      provider: {
        code: connection.providerCode,
        displayName: connection.displayName,
        baseUrl: connection.baseUrl,
        apiKey: decryptSecret(connection.apiKeyEncrypted),
        hasApiKey: Boolean(connection.apiKeyEncrypted),
        status: connection.status,
        lastError: connection.lastError ?? null,
        lastSyncedAt: connection.lastSyncedAt ?? null,
      },
      models: models.map((model) => ({
        id: model.remoteModelId,
        name: model.modelName,
      })),
      assignments: {
        llm:
          assignments.llm?.providerCode === providerCode && assignments.llm.remoteModelId
            ? {
                providerCode,
                remoteModelId: assignments.llm.remoteModelId,
                modelName: assignments.llm.name,
              }
            : null,
        embedding:
          assignments.embedding?.providerCode === providerCode &&
          assignments.embedding.remoteModelId
            ? {
                providerCode,
                remoteModelId: assignments.embedding.remoteModelId,
                modelName: assignments.embedding.name,
              }
            : null,
        rerank:
          assignments.rerank?.providerCode === providerCode &&
          assignments.rerank.remoteModelId
            ? {
                providerCode,
                remoteModelId: assignments.rerank.remoteModelId,
                modelName: assignments.rerank.name,
              }
            : null,
      },
    };
  },

  saveProviderConnection(
    providerCode: ProviderCode,
    payload: { baseUrl: string; apiKey: string },
  ) {
    const defaultProvider = providerDefaults[providerCode];
    return providerConnectionRepository.upsert({
      providerCode,
      displayName: defaultProvider.displayName,
      baseUrl: payload.baseUrl.trim() || defaultProvider.baseUrl,
      apiKeyEncrypted: encryptSecret(payload.apiKey.trim()),
      isEnabled: true,
      status: "idle",
      lastError: null,
      lastSyncedAt: null,
    });
  },

  async syncProviderModels(providerCode: ProviderCode): Promise<SyncModelsResponse> {
    const connection = providerConnectionRepository.findByCode(providerCode);

    if (!connection) {
      throw new Error("Provider connection not found");
    }

    providerConnectionRepository.updateStatus(providerCode, "syncing", null, connection.lastSyncedAt);

    try {
      const models = await listProviderModels(
        providerCode,
        connection.baseUrl,
        decryptSecret(connection.apiKeyEncrypted),
      );
      const syncedAt = new Date().toISOString();

      providerModelRepository.replaceForProvider(
        providerCode,
        models.map((model) => ({
          providerCode,
          remoteModelId: model.id,
          modelName: model.name,
          rawPayloadJson: JSON.stringify(model.raw ?? model),
          isActive: true,
          syncedAt,
        })),
      );

      const updatedConnection = providerConnectionRepository.updateStatus(
        providerCode,
        "connected",
        null,
        syncedAt,
      );

      if (!updatedConnection) {
        throw new Error("Failed to update provider status");
      }

      return {
        provider: toProviderSummary(updatedConnection, this.getProviderSummaries().find((provider) => provider.code === providerCode)?.assignedRoles ?? []),
        models: models.map((model) => ({
          id: model.id,
          name: model.name,
        })),
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown sync error";
      providerConnectionRepository.updateStatus(providerCode, "error", errorMessage, connection.lastSyncedAt);
      throw err;
    }
  },

  selectRoleModel(
    providerCode: ProviderCode,
    role: ModelType,
    remoteModelId: string,
  ) {
    const providerModel = providerModelRepository.findByProviderAndRemoteModelId(
      providerCode,
      remoteModelId,
    );

    if (!providerModel) {
      throw new Error("Provider model not found");
    }

    const updated = modelConfigRepository.upsertDefault({
      type: role,
      name: providerModel.modelName,
      providerCode,
      remoteModelId:
        providerCode === "cloudflare"
          ? providerModel.modelName
          : providerModel.remoteModelId,
      params: JSON.stringify(buildDefaultParams(role)),
    });

    return {
      id: updated.id,
      type: updated.type,
      name: updated.name,
      providerCode: updated.providerCode ?? null,
      remoteModelId: updated.remoteModelId ?? null,
      params: JSON.parse(updated.params),
      isDefault: updated.isDefault,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  },
};
