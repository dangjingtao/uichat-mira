/**
 * 模型配置数据库初始化
 */
import { open } from "sqlite";
import sqlite3 from "sqlite3";
import path from "path";

const resolveDatabasePath = (): string => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  if (databaseUrl.startsWith("file:")) {
    return databaseUrl.slice(5);
  }
  if (databaseUrl.endsWith(".db") || databaseUrl.endsWith(".sqlite")) {
    return databaseUrl;
  }
  throw new Error("Only SQLite DATABASE_URL is supported");
};

export const openDatabase = async () =>
  open({
    filename: resolveDatabasePath(),
    driver: sqlite3.Database,
  });

/** 模型类型 */
export type ModelType = "llm" | "embedding" | "rerank";

/** 模型配置记录 */
export interface ModelConfigRecord {
  id: string;
  type: ModelType;
  name: string;
  params: string; // JSON string
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/** 参数模板记录 */
export interface ParamTemplateRecord {
  id: string;
  model_type: ModelType;
  param_key: string;
  param_label: string;
  param_type: "number" | "select" | "boolean";
  step: number | null;
  options: string | null; // JSON string
  default_value: string; // JSON string
  created_at: string;
}

/** 默认配置数据 */
const DEFAULT_CONFIGS: Array<{
  type: ModelType;
  name: string;
  params: Record<string, any>;
}> = [
  {
    type: "llm",
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
    type: "embedding",
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
    type: "rerank",
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
const PARAM_TEMPLATES: Array<{
  model_type: ModelType;
  param_key: string;
  param_label: string;
  param_type: "number" | "select" | "boolean";
  step: number | null;
  options: Record<string, string>[] | null;
  default_value: number | string | boolean;
}> = [
  // LLM 参数
  {
    model_type: "llm",
    param_key: "temperature",
    param_label: "Temperature",
    param_type: "number",
    step: 0.1,
    options: null,
    default_value: 0.7,
  },
  {
    model_type: "llm",
    param_key: "topP",
    param_label: "Top P",
    param_type: "number",
    step: 0.1,
    options: null,
    default_value: 0.9,
  },
  {
    model_type: "llm",
    param_key: "topK",
    param_label: "Top K",
    param_type: "number",
    step: null,
    options: null,
    default_value: 40,
  },
  {
    model_type: "llm",
    param_key: "maxTokens",
    param_label: "Max Tokens",
    param_type: "number",
    step: null,
    options: null,
    default_value: 2048,
  },
  {
    model_type: "llm",
    param_key: "frequencyPenalty",
    param_label: "Frequency Penalty",
    param_type: "number",
    step: 0.1,
    options: null,
    default_value: 0,
  },
  {
    model_type: "llm",
    param_key: "presencePenalty",
    param_label: "Presence Penalty",
    param_type: "number",
    step: 0.1,
    options: null,
    default_value: 0,
  },
  // Embedding 参数
  {
    model_type: "embedding",
    param_key: "dimensions",
    param_label: "Dimensions",
    param_type: "number",
    step: null,
    options: null,
    default_value: 768,
  },
  {
    model_type: "embedding",
    param_key: "batchSize",
    param_label: "Batch Size",
    param_type: "number",
    step: null,
    options: null,
    default_value: 32,
  },
  {
    model_type: "embedding",
    param_key: "normalize",
    param_label: "Normalize",
    param_type: "select",
    step: null,
    options: [
      { value: "true", label: "True" },
      { value: "false", label: "False" },
    ],
    default_value: "true",
  },
  {
    model_type: "embedding",
    param_key: "chunkSize",
    param_label: "Chunk Size",
    param_type: "number",
    step: null,
    options: null,
    default_value: 512,
  },
  {
    model_type: "embedding",
    param_key: "chunkOverlap",
    param_label: "Chunk Overlap",
    param_type: "number",
    step: null,
    options: null,
    default_value: 64,
  },
  // ReRank 参数
  {
    model_type: "rerank",
    param_key: "topN",
    param_label: "Top N",
    param_type: "number",
    step: null,
    options: null,
    default_value: 5,
  },
  {
    model_type: "rerank",
    param_key: "scoreThreshold",
    param_label: "Score Threshold",
    param_type: "number",
    step: 0.1,
    options: null,
    default_value: 0.5,
  },
  {
    model_type: "rerank",
    param_key: "windowSize",
    param_label: "Window Size",
    param_type: "number",
    step: null,
    options: null,
    default_value: 3,
  },
  {
    model_type: "rerank",
    param_key: "strategy",
    param_label: "Strategy",
    param_type: "select",
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
export const initializeModelConfigDatabase = async () => {
  const db = await openDatabase();

  try {
    // 检查并迁移数据库（处理旧版本没有唯一约束的情况）
    await checkAndMigrateTable(db);

    // 创建模型配置表
    await db.exec(`
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
    await db.exec(`
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
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_model_configs_type ON model_configs(type);
      CREATE INDEX IF NOT EXISTS idx_model_configs_default ON model_configs(type, is_default) WHERE is_default = 1;
      CREATE INDEX IF NOT EXISTS idx_param_templates_type ON model_param_templates(model_type);
    `);

    // 检查唯一约束是否存在
    const hasUniqueConstraint = await hasTableUniqueConstraint(db);

    // 插入默认配置
    for (const config of DEFAULT_CONFIGS) {
      if (hasUniqueConstraint) {
        await db.run(
          `INSERT INTO model_configs (type, name, params, is_default)
           VALUES (?, ?, ?, 1)
           ON CONFLICT(type, is_default) DO UPDATE SET
             name = excluded.name,
             params = excluded.params,
             updated_at = datetime('now')`,
          config.type,
          config.name,
          JSON.stringify(config.params),
        );
      } else {
        // 如果没有约束，先删除旧的再插入
        await db.run(
          `DELETE FROM model_configs WHERE type = ? AND is_default = 1`,
          config.type,
        );
        await db.run(
          `INSERT INTO model_configs (type, name, params, is_default) VALUES (?, ?, ?, 1)`,
          config.type,
          config.name,
          JSON.stringify(config.params),
        );
      }
    }

    // 插入参数模板
    for (const template of PARAM_TEMPLATES) {
      await db.run(
        `INSERT INTO model_param_templates 
         (model_type, param_key, param_label, param_type, step, options, default_value)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(model_type, param_key) DO UPDATE SET
           param_label = excluded.param_label,
           param_type = excluded.param_type,
           step = excluded.step,
           options = excluded.options,
           default_value = excluded.default_value`,
        template.model_type,
        template.param_key,
        template.param_label,
        template.param_type,
        template.step,
        template.options ? JSON.stringify(template.options) : null,
        JSON.stringify(template.default_value),
      );
    }

    console.log("✅ Model config database initialized");
  } finally {
    await db.close();
  }
};

/**
 * 检查表是否有 (type, is_default) 唯一约束
 */
async function hasTableUniqueConstraint(db: any): Promise<boolean> {
  try {
    const indexes = await db.all(`PRAGMA index_list(model_configs)`);
    // 检查是否有约束名称或唯一索引
    for (const idx of indexes) {
      if (idx.unique === 1) {
        const indexInfo = await db.all(`PRAGMA index_info(${idx.name})`);
        const columns = indexInfo.map((info: any) => info.name).sort();
        if (columns.includes("type") && columns.includes("is_default")) {
          return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 检查并迁移旧表结构
 */
async function checkAndMigrateTable(db: any): Promise<void> {
  // 检查表是否存在
  const tableExists = await db.get(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='model_configs'
  `);

  if (!tableExists) {
    return; // 新表，无需迁移
  }

  // 检查是否有唯一约束
  const hasConstraint = await hasTableUniqueConstraint(db);

  if (hasConstraint) {
    return; // 已有约束
  }

  console.log("🔧 检测到旧数据库结构，正在迁移...");

  // 执行迁移
  await db.exec(`
    -- 创建临时表带唯一约束
    CREATE TABLE model_configs_new (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      type TEXT NOT NULL CHECK (type IN ('llm', 'embedding', 'rerank')),
      name TEXT NOT NULL DEFAULT '',
      params TEXT NOT NULL DEFAULT '{}',
      is_default INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(type, is_default)
    );
    
    -- 迁移数据，保留每组最新的一条
    INSERT INTO model_configs_new (id, type, name, params, is_default, created_at, updated_at)
    SELECT id, type, name, params, is_default, created_at, updated_at
    FROM (
      SELECT *,
             ROW_NUMBER() OVER (PARTITION BY type, is_default ORDER BY created_at DESC) as rn
      FROM model_configs
    )
    WHERE rn = 1;
    
    -- 删除旧表
    DROP TABLE model_configs;
    
    -- 重命名新表
    ALTER TABLE model_configs_new RENAME TO model_configs;
  `);

  console.log("✅ 数据库迁移完成");
}
