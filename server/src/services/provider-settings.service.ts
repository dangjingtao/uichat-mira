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
  ProviderTemplateCode,
} from "@/db/schema";
import {
  DEFAULT_PROVIDER_CONNECTIONS,
  buildDefaultParams,
} from "@/services/model-config.defaults.js";
import {
  getProviderCapabilities,
  getProviderTemplateDefinition,
  PROVIDER_CODE_ENUM,
} from "@/providers/catalog.js";
import { listCloudflareModels } from "@/services/cloudflare-provider.js";
import { listOpenAICompatibleModels } from "@/services/openai-compatible-provider.js";
import { decryptSecret, encryptSecret } from "@/utils/crypto.js";
import {
  FAILED_UPDATE_PROVIDER_STATUS_MESSAGE,
  PROVIDER_CONNECTION_NOT_FOUND_MESSAGE,
  PROVIDER_MODEL_NOT_FOUND_MESSAGE,
  getErrorMessage,
} from "@/utils/errors.js";
import { fetchJsonWithTimeout } from "@/utils/http.js";
import { nowIso } from "@/utils/time.js";

export interface ProviderSummaryResponse {
  id: string;
  code: string;
  templateCode: ProviderTemplateCode;
  providerCode: ProviderCode | null;
  displayName: string;
  baseUrl: string;
  hasApiKey: boolean;
  status: ProviderStatus;
  lastError: string | null;
  lastSyncedAt: string | null;
  assignedRoles: ModelType[];
  isSystem: boolean;
  capabilities: ReturnType<typeof getProviderCapabilities>;
}

export interface ProviderDetailResponse {
  provider: {
    id: string;
    code: string;
    templateCode: ProviderTemplateCode;
    providerCode: ProviderCode | null;
    displayName: string;
    baseUrl: string;
    apiKey: string;
    hasApiKey: boolean;
    status: ProviderStatus;
    lastError: string | null;
    lastSyncedAt: string | null;
    isSystem: boolean;
    capabilities: ReturnType<typeof getProviderCapabilities>;
  };
  models: Array<{
    id: string;
    name: string;
  }>;
  assignments: Record<
    ModelType,
    {
      providerCode: string;
      providerConnectionId: string;
      providerTemplateCode: ProviderTemplateCode | null;
      remoteModelId: string;
      modelName: string;
    } | null
  >;
}

export interface ProviderTemplateSummaryResponse {
  code: ProviderTemplateCode;
  displayName: string;
  defaultBaseUrl: string;
  capabilities: ReturnType<typeof getProviderCapabilities>;
  isCustomTemplate: boolean;
}

export interface SyncModelsResponse {
  provider: ProviderSummaryResponse;
  models: Array<{ id: string; name: string }>;
}

const providerDefaults = Object.fromEntries(
  DEFAULT_PROVIDER_CONNECTIONS.map((item) => [item.id, item]),
) as Record<string, (typeof DEFAULT_PROVIDER_CONNECTIONS)[number]>;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const isBuiltinProviderCode = (value: string): value is ProviderCode =>
  (PROVIDER_CODE_ENUM as readonly string[]).includes(value);

const resolveProviderReference = (connection: ProviderConnection) =>
  connection.providerCode ?? connection.id;

const ensureBuiltinProviderConnection = (providerCode: ProviderCode) => {
  const existing = providerConnectionRepository.findByCode(providerCode);
  if (existing) {
    return existing;
  }

  const fallback = providerDefaults[providerCode];
  if (!fallback) {
    return undefined;
  }

  return providerConnectionRepository.upsertSystemConnection({
    id: fallback.id,
    templateCode: fallback.templateCode,
    providerCode: fallback.providerCode,
    displayName: fallback.displayName,
    baseUrl: fallback.baseUrl,
    apiKeyEncrypted: null,
    isSystem: true,
    isEnabled: true,
    status: "idle",
    lastError: null,
    lastSyncedAt: null,
  });
};

const resolveConnectionByIdOrCode = (providerId: string) => {
  const byId = providerConnectionRepository.findById(providerId);
  if (byId) {
    return byId;
  }

  if (isBuiltinProviderCode(providerId)) {
    return ensureBuiltinProviderConnection(providerId);
  }

  return undefined;
};

