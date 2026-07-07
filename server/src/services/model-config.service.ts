import {
  modelConfigRepository,
  modelParamTemplateRepository,
  providerConnectionRepository,
} from "@/db/repositories";
import type { ModelConfig, ModelParamTemplate, ModelType, ProviderCode } from "@/db/schema";

const sanitizeParamsByType = (
  type: ModelType,
  params: Record<string, unknown>,
): Record<string, unknown> => {
  if (type === "task" || type === "agentTask" || type === "evaluation") {
    const sanitized: Record<string, unknown> = {};

    if (typeof params.enabled === "boolean") {
      sanitized.enabled = params.enabled;
    }
    if (typeof params.temperature === "number") {
      sanitized.temperature = params.temperature;
    }
    if (typeof params.topP === "number") {
      sanitized.topP = params.topP;
    }
    if (typeof params.topK === "number") {
      sanitized.topK = params.topK;
    }
    if (typeof params.maxTokens === "number") {
      sanitized.maxTokens = params.maxTokens;
    }
    if (typeof params.frequencyPenalty === "number") {
      sanitized.frequencyPenalty = params.frequencyPenalty;
    }
    if (typeof params.presencePenalty === "number") {
      sanitized.presencePenalty = params.presencePenalty;
    }

    return sanitized;
  }

  if (type !== "rerank") {
    if (type === "imageGeneration") {
      const sanitized: Record<string, unknown> = {};

      if (typeof params.enabled === "boolean") {
        sanitized.enabled = params.enabled;
      }

      return sanitized;
    }

    return params;
  }

  const sanitized: Record<string, unknown> = {};

  if (typeof params.enabled === "boolean") {
    sanitized.enabled = params.enabled;
  }
  if (typeof params.topN === "number") {
    sanitized.topN = params.topN;
  }
  if (typeof params.scoreThreshold === "number") {
    sanitized.scoreThreshold = params.scoreThreshold;
  }

  return sanitized;
};

export interface ModelConfigResponse {
  id: string;
  type: ModelType;
  name: string;
  providerCode: string | null;
  providerConnectionId: string | null;
  providerConnectionDisplayName: string | null;
  providerTemplateCode: string | null;
  remoteModelId: string | null;
  params: Record<string, unknown>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ParamTemplateResponse {
  key: string;
  label: string;
  type: "number" | "select" | "boolean";
  step?: number;
  options?: { value: string; label: string }[];
  defaultValue: number | string | boolean;
}

const toModelConfigResponse = (row: ModelConfig): ModelConfigResponse => {
  const connection = row.providerConnectionId
    ? providerConnectionRepository.findById(row.providerConnectionId)
    : null;

  return {
    id: row.id,
    type: row.type,
    name: row.name,
    providerCode: row.providerCode ?? row.providerConnectionId ?? null,
    providerConnectionId: row.providerConnectionId ?? null,
    providerConnectionDisplayName: connection?.displayName ?? null,
    providerTemplateCode: connection?.templateCode ?? null,
    remoteModelId: row.remoteModelId ?? null,
    params: sanitizeParamsByType(row.type, JSON.parse(row.params)),
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

const toParamTemplateResponse = (
  row: ModelParamTemplate,
): ParamTemplateResponse => ({
  key: row.paramKey,
  label: row.paramLabel,
  type: row.paramType,
  step: row.step ?? undefined,
  options: row.options ? JSON.parse(row.options) : undefined,
  defaultValue: JSON.parse(row.defaultValue),
});

export const modelConfigService = {
  getDefaultConfig(type: ModelType): ModelConfigResponse | null {
    const config = modelConfigRepository.findDefaultByType(type);
    return config ? toModelConfigResponse(config) : null;
  },

  getAllDefaultConfigs(): ModelConfigResponse[] {
    return modelConfigRepository.findAllDefaults().map(toModelConfigResponse);
  },

  updateDefaultConfig(
    type: ModelType,
    data: {
      name?: string;
      params?: Record<string, unknown>;
      providerCode?: ProviderCode | null;
      providerConnectionId?: string | null;
      remoteModelId?: string | null;
    },
  ): ModelConfigResponse | null {
    const current = modelConfigRepository.findDefaultByType(type);
    if (!current) {
      return null;
    }

    const mergedParams = sanitizeParamsByType(
      type,
      data.params
        ? {
            ...JSON.parse(current.params),
            ...data.params,
          }
        : JSON.parse(current.params),
    );

    const updated = modelConfigRepository.updateDefault(type, {
      name: data.name ?? current.name,
      params: JSON.stringify(mergedParams),
      providerCode:
        data.providerCode !== undefined ? data.providerCode : current.providerCode,
      providerConnectionId:
        data.providerConnectionId !== undefined
          ? data.providerConnectionId
          : current.providerConnectionId,
      remoteModelId:
        data.remoteModelId !== undefined
          ? data.remoteModelId
          : current.remoteModelId,
    });

    return updated ? toModelConfigResponse(updated) : null;
  },

  getParamTemplates(
    type?: ModelType,
  ): Record<ModelType, ParamTemplateResponse[]> {
    const rows = type
      ? modelParamTemplateRepository.findByModelType(type)
      : modelParamTemplateRepository.findAll();

    const result: Record<ModelType, ParamTemplateResponse[]> = {
      llm: [],
      embedding: [],
      rerank: [],
      task: [],
      agentTask: [],
      evaluation: [],
      imageGeneration: [],
    };

    for (const row of rows) {
      result[row.modelType].push(toParamTemplateResponse(row));
    }

    return result;
  },
};
