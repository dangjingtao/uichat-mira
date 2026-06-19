import {
  getSqlite,
  modelConfigRepository,
  modelParamTemplateRepository,
  providerConnectionRepository,
} from "@/db";
import { applySqliteConnectionPragmas } from "@/db/init-utils";
import {
  DEFAULT_PROVIDER_CONNECTIONS,
  DEFAULT_ROLE_CONFIGS,
  MANAGED_TASK_PARAMS,
  PARAM_TEMPLATES,
} from "@/services/model-config.defaults.js";
import { toSqlEnumValues, PROVIDER_CODE_VALUES } from "@/providers/codes.js";

const parseParams = (paramsJson: string) => {
  try {
    const parsed = JSON.parse(paramsJson || "{}");
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

const hasLegacyTaskParams = (params: Record<string, unknown>) =>
  params.temperature === 0.7 &&
  params.topP === 0.9 &&
  params.topK === 40 &&
  params.maxTokens === 2048 &&
  params.frequencyPenalty === 0 &&
  params.presencePenalty === 0;

const needsManagedTaskParams = (params: Record<string, unknown>) => {
  const expectedEntries = Object.entries(MANAGED_TASK_PARAMS);

  return (
    hasLegacyTaskParams(params) ||
    expectedEntries.some(([key, value]) => params[key] !== value)
  );
};

const providerCodeSqlValues = toSqlEnumValues(PROVIDER_CODE_VALUES);
const modelTypeSqlValues = "'llm', 'embedding', 'rerank', 'task', 'evaluation'";

const tableSupportsEvaluationRole = (
  sqlite: ReturnType<typeof getSqlite>,
  tableName: string,
) => {
  const row = sqlite
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { sql?: string } | undefined;

  return row?.sql?.includes("'evaluation'") ?? false;
};

const recreateModelConfigTablesForEvaluationRole = (
  sqlite: ReturnType<typeof getSqlite>,
) => {
  if (
    tableSupportsEvaluationRole(sqlite, "model_configs") &&
    tableSupportsEvaluationRole(sqlite, "model_param_templates")
  ) {
    return;
  }

  sqlite.exec("BEGIN");

  try {
    sqlite.exec(`
      DROP INDEX IF EXISTS idx_model_configs_type_default;
      DROP INDEX IF EXISTS idx_model_configs_type;
      DROP INDEX IF EXISTS idx_model_param_templates_type;
      DROP INDEX IF EXISTS idx_model_param_templates_type_key;
    `);

    if (!tableSupportsEvaluationRole(sqlite, "model_configs")) {
      sqlite.exec(`
        ALTER TABLE model_configs RENAME TO model_configs_legacy;

        CREATE TABLE model_configs (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          type TEXT NOT NULL CHECK (type IN (${modelTypeSqlValues})),
          name TEXT NOT NULL DEFAULT '',
          provider_code TEXT CHECK (provider_code IN (${providerCodeSqlValues})),
          remote_model_id TEXT,
          params TEXT NOT NULL DEFAULT '{}',
          is_default INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        INSERT INTO model_configs (
          id,
          type,
          name,
          provider_code,
          remote_model_id,
          params,
          is_default,
          created_at,
          updated_at
        )
        SELECT
          id,
          type,
          name,
          provider_code,
          remote_model_id,
          params,
          is_default,
          created_at,
          updated_at
        FROM model_configs_legacy;

        DROP TABLE model_configs_legacy;
      `);
    }

    if (!tableSupportsEvaluationRole(sqlite, "model_param_templates")) {
      sqlite.exec(`
        ALTER TABLE model_param_templates RENAME TO model_param_templates_legacy;

        CREATE TABLE model_param_templates (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          model_type TEXT NOT NULL CHECK (model_type IN (${modelTypeSqlValues})),
          param_key TEXT NOT NULL,
          param_label TEXT NOT NULL,
          param_type TEXT NOT NULL CHECK (param_type IN ('number', 'select', 'boolean')),
          step REAL,
          options TEXT,
          default_value TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(model_type, param_key)
        );

        INSERT INTO model_param_templates (
          id,
          model_type,
          param_key,
          param_label,
          param_type,
          step,
          options,
          default_value,
          created_at
        )
        SELECT
          id,
          model_type,
          param_key,
          param_label,
          param_type,
          step,
          options,
          default_value,
          created_at
        FROM model_param_templates_legacy;

        DROP TABLE model_param_templates_legacy;
      `);
    }

    sqlite.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_model_configs_type_default
      ON model_configs(type)
      WHERE is_default = 1;
      CREATE INDEX IF NOT EXISTS idx_model_configs_type ON model_configs(type);
      CREATE INDEX IF NOT EXISTS idx_model_param_templates_type ON model_param_templates(model_type);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_model_param_templates_type_key ON model_param_templates(model_type, param_key);
    `);

    sqlite.exec("COMMIT");
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }
};

export const initializeModelConfigDatabase = (): void => {
  try {
    const sqlite = getSqlite();
    applySqliteConnectionPragmas(sqlite);

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS model_configs (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        type TEXT NOT NULL CHECK (type IN (${modelTypeSqlValues})),
        name TEXT NOT NULL DEFAULT '',
        provider_code TEXT CHECK (provider_code IN (${providerCodeSqlValues})),
        remote_model_id TEXT,
        params TEXT NOT NULL DEFAULT '{}',
        is_default INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    sqlite.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_model_configs_type_default
      ON model_configs(type)
      WHERE is_default = 1
    `);

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS model_param_templates (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        model_type TEXT NOT NULL CHECK (model_type IN (${modelTypeSqlValues})),
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

    recreateModelConfigTablesForEvaluationRole(sqlite);

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS provider_connections (
        provider_code TEXT PRIMARY KEY CHECK (provider_code IN (${providerCodeSqlValues})),
        display_name TEXT NOT NULL,
        base_url TEXT NOT NULL DEFAULT '',
        api_key_encrypted TEXT,
        is_enabled INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'syncing', 'connected', 'error')),
        last_error TEXT,
        last_synced_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS provider_models (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_code TEXT NOT NULL CHECK (provider_code IN (${providerCodeSqlValues})),
        remote_model_id TEXT NOT NULL,
        model_name TEXT NOT NULL,
        raw_payload_json TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        synced_at TEXT NOT NULL,
        UNIQUE(provider_code, remote_model_id)
      )
    `);

    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_model_configs_type ON model_configs(type);
      CREATE INDEX IF NOT EXISTS idx_model_param_templates_type ON model_param_templates(model_type);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_model_param_templates_type_key ON model_param_templates(model_type, param_key);
      CREATE INDEX IF NOT EXISTS idx_provider_connections_status ON provider_connections(status);
      CREATE INDEX IF NOT EXISTS idx_provider_models_provider ON provider_models(provider_code);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_models_provider_remote ON provider_models(provider_code, remote_model_id);
    `);

    for (const provider of DEFAULT_PROVIDER_CONNECTIONS) {
      const existingProvider = providerConnectionRepository.findByCode(
        provider.providerCode,
      );

      if (existingProvider) {
        continue;
      }

      providerConnectionRepository.upsert({
        providerCode: provider.providerCode,
        displayName: provider.displayName,
        baseUrl: provider.baseUrl,
        apiKeyEncrypted: null,
        isEnabled: true,
        status: "idle",
        lastError: null,
        lastSyncedAt: null,
      });
    }

    for (const config of DEFAULT_ROLE_CONFIGS) {
      const existing = modelConfigRepository.findDefaultByType(config.type);
      if (!existing) {
        modelConfigRepository.upsertDefault({
          type: config.type,
          name: config.name,
          params: JSON.stringify(config.params),
          providerCode: config.providerCode,
          remoteModelId: config.remoteModelId,
        });
      }
    }

    const rerankDefault = DEFAULT_ROLE_CONFIGS.find(
      (config) => config.type === "rerank",
    );
    const existingRerank = modelConfigRepository.findDefaultByType("rerank");

    if (
      rerankDefault &&
      existingRerank &&
      !existingRerank.providerCode &&
      !existingRerank.remoteModelId
    ) {
      modelConfigRepository.upsertDefault({
        type: rerankDefault.type,
        name: rerankDefault.name,
        params: JSON.stringify(rerankDefault.params),
        providerCode: rerankDefault.providerCode,
        remoteModelId: rerankDefault.remoteModelId,
      });
    }

    const taskDefault = DEFAULT_ROLE_CONFIGS.find(
      (config) => config.type === "task",
    );
    const existingTask = modelConfigRepository.findDefaultByType("task");

    if (taskDefault && existingTask) {
      const currentTaskParams = parseParams(existingTask.params);
      if (
        needsManagedTaskParams(currentTaskParams) ||
        existingTask.providerCode !== taskDefault.providerCode ||
        existingTask.remoteModelId !== taskDefault.remoteModelId ||
        existingTask.name !== taskDefault.name
      ) {
        modelConfigRepository.updateDefault("task", {
          params: JSON.stringify({
            ...currentTaskParams,
            ...MANAGED_TASK_PARAMS,
          }),
          providerCode: taskDefault.providerCode,
          remoteModelId: taskDefault.remoteModelId,
          name: taskDefault.name,
        });
      }
    }

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
  } catch (err) {
    console.error("Failed to initialize model config database:", err);
    throw err;
  }
};
