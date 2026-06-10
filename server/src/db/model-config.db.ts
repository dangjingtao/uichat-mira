import {
  getSqlite,
  modelConfigRepository,
  modelParamTemplateRepository,
  providerConnectionRepository,
} from "@/db";
import {
  DEFAULT_PROVIDER_CONNECTIONS,
  DEFAULT_ROLE_CONFIGS,
  PARAM_TEMPLATES,
} from "@/services/model-config.defaults.js";
import { toSqlEnumValues, PROVIDER_CODE_VALUES } from "@/providers/codes.js";

const providerCodeSqlValues = toSqlEnumValues(PROVIDER_CODE_VALUES);

const tableDefinitionSupportsLatestProviders = (tableName: string) => {
  const sqlite = getSqlite();
  const row = sqlite
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
    )
    .get(tableName) as { sql?: string } | undefined;
  return (
    row?.sql?.includes("'cloudflare'") &&
    row?.sql?.includes("'volcengine'") &&
    row?.sql?.includes("'openai'") &&
    row?.sql?.includes("'ollama'") &&
    row?.sql?.includes("'lmstudio'")
  ) ?? false;
};

const recreateModelConfigsTable = () => {
  const sqlite = getSqlite();

  sqlite.exec(`
    ALTER TABLE model_configs RENAME TO model_configs__legacy;

    CREATE TABLE model_configs (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      type TEXT NOT NULL CHECK (type IN ('llm', 'embedding', 'rerank')),
      name TEXT NOT NULL DEFAULT '',
      provider_code TEXT CHECK (provider_code IN (${providerCodeSqlValues})),
      remote_model_id TEXT,
      params TEXT NOT NULL DEFAULT '{}',
      is_default INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(type, is_default)
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

const migrateProviderSchemaForProviders = () => {
  const sqlite = getSqlite();
  const needsModelConfigsMigration =
    hasColumn("model_configs", "provider_code") &&
    !tableDefinitionSupportsLatestProviders("model_configs");
  const needsProviderConnectionsMigration =
    hasColumn("provider_connections", "provider_code") &&
    !tableDefinitionSupportsLatestProviders("provider_connections");
  const needsProviderModelsMigration =
    hasColumn("provider_models", "provider_code") &&
    !tableDefinitionSupportsLatestProviders("provider_models");

  if (
    !needsModelConfigsMigration &&
    !needsProviderConnectionsMigration &&
    !needsProviderModelsMigration
  ) {
    return;
  }

  sqlite.pragma("foreign_keys = OFF");

  try {
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
    });

    tx();
  } finally {
    sqlite.pragma("foreign_keys = ON");
  }
};

const hasColumn = (tableName: string, columnName: string) => {
  const sqlite = getSqlite();
  const rows = sqlite
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{
    name: string;
  }>;
  return rows.some((row) => row.name === columnName);
};

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
      CREATE UNIQUE INDEX IF NOT EXISTS idx_model_configs_type_default ON model_configs(type, is_default);
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
      modelConfigRepository.upsertDefault({
        type: config.type,
        name: config.name,
        params: JSON.stringify(config.params),
        providerCode: config.providerCode,
        remoteModelId: config.remoteModelId,
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
