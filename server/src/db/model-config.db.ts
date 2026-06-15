import {
  getSqlite,
  modelConfigRepository,
  modelParamTemplateRepository,
  providerConnectionRepository,
} from "@/db";
import {
  applySqliteConnectionPragmas,
  withSqliteForeignKeysDisabled,
} from "@/db/init-utils";
import { getSqliteTableSql, hasSqliteColumn } from "@/db/sqlite-utils";
import {
  DEFAULT_PROVIDER_CONNECTIONS,
  DEFAULT_ROLE_CONFIGS,
  PARAM_TEMPLATES,
} from "@/services/model-config.defaults.js";
import { toSqlEnumValues, PROVIDER_CODE_VALUES } from "@/providers/codes.js";

const providerCodeSqlValues = toSqlEnumValues(PROVIDER_CODE_VALUES);

const tableDefinitionSupportsLatestProviders = (tableName: string) => {
  const sqlite = getSqlite();
  const tableSql = getSqliteTableSql(sqlite, tableName);
  return (
    (tableSql?.includes("'cloudflare'") &&
      tableSql?.includes("'volcengine'") &&
      tableSql?.includes("'openai'") &&
      tableSql?.includes("'ollama'") &&
      tableSql?.includes("'lmstudio'")) ??
    false
  );
};

const tableDefinitionSupportsTaskType = (tableName: string) => {
  const sqlite = getSqlite();
  return getSqliteTableSql(sqlite, tableName)?.includes("'task'") ?? false;
};

const hasLegacyModelConfigDefaultUniqueness = () => {
  const sqlite = getSqlite();
  const normalizedSql = getSqliteTableSql(sqlite, "model_configs")?.toUpperCase() ?? "";
  return normalizedSql.includes("UNIQUE(TYPE, IS_DEFAULT)");
};

const recreateModelConfigsTable = () => {
  const sqlite = getSqlite();

  sqlite.exec(`
    ALTER TABLE model_configs RENAME TO model_configs__legacy;

    CREATE TABLE model_configs (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      type TEXT NOT NULL CHECK (type IN ('llm', 'embedding', 'rerank', 'task')),
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
    FROM model_configs__legacy;

    DROP TABLE model_configs__legacy;

    CREATE UNIQUE INDEX idx_model_configs_type_default
    ON model_configs(type)
    WHERE is_default = 1;
  `);
};

const recreateProviderConnectionsTable = () => {
  const sqlite = getSqlite();

  sqlite.exec(`
    ALTER TABLE provider_connections RENAME TO provider_connections__legacy;

    CREATE TABLE provider_connections (
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
    );

    INSERT INTO provider_connections (
      provider_code,
      display_name,
      base_url,
      api_key_encrypted,
      is_enabled,
      status,
      last_error,
      last_synced_at,
      created_at,
      updated_at
    )
    SELECT
      provider_code,
      display_name,
      base_url,
      api_key_encrypted,
      is_enabled,
      status,
      last_error,
      last_synced_at,
      created_at,
      updated_at
    FROM provider_connections__legacy;

    DROP TABLE provider_connections__legacy;
  `);
};

const recreateProviderModelsTable = () => {
  const sqlite = getSqlite();

  sqlite.exec(`
    ALTER TABLE provider_models RENAME TO provider_models__legacy;

    CREATE TABLE provider_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_code TEXT NOT NULL CHECK (provider_code IN (${providerCodeSqlValues})),
      remote_model_id TEXT NOT NULL,
      model_name TEXT NOT NULL,
      raw_payload_json TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      synced_at TEXT NOT NULL,
      UNIQUE(provider_code, remote_model_id)
    );

    INSERT INTO provider_models (
      id,
      provider_code,
      remote_model_id,
      model_name,
      raw_payload_json,
      is_active,
      synced_at
    )
    SELECT
      id,
      provider_code,
      remote_model_id,
      model_name,
      raw_payload_json,
      is_active,
      synced_at
    FROM provider_models__legacy;

    DROP TABLE provider_models__legacy;
  `);
};

const recreateModelParamTemplatesTable = () => {
  const sqlite = getSqlite();

  sqlite.exec(`
    ALTER TABLE model_param_templates RENAME TO model_param_templates__legacy;

    CREATE TABLE model_param_templates (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      model_type TEXT NOT NULL CHECK (model_type IN ('llm', 'embedding', 'rerank', 'task')),
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
    FROM model_param_templates__legacy;

    DROP TABLE model_param_templates__legacy;
  `);
};

const migrateProviderSchemaForProviders = () => {
  const sqlite = getSqlite();
  const needsModelConfigsMigration =
    hasColumn("model_configs", "provider_code") &&
    (!tableDefinitionSupportsLatestProviders("model_configs") ||
      !tableDefinitionSupportsTaskType("model_configs") ||
      hasLegacyModelConfigDefaultUniqueness());
  const needsProviderConnectionsMigration =
    hasColumn("provider_connections", "provider_code") &&
    !tableDefinitionSupportsLatestProviders("provider_connections");
  const needsProviderModelsMigration =
    hasColumn("provider_models", "provider_code") &&
    !tableDefinitionSupportsLatestProviders("provider_models");
  const needsModelParamTemplatesMigration =
    hasColumn("model_param_templates", "model_type") &&
    !tableDefinitionSupportsTaskType("model_param_templates");

  if (
    !needsModelConfigsMigration &&
    !needsProviderConnectionsMigration &&
    !needsProviderModelsMigration &&
    !needsModelParamTemplatesMigration
  ) {
    return;
  }

  withSqliteForeignKeysDisabled(sqlite, () => {
    const tx = sqlite.transaction(() => {
      if (needsModelConfigsMigration) {
        recreateModelConfigsTable();
      }
      if (needsProviderConnectionsMigration) {
        recreateProviderConnectionsTable();
      }
      if (needsProviderModelsMigration) {
        recreateProviderModelsTable();
      }
      if (needsModelParamTemplatesMigration) {
        recreateModelParamTemplatesTable();
      }
    });

    tx();
  });
};

const hasColumn = (tableName: string, columnName: string) =>
  hasSqliteColumn(getSqlite(), tableName, columnName);

const ensureColumn = (
  tableName: string,
  columnName: string,
  definition: string,
) => {
  const sqlite = getSqlite();
  if (hasColumn(tableName, columnName)) {
    return;
  }
  sqlite.exec(
    `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`,
  );
};

export const initializeModelConfigDatabase = (): void => {
  try {
    const sqlite = getSqlite();
    applySqliteConnectionPragmas(sqlite);

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS model_configs (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        type TEXT NOT NULL CHECK (type IN ('llm', 'embedding', 'rerank', 'task')),
        name TEXT NOT NULL DEFAULT '',
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

    ensureColumn(
      "model_configs",
      "provider_code",
      `TEXT CHECK (provider_code IN (${providerCodeSqlValues}))`,
    );
    ensureColumn("model_configs", "remote_model_id", "TEXT");

    migrateProviderSchemaForProviders();

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS model_param_templates (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        model_type TEXT NOT NULL CHECK (model_type IN ('llm', 'embedding', 'rerank', 'task')),
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
