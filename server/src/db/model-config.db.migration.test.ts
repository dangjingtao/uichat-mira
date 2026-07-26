import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { afterAll, test } from "vitest";
import { getSqlite, resetDatabaseClients } from "@/db/index.js";
import { initializeModelConfigDatabase } from "@/db/model-config.db.js";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";

const testDbPath = createTimestampedTestArtifactPath(
  "db",
  "model-config-provider-model-migration",
  ".sqlite",
);

const legacyDb = new Database(testDbPath);
legacyDb.pragma("foreign_keys = ON");
legacyDb.exec(`
  CREATE TABLE model_configs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('llm', 'embedding', 'rerank', 'task', 'evaluation')),
    name TEXT NOT NULL DEFAULT '',
    provider_code TEXT CHECK (provider_code IN ('ollama', 'lmstudio', 'openai', 'cloudflare', 'volcengine')),
    remote_model_id TEXT,
    params TEXT NOT NULL DEFAULT '{}',
    is_default INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE model_param_templates (
    id TEXT PRIMARY KEY,
    model_type TEXT NOT NULL CHECK (model_type IN ('llm', 'embedding', 'rerank', 'task', 'evaluation')),
    param_key TEXT NOT NULL,
    param_label TEXT NOT NULL,
    param_type TEXT NOT NULL,
    step REAL,
    options TEXT,
    default_value TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(model_type, param_key)
  );

  CREATE TABLE provider_connections (
    id TEXT PRIMARY KEY,
    template_code TEXT NOT NULL CHECK (template_code IN ('ollama', 'lmstudio', 'openai', 'google', 'cloudflare', 'volcengine', 'openai-compatible-custom')),
    provider_code TEXT CHECK (provider_code IN ('ollama', 'lmstudio', 'openai', 'google', 'cloudflare', 'volcengine')),
    display_name TEXT NOT NULL,
    base_url TEXT NOT NULL DEFAULT '',
    api_key_encrypted TEXT,
    is_system INTEGER NOT NULL DEFAULT 0,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'idle',
    last_error TEXT,
    last_synced_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  INSERT INTO provider_connections (
    id,
    template_code,
    provider_code,
    display_name,
    base_url,
    is_system
  ) VALUES (
    'custom-openai-compatible',
    'openai-compatible-custom',
    NULL,
    'Custom OpenAI Compatible',
    'https://example.invalid/v1',
    0
  );

  CREATE TABLE provider_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_connection_id TEXT NOT NULL REFERENCES provider_connections(id) ON DELETE CASCADE,
    provider_code TEXT CHECK (provider_code IN ('ollama', 'lmstudio', 'openai', 'google', 'cloudflare', 'volcengine')),
    remote_model_id TEXT NOT NULL,
    model_name TEXT NOT NULL,
    raw_payload_json TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    synced_at TEXT NOT NULL,
    UNIQUE(provider_connection_id, remote_model_id)
  );

  INSERT INTO provider_models (
    provider_connection_id,
    provider_code,
    remote_model_id,
    model_name,
    raw_payload_json,
    is_active,
    synced_at
  ) VALUES (
    'custom-openai-compatible',
    NULL,
    'custom-chat-model',
    'Custom Chat Model',
    '{"id":"custom-chat-model"}',
    1,
    '2026-07-25T00:00:00.000Z'
  );
`);
legacyDb.close();

process.env.DATABASE_URL = `file:${testDbPath}`;
resetDatabaseClients();
initializeModelConfigDatabase();

afterAll(() => {
  resetDatabaseClients();
  try {
    fs.rmSync(testDbPath, { force: true });
  } catch {
    // Ignore Windows cleanup failures caused by delayed SQLite file release.
  }
});

test("provider model rebuild preserves a custom provider connection id when provider_code is null", () => {
  const sqlite = getSqlite();
  const migrated = sqlite
    .prepare(`
      SELECT provider_connection_id, provider_code, remote_model_id, model_name
      FROM provider_models
      WHERE remote_model_id = 'custom-chat-model'
    `)
    .get() as
    | {
        provider_connection_id: string;
        provider_code: string | null;
        remote_model_id: string;
        model_name: string;
      }
    | undefined;

  assert.deepEqual(migrated, {
    provider_connection_id: "custom-openai-compatible",
    provider_code: null,
    remote_model_id: "custom-chat-model",
    model_name: "Custom Chat Model",
  });

  const legacyTable = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'provider_models_legacy'",
    )
    .get();
  assert.equal(legacyTable, undefined);
});