const listProviderModels = async (
  templateCode: ProviderTemplateCode,
  baseUrl: string,
  apiKey: string,
) => {
  const definition = getProviderTemplateDefinition(templateCode);

  if (definition.syncAdapter === "ollama") {
    const url = `${trimTrailingSlash(baseUrl)}/api/tags`;
    const result = await fetchJsonWithTimeout<{ models?: Array<{ name: string }> }>(
      url,
    );

    return (result.models ?? []).map((model) => ({
      id: model.name,
      name: model.name,
      raw: model,
    }));
  }

  if (definition.syncAdapter === "cloudflare") {
    return listCloudflareModels(baseUrl, apiKey);
  }

  return listOpenAICompatibleModels(baseUrl, apiKey);
};

const toProviderSummary = (
  connection: ProviderConnection,
  assignedRoles: ModelType[],
): ProviderSummaryResponse => ({
  id: connection.id,
  code: connection.id,
  templateCode: connection.templateCode,
  providerCode: connection.providerCode ?? null,
  displayName: connection.displayName,
  baseUrl: connection.baseUrl,
  hasApiKey: Boolean(connection.apiKeyEncrypted),
  status: connection.status,
  lastError: connection.lastError ?? null,
  lastSyncedAt: connection.lastSyncedAt ?? null,
  assignedRoles,
  isSystem: connection.isSystem,
  capabilities: getProviderCapabilities(connection.templateCode),
});

const getAssignments = () => {
  const defaults = modelConfigRepository.findAllDefaults();

  return {
    llm:
      defaults.find((config) => config.type === "llm" && config.remoteModelId) ??
      null,
    task:
      defaults.find((config) => config.type === "task" && config.remoteModelId) ??
      null,
    agentTask:
      defaults.find((config) => config.type === "agentTask" && config.remoteModelId) ??
      null,
    embedding:
      defaults.find((config) => config.type === "embedding" && config.remoteModelId) ??
      null,
    rerank:
      defaults.find((config) => config.type === "rerank" && config.remoteModelId) ??
      null,
    evaluation:
      defaults.find((config) => config.type === "evaluation" && config.remoteModelId) ??
      null,
    imageGeneration:
      defaults.find(
        (config) => config.type === "imageGeneration" && config.remoteModelId,
      ) ?? null,
    voice:
      defaults.find((config) => config.type === "voice" && config.remoteModelId) ??
      null,
  };
};

const getEmbeddingDimensionsFromProviderModel = (
  providerModel: ProviderModel,
): number | undefined => {
  try {
    const raw = providerModel.rawPayloadJson
      ? JSON.parse(providerModel.rawPayloadJson)
      : null;

    const candidates = [
      raw?.details?.embedding_length,
      raw?.embedding_length,
      raw?.dimensions,
      raw?.dim,
    ];

    for (const candidate of candidates) {
      if (
        typeof candidate === "number" &&
        Number.isInteger(candidate) &&
        candidate > 0
      ) {
        return candidate;
      }
    }
  } catch {
    // Ignore malformed provider payloads and fall back to static defaults.
  }

  return undefined;
};

const toRoleAssignment = (
  roleConfig: ReturnType<typeof getAssignments>[ModelType],
  targetConnection: ProviderConnection,
) => {
  if (!roleConfig?.remoteModelId || !roleConfig.providerConnectionId) {
    return null;
  }

  if (roleConfig.providerConnectionId !== targetConnection.id) {
    return null;
  }

  return {
    providerCode: resolveProviderReference(targetConnection),
    providerConnectionId: targetConnection.id,
    providerTemplateCode: targetConnection.templateCode,
    remoteModelId: roleConfig.remoteModelId,
    modelName: roleConfig.name,
  };
};

const requireConnection = (providerId: string) => {
  const connection = resolveConnectionByIdOrCode(providerId);
  if (!connection) {
    throw new Error(PROVIDER_CONNECTION_NOT_FOUND_MESSAGE);
  }

  return connection;
};

const clearDefaultRoleBindingsForConnection = (providerConnectionId: string) => {
  const defaults = modelConfigRepository.findAllDefaults();

  defaults
    .filter((config) => config.providerConnectionId === providerConnectionId)
    .forEach((config) => {
      modelConfigRepository.upsertDefault({
        type: config.type,
        name: "",
        providerCode: null,
        providerConnectionId: null,
        remoteModelId: null,
        params: JSON.stringify(buildDefaultParams(config.type)),
      });
    });
};

