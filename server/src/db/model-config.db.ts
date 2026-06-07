/**
 * 模型配置数据库
 */
import {
  getSqlite,
  modelConfigRepository,
  modelParamTemplateRepository,
} from "@/db";
import type { ModelType, ParamType } from "@/db/schema";

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
  type: ParamType;
  step?: number;
  options?: { value: string; label: string }[];
  defaultValue: number | string | boolean;
}

/** 默认配置数据 */
const DEFAULT_CONFIGS = [
  {
    type: "llm" as ModelType,
    name: "gemma4:e4b",
    params: {
      enabled: true,
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      maxTokens: 2048,
      frequencyPenalty: 0,
      presencePenalty: 0,
    },
  },
  {
    type: "embedding" as ModelType,
    name: "nomic-embed-text",
    params: {
      enabled: true,
      dimensions: 768,
      batchSize: 32,
      normalize: true,
      chunkSize: 512,
      chunkOverlap: 64,
    },
  },
  {
    type: "rerank" as ModelType,
    name: "",
    params: {
      enabled: false,
      topN: 5,
      scoreThreshold: 0.5,
      windowSize: 3,
      strategy: "cross-encoder",
    },
  },
];

/** 参数模板数据 */
const PARAM_TEMPLATES = [
  // LLM 参数
  {
    model_type: "llm" as ModelType,
    param_key: "temperature",
    param_label: "Temperature",
    param_type: "number" as ParamType,
    step: 0.1,
    options: null,
    default_value: 0.7,
  },
  {
    model_type: "llm" as ModelType,
    param_key: "topP",
    param_label: "Top P",
    param_type: "number" as ParamType,
    step: 0.1,
    options: null,
    default_value: 0.9,
  },
  {
    model_type: "llm" as ModelType,
    param_key: "topK",
    param_label: "Top K",
    param_type: "number" as ParamType,
    step: null,
    options: null,
    default_value: 40,
  },
  {
    model_type: "llm" as ModelType,
    param_key: "maxTokens",
    param_label: "Max Tokens",
    param_type: "number" as ParamType,
    step: null,
    options: null,
    default_value: 2048,
  },
  {
    model_type: "llm" as ModelType,
    param_key: "frequencyPenalty",
    param_label: "Frequency Penalty",
    param_type: "number" as ParamType,
    step: 0.1,
    options: null,
    default_value: 0,
  },
  {
    model_type: "llm" as ModelType,
    param_key: "presencePenalty",
    param_label: "Presence Penalty",
    param_type: "number" as ParamType,
    step: 0.1,
    options: null,
    default_value: 0,
  },
  // Embedding 参数
  {
    model_type: "embedding" as ModelType,
    param_key: "dimensions",
    param_label: "Dimensions",
    param_type: "number" as ParamType,
    step: null,
    options: null,
    default_value: 768,
  },
  {
    model_type: "embedding" as ModelType,
    param_key: "batchSize",
    param_label: "Batch Size",
    param_type: "number" as ParamType,
    step: null,
    options: null,
    default_value: 32,
  },
  {
    model_type: "embedding" as ModelType,
    param_key: "normalize",
    param_label: "Normalize",
    param_type: "select" as ParamType,
    step: null,
    options: [
      { value: "true", label: "True" },
      { value: "false", label: "False" },
    ],
    default_value: "true",
  },
  {
    model_type: "embedding" as ModelType,
    param_key: "chunkSize",
    param_label: "Chunk Size",
    param_type: "number" as ParamType,
    step: null,
    options: null,
    default_value: 512,
  },
  {
    model_type: "embedding" as ModelType,
    param_key: "chunkOverlap",
    param_label: "Chunk Overlap",
    param_type: "number" as ParamType,
    step: null,
    options: null,
    default_value: 64,
  },
  // ReRank 参数
  {
    model_type: "rerank" as ModelType,
    param_key: "topN",
    param_label: "Top N",
    param_type: "number" as ParamType,
    step: null,
    options: null,
    default_value: 5,
  },
  {
    model_type: "rerank" as ModelType,
    param_key: "scoreThreshold",
    param_label: "Score Threshold",
    param_type: "number" as ParamType,
    step: 0.1,
    options: null,
    default_value: 0.5,
  },
  {
    model_type: "rerank" as ModelType,
    param_key: "windowSize",
    param_label: "Window Size",
    param_type: "number" as ParamType,
    step: null,
    options: null,
    default_value: 3,
  },
  {
    model_type: "rerank" as ModelType,
    param_key: "strategy",
    param_label: "Strategy",
    param_type: "select" as ParamType,
    step: null,
    options: [
      { value: "cross-encoder", label: "Cross-Encoder" },
      { value: "bi-encoder", label: "Bi-Encoder" },
    ],
    default_value: "cross-encoder",
  },
];

/**
 * 初始化模型配置数据库
 */
export const initializeModelConfigDatabase = (): void => {
  try {
    const sqlite = getSqlite();

    // 创建模型配置表
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS model_configs (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        type TEXT NOT NULL CHECK (type IN ('llm', 'embedding', 'rerank')),
        name TEXT NOT NULL DEFAULT '',
        params TEXT NOT NULL DEFAULT '{}',
        is_default INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(type, is_default)
      )
    `);

    // 创建参数模板表
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS model_param_templates (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        model_type TEXT NOT NULL CHECK (model_type IN ('llm', 'embedding', 'rerank')),
        param_key TEXT NOT NULL,
        param_label TEXT NOT NULL,
        param_type TEXT NOT NULL CHECK (param_type IN ('number', 'select', 'boolean')),
        step REAL,
        options TEXT,
        default_value TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(model_type, param_key)
      )
    `);

    // 创建索引
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_model_configs_type ON model_configs(type);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_model_configs_type_default ON model_configs(type, is_default);
      CREATE INDEX IF NOT EXISTS idx_model_param_templates_type ON model_param_templates(model_type);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_model_param_templates_type_key ON model_param_templates(model_type, param_key);
    `);

    // 插入或更新默认配置
    for (const config of DEFAULT_CONFIGS) {
      modelConfigRepository.upsertDefault({
        type: config.type,
        name: config.name,
        params: JSON.stringify(config.params),
      });
    }

    // 插入或更新参数模板
    for (const template of PARAM_TEMPLATES) {
      modelParamTemplateRepository.upsert({
        modelType: template.model_type,
        paramKey: template.param_key,
        paramLabel: template.param_label,
        paramType: template.param_type,
        step: template.step,
        options: template.options ? JSON.stringify(template.options) : null,
        defaultValue: JSON.stringify(template.default_value),
      });
    }

    console.log("✅ Model config database initialized");
  } catch (err) {
    console.error("❌ Failed to initialize model config database:", err);
    throw err;
  }
};
