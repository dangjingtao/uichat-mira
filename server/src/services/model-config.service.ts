/**
 * 模型配置服务层
 */
import {
  modelConfigRepository,
  modelParamTemplateRepository,
} from "@/db/repositories";
import type { ModelConfig, ModelParamTemplate } from "@/db/schema";
import type { ModelType } from "@/db/schema";

/** 模型配置响应类型 */
export interface ModelConfigResponse {
  id: string;
  type: ModelType;
  name: string;
  params: Record<string, any>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 参数模板响应类型 */
export interface ParamTemplateResponse {
  key: string;
  label: string;
  type: "number" | "select" | "boolean";
  step?: number;
  options?: { value: string; label: string }[];
  defaultValue: number | string | boolean;
}

/**
 * 将数据库记录转换为响应格式
 */
const toModelConfigResponse = (row: ModelConfig): ModelConfigResponse => ({
  id: row.id,
  type: row.type,
  name: row.name,
  params: JSON.parse(row.params),
  isDefault: row.isDefault,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/**
 * 将参数模板记录转换为响应格式
 */
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

/**
 * 模型配置服务
 */
export const modelConfigService = {
  /**
   * 获取指定类型的默认模型配置
   */
  getDefaultConfig(type: ModelType): ModelConfigResponse | null {
    const config = modelConfigRepository.findDefaultByType(type);
    return config ? toModelConfigResponse(config) : null;
  },

  /**
   * 获取所有类型的默认配置
   */
  getAllDefaultConfigs(): ModelConfigResponse[] {
    const configs = modelConfigRepository.findAllDefaults();
    return configs.map(toModelConfigResponse);
  },

  /**
   * 更新指定类型的默认模型配置
   */
  updateDefaultConfig(
    type: ModelType,
    data: { name?: string; params?: Record<string, any> },
  ): ModelConfigResponse | null {
    // 获取当前配置
    const current = modelConfigRepository.findDefaultByType(type);
    if (!current) {
      return null;
    }

    // 构建更新内容
    const newName = data.name !== undefined ? data.name : current.name;
    const currentParams = JSON.parse(current.params);
    const newParams = data.params
      ? { ...currentParams, ...data.params }
      : currentParams;

    // 更新数据库
    modelConfigRepository.updateDefault(type, {
      name: newName,
      params: JSON.stringify(newParams),
    });

    // 返回更新后的配置
    return {
      id: current.id,
      type: current.type,
      name: newName,
      params: newParams,
      isDefault: true,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    };
  },

  /**
   * 获取参数模板
   */
  getParamTemplates(
    type?: ModelType,
  ): Record<ModelType, ParamTemplateResponse[]> {
    const rows = type
      ? modelParamTemplateRepository.findByModelType(type)
      : modelParamTemplateRepository.findAll();

    // 按类型分组
    const result: Record<ModelType, ParamTemplateResponse[]> = {
      llm: [],
      embedding: [],
      rerank: [],
    };

    for (const row of rows) {
      result[row.modelType].push(toParamTemplateResponse(row));
    }

    return result;
  },

  /**
   * 创建新的模型配置（非默认）
   */
  createConfig(
    type: ModelType,
    name: string,
    params: Record<string, any>,
  ): ModelConfigResponse {
    const config = modelConfigRepository.create({
      type,
      name,
      params: JSON.stringify(params),
      isDefault: false,
    });

    return toModelConfigResponse(config);
  },

  /**
   * 获取所有模型配置
   */
  getAllConfigs(type?: ModelType): ModelConfigResponse[] {
    const configs = type
      ? modelConfigRepository.findByType(type)
      : modelConfigRepository.findAll();

    return configs.map(toModelConfigResponse);
  },

  /**
   * 删除模型配置
   */
  deleteConfig(id: string): boolean {
    return modelConfigRepository.delete(id);
  },
};
