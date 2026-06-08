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

const hasColumn = (tableName: string, columnName: string) => {
  const sqlite = getSqlite();
  const rows = sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    name: string;
  }>;
  return rows.some((row) => row.name === columnName);
};

const ensureColumn = (tableName: string, columnName: string, definition: string) => {
  const sqlite = getSqlite();
  if (hasColumn(tableName, columnName)) {
    return;
  }
  sqlite.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
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
      "TEXT CHECK (provider_code IN ('ollama', 'lmstudio', 'openai'))",
    );
    ensureColumn("model_configs", "remote_model_id", "TEXT");

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
        provider_code TEXT PRIMARY KEY CHECK (provider_code IN ('ollama', 'lmstudio', 'openai')),
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
        provider_code TEXT NOT NULL CHECK (provider_code IN ('ollama', 'lmstudio', 'openai')),
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