export const providerSettingsService = {
  listProviderTemplates(): ProviderTemplateSummaryResponse[] {
    const templateCodes: ProviderTemplateCode[] = [
      "ollama",
      "lmstudio",
      "openai",
      "google",
      "cloudflare",
      "volcengine",
      "openai-compatible-custom",
    ];

    return templateCodes.map((templateCode) => {
      const definition = getProviderTemplateDefinition(templateCode);
      return {
        code: templateCode,
        displayName: definition.displayName,
        defaultBaseUrl: definition.defaultBaseUrl,
        capabilities: getProviderCapabilities(templateCode),
        isCustomTemplate: templateCode === "openai-compatible-custom",
      };
    });
  },

  getProviderSummaries(): ProviderSummaryResponse[] {
    const connections = providerConnectionRepository.findAll();
    const assignments = getAssignments();

    return connections.map((connection) => {
      const assignedRoles = (Object.entries(assignments) as Array<
        [ModelType, typeof assignments.llm]
      >)
        .filter(([, value]) => value?.providerConnectionId === connection.id)
        .map(([role]) => role);

      return toProviderSummary(connection, assignedRoles);
    });
  },

  getProviderDetail(providerId: string): ProviderDetailResponse {
    const connection = requireConnection(providerId);
    const models = providerModelRepository.findByConnectionId(connection.id);
    const assignments = getAssignments();

    return {
      provider: {
        id: connection.id,
        code: connection.id,
        templateCode: connection.templateCode,
        providerCode: connection.providerCode ?? null,
        displayName: connection.displayName,
        baseUrl: connection.baseUrl,
        apiKey: decryptSecret(connection.apiKeyEncrypted),
        hasApiKey: Boolean(connection.apiKeyEncrypted),
        status: connection.status,
        lastError: connection.lastError ?? null,
        lastSyncedAt: connection.lastSyncedAt ?? null,
        isSystem: connection.isSystem,
        capabilities: getProviderCapabilities(connection.templateCode),
      },
      models: models.map((model) => ({
        id: model.remoteModelId,
        name: model.modelName,
      })),
      assignments: {
        llm: toRoleAssignment(assignments.llm, connection),
        task: toRoleAssignment(assignments.task, connection),
        agentTask: toRoleAssignment(assignments.agentTask, connection),
        embedding: toRoleAssignment(assignments.embedding, connection),
        rerank: toRoleAssignment(assignments.rerank, connection),
        evaluation: toRoleAssignment(assignments.evaluation, connection),
        imageGeneration: toRoleAssignment(assignments.imageGeneration, connection),
        voice: toRoleAssignment(assignments.voice, connection),
      },
    };
  },

  createProviderConnection(payload: {
    templateCode: ProviderTemplateCode;
    displayName: string;
    baseUrl?: string;
    apiKey?: string;
  }): ProviderSummaryResponse {
    if (payload.templateCode !== "openai-compatible-custom") {
      throw new Error("Only custom OpenAI-compatible connections can be created.");
    }

    const template = getProviderTemplateDefinition(payload.templateCode);
    const connection = providerConnectionRepository.create({
      templateCode: payload.templateCode,
      providerCode: null,
      displayName: payload.displayName.trim() || template.displayName,
      baseUrl: payload.baseUrl?.trim() || template.defaultBaseUrl,
      apiKeyEncrypted: encryptSecret(payload.apiKey?.trim() ?? ""),
      isSystem: false,
      isEnabled: true,
      status: "idle",
      lastError: null,
      lastSyncedAt: null,
    });

    return toProviderSummary(connection, []);
  },

  saveProviderConnection(
    providerId: string,
    payload: { displayName?: string; baseUrl: string; apiKey: string },
  ) {
    const existing = resolveConnectionByIdOrCode(providerId);

    if (!existing) {
      throw new Error(PROVIDER_CONNECTION_NOT_FOUND_MESSAGE);
    }

    return providerConnectionRepository.update(existing.id, {
      displayName: payload.displayName?.trim() || existing.displayName,
      baseUrl: payload.baseUrl.trim() || existing.baseUrl,
      apiKeyEncrypted: encryptSecret(payload.apiKey.trim()),
      isEnabled: true,
      status: "idle",
      lastError: null,
    });
  },

  deleteProviderConnection(providerId: string) {
    const connection = requireConnection(providerId);

    if (connection.isSystem) {
      throw new Error("Built-in provider connections cannot be deleted.");
    }

    clearDefaultRoleBindingsForConnection(connection.id);
    providerConnectionRepository.delete(connection.id);
  },

  async syncProviderModels(providerId: string): Promise<SyncModelsResponse> {
    const connection = requireConnection(providerId);

    providerConnectionRepository.updateStatus(
      connection.id,
      "syncing",
      null,
      connection.lastSyncedAt,
    );

    try {
      const models = await listProviderModels(
        connection.templateCode,
        connection.baseUrl,
        decryptSecret(connection.apiKeyEncrypted),
      );
      const syncedAt = nowIso();

      providerModelRepository.replaceForConnection(
        connection.id,
        models.map((model) => ({
          providerConnectionId: connection.id,
          providerCode: connection.providerCode ?? null,
          remoteModelId: model.id,
          modelName: model.name,
          rawPayloadJson: JSON.stringify(model.raw ?? model),
          isActive: true,
          syncedAt,
        })),
      );

      const updatedConnection = providerConnectionRepository.updateStatus(
        connection.id,
        "connected",
        null,
        syncedAt,
      );

      if (!updatedConnection) {
        throw new Error(FAILED_UPDATE_PROVIDER_STATUS_MESSAGE);
      }

      return {
        provider: toProviderSummary(
          updatedConnection,
          this.getProviderSummaries().find((provider) => provider.id === connection.id)
            ?.assignedRoles ?? [],
        ),
        models: models.map((model) => ({
          id: model.id,
          name: model.name,
        })),
      };
    } catch (err) {
      const errorMessage = getErrorMessage(err, "Unknown sync error");
      providerConnectionRepository.updateStatus(
        connection.id,
        "error",
        errorMessage,
        connection.lastSyncedAt,
      );
      throw err;
    }
  },

  selectRoleModel(
    providerId: string,
    role: ModelType,
    remoteModelId: string,
    connectionPayload?: {
      displayName?: string;
      baseUrl?: string;
      apiKey?: string;
    },
  ) {
    if (
      connectionPayload &&
      (typeof connectionPayload.baseUrl === "string" ||
        typeof connectionPayload.apiKey === "string" ||
        typeof connectionPayload.displayName === "string")
    ) {
      this.saveProviderConnection(providerId, {
        displayName: connectionPayload.displayName,
        baseUrl: connectionPayload.baseUrl ?? "",
        apiKey: connectionPayload.apiKey ?? "",
      });
    }

    const connection = requireConnection(providerId);
    const normalizedRemoteModelId = remoteModelId.trim();
    if (!normalizedRemoteModelId) {
      throw new Error(PROVIDER_MODEL_NOT_FOUND_MESSAGE);
    }

    const providerModel = providerModelRepository.findByConnectionAndRemoteModelId(
      connection.id,
      normalizedRemoteModelId,
    );

    const currentDefault = modelConfigRepository.findDefaultByType(role);
    const params = buildDefaultParams(role);
    const embeddingDimensions =
      role === "embedding" && providerModel
        ? getEmbeddingDimensionsFromProviderModel(providerModel)
        : undefined;

    if (role === "embedding" && embeddingDimensions) {
      params.dimensions = embeddingDimensions;
    }

    if (role === "rerank") {
      const currentParams =
        currentDefault?.params && currentDefault.params.trim()
          ? JSON.parse(currentDefault.params)
          : {};

      params.enabled =
        typeof currentParams.enabled === "boolean"
          ? currentParams.enabled
          : true;
    }

    const updated = modelConfigRepository.upsertDefault({
      type: role,
      name: providerModel?.modelName ?? normalizedRemoteModelId,
      providerCode: connection.providerCode ?? null,
      providerConnectionId: connection.id,
      remoteModelId:
        providerModel && connection.providerCode === "cloudflare"
          ? providerModel.modelName
          : providerModel?.remoteModelId ?? normalizedRemoteModelId,
      params: JSON.stringify(params),
    });

    return {
      id: updated.id,
      type: updated.type,
      name: updated.name,
      providerCode: updated.providerCode ?? connection.id,
      providerConnectionId: updated.providerConnectionId ?? connection.id,
      providerConnectionDisplayName: connection.displayName,
      providerTemplateCode: connection.templateCode,
      remoteModelId: updated.remoteModelId ?? null,
      params: JSON.parse(updated.params),
      isDefault: updated.isDefault,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  },

  resetRoleModel(role: ModelType) {
    const updated = modelConfigRepository.upsertDefault({
      type: role,
      name: "",
      providerCode: null,
      providerConnectionId: null,
      remoteModelId: null,
      params: JSON.stringify(buildDefaultParams(role)),
    });

    return {
      id: updated.id,
      type: updated.type,
      name: updated.name,
      providerCode: null,
      providerConnectionId: null,
      providerConnectionDisplayName: null,
      providerTemplateCode: null,
      remoteModelId: updated.remoteModelId ?? null,
      params: JSON.parse(updated.params),
      isDefault: updated.isDefault,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  },
};
