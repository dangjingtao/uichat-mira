import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { afterAll, test, vi } from "vitest";
import { getSqlite, resetDatabaseClients } from "@/db/index.js";
import { initializeModelConfigDatabase } from "@/db/model-config.db";
import {
  modelConfigRepository,
  providerConnectionRepository,
  providerModelRepository,
} from "@/db/repositories";
import { modelConfigService } from "./model-config.service.js";
import { buildDefaultParams } from "./model-config.defaults.js";
import { providerSettingsService } from "./provider-settings.service.js";
import * as openAiCompatibleProvider from "./openai-compatible-provider.js";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";

const testDbPath = createTimestampedTestArtifactPath(
  "db",
  "rag-demo-modelset-provider-settings",
  ".sqlite",
);

const legacyDb = new Database(testDbPath);
legacyDb.exec(`
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

  CREATE UNIQUE INDEX idx_provider_connections_provider_code_unique
  ON provider_connections(provider_code)
  WHERE provider_code IS NOT NULL;

  INSERT INTO provider_connections (
    id,
    template_code,
    provider_code,
    display_name,
    base_url,
    is_system
  ) VALUES (
    'existing-custom-provider',
    'openai-compatible-custom',
    NULL,
    'Existing Custom Provider',
    'https://custom.example.com/v1',
    0
  );

  CREATE TABLE provider_connection_reference_probe (
    id TEXT PRIMARY KEY,
    provider_connection_id TEXT REFERENCES provider_connections(id)
  );

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

  INSERT INTO model_configs (
    id,
    type,
    name,
    provider_code,
    remote_model_id,
    params,
    is_default
  ) VALUES (
    'task-default',
    'task',
    'legacy-task',
    'ollama',
    'legacy-task',
    '{"enabled":true,"temperature":0.7,"topP":0.9,"topK":40,"maxTokens":2048,"frequencyPenalty":0,"presencePenalty":0}',
    1
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
    // ignore cleanup failure on Windows file locking
  }
});

test("initializeModelConfigDatabase upgrades legacy model-role tables and seeds new defaults", () => {
  const sqlite = getSqlite();
  const modelConfigSql = sqlite
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'model_configs'")
    .get() as { sql?: string } | undefined;
  const templateSql = sqlite
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'model_param_templates'",
    )
    .get() as { sql?: string } | undefined;
  const providerConnectionSql = sqlite
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'provider_connections'",
    )
    .get() as { sql?: string } | undefined;
  const providerReferenceForeignKeys = sqlite
    .prepare("PRAGMA foreign_key_list(provider_connection_reference_probe)")
    .all() as Array<{ table: string }>;

  assert.ok(modelConfigSql?.sql?.includes("'agentTask'"));
  assert.ok(modelConfigSql?.sql?.includes("'imageGeneration'"));
  assert.ok(modelConfigSql?.sql?.includes("'google'"));
  assert.ok(templateSql?.sql?.includes("'agentTask'"));
  assert.ok(templateSql?.sql?.includes("'imageGeneration'"));
  assert.ok(providerConnectionSql?.sql?.includes("'volcengine-code-plan'"));
  assert.ok(providerConnectionSql?.sql?.includes("'volcengine-agent-plan'"));
  assert.equal(providerReferenceForeignKeys[0]?.table, "provider_connections");

  const agentTaskConfig = modelConfigRepository.findDefaultByType("agentTask");
  const imageGenerationConfig =
    modelConfigRepository.findDefaultByType("imageGeneration");
  assert.ok(agentTaskConfig);
  assert.ok(imageGenerationConfig);
  assert.deepEqual(agentTaskConfig ? JSON.parse(agentTaskConfig.params) : null, {
    enabled: true,
    temperature: 0,
    topP: 1,
    topK: 20,
    maxTokens: 128,
    frequencyPenalty: 0,
    presencePenalty: 0,
  });
  assert.deepEqual(
    imageGenerationConfig ? JSON.parse(imageGenerationConfig.params) : null,
    { enabled: true },
  );

  const paramTemplates = modelConfigService.getParamTemplates();
  assert.equal(paramTemplates.agentTask.length, 6);
  assert.equal(paramTemplates.imageGeneration.length, 1);

  const codePlan = providerConnectionRepository.findById("volcengine-code-plan");
  const agentPlan = providerConnectionRepository.findById("volcengine-agent-plan");
  const existingCustom = providerConnectionRepository.findById(
    "existing-custom-provider",
  );
  assert.equal(codePlan?.templateCode, "volcengine-code-plan");
  assert.equal(agentPlan?.templateCode, "volcengine-agent-plan");
  assert.equal(codePlan?.providerCode, "volcengine");
  assert.equal(agentPlan?.providerCode, "volcengine");
  assert.equal(existingCustom?.displayName, "Existing Custom Provider");
});

test("initializeModelConfigDatabase upgrades legacy provider_code constraint so google role binding can persist", () => {
  const updated = modelConfigRepository.upsertDefault({
    type: "llm",
    name: "gemini-2.5-flash",
    params: JSON.stringify(buildDefaultParams("llm")),
    providerCode: "google",
    providerConnectionId: "google",
    remoteModelId: "gemini-2.5-flash",
  });

  assert.equal(updated.providerCode, "google");
  assert.equal(updated.providerConnectionId, "google");
  assert.equal(updated.remoteModelId, "gemini-2.5-flash");
});

test("provider settings detail surfaces agentTask and imageGeneration assignments", () => {
  providerModelRepository.replaceForProvider("ollama", [
    {
      providerCode: "ollama",
      remoteModelId: "qwen-agent",
      modelName: "qwen-agent",
      rawPayloadJson: JSON.stringify({ name: "qwen-agent" }),
      isActive: true,
      syncedAt: "2026-07-06T10:00:00.000Z",
    },
    {
      providerCode: "ollama",
      remoteModelId: "flux-image",
      modelName: "flux-image",
      rawPayloadJson: JSON.stringify({ name: "flux-image" }),
      isActive: true,
      syncedAt: "2026-07-06T10:00:00.000Z",
    },
  ]);

  providerSettingsService.selectRoleModel("ollama", "agentTask", "qwen-agent");
  providerSettingsService.selectRoleModel(
    "ollama",
    "imageGeneration",
    "flux-image",
  );

  const detail = providerSettingsService.getProviderDetail("ollama");
  const summaries = providerSettingsService.getProviderSummaries();
  const ollamaSummary = summaries.find((item) => item.code === "ollama");

  assert.deepEqual(detail.assignments.agentTask, {
    providerCode: "ollama",
    providerConnectionId: "ollama",
    providerTemplateCode: "ollama",
    remoteModelId: "qwen-agent",
    modelName: "qwen-agent",
  });
  assert.deepEqual(detail.assignments.imageGeneration, {
    providerCode: "ollama",
    providerConnectionId: "ollama",
    providerTemplateCode: "ollama",
    remoteModelId: "flux-image",
    modelName: "flux-image",
  });
  assert.equal(detail.provider.capabilities.imageAdapter, "none");
  assert.ok(detail.provider.capabilities.supportsRoles.includes("agentTask"));
  assert.equal(
    detail.provider.capabilities.supportsRoles.includes("imageGeneration"),
    false,
  );
  assert.equal(ollamaSummary?.capabilities.imageAdapter, "none");
});

test("provider settings expose image adapter capability for openai", () => {
  const detail = providerSettingsService.getProviderDetail("openai");

  assert.equal(detail.provider.capabilities.imageAdapter, "openai-images");
  assert.ok(detail.provider.capabilities.supportsRoles.includes("imageGeneration"));
});

test("provider settings expose independent Ark Plan templates", () => {
  const templates = providerSettingsService.listProviderTemplates();
  const codePlan = templates.find(
    (template) => template.code === "volcengine-code-plan",
  );
  const agentPlan = templates.find(
    (template) => template.code === "volcengine-agent-plan",
  );

  assert.equal(codePlan?.displayName, "火山引擎 Code Plan");
  assert.equal(agentPlan?.displayName, "火山引擎 Agent Plan");
  assert.equal(codePlan?.capabilities.embeddingAdapter, "none");
  assert.equal(agentPlan?.capabilities.embeddingAdapter, "none");
  assert.equal(codePlan?.isCustomTemplate, false);
  assert.equal(agentPlan?.isCustomTemplate, false);
});

test("custom openai-compatible provider exposes image adapter capability", () => {
  const custom = providerSettingsService.createProviderConnection({
    templateCode: "openai-compatible-custom",
    displayName: "Custom Image Provider",
    baseUrl: "https://image.example.com/v1",
    apiKey: "image-key",
  });

  const detail = providerSettingsService.getProviderDetail(custom.id);

  assert.equal(detail.provider.capabilities.imageAdapter, "openai-images");
  assert.equal(
    detail.provider.capabilities.supportsRoles.includes("imageGeneration"),
    true,
  );
});

test("provider settings can bind a manually typed model id that is not in synced models", () => {
  const custom = providerSettingsService.createProviderConnection({
    templateCode: "openai-compatible-custom",
    displayName: "Manual Model Provider",
    baseUrl: "https://manual.example.com/v1",
    apiKey: "manual-key",
  });

  const updated = providerSettingsService.selectRoleModel(
    custom.id,
    "llm",
    "manual-custom-model",
  );

  assert.equal(updated.providerConnectionId, custom.id);
  assert.equal(updated.remoteModelId, "manual-custom-model");
  assert.equal(updated.name, "manual-custom-model");
  assert.equal(updated.providerTemplateCode, "openai-compatible-custom");
});

test("provider settings can create two custom OpenAI-compatible connections and bind a role to one of them", () => {
  const first = providerSettingsService.createProviderConnection({
    templateCode: "openai-compatible-custom",
    displayName: "Custom A",
    baseUrl: "https://a.example.com/v1",
    apiKey: "key-a",
  });
  const second = providerSettingsService.createProviderConnection({
    templateCode: "openai-compatible-custom",
    displayName: "Custom B",
    baseUrl: "https://b.example.com/v1",
    apiKey: "key-b",
  });

  assert.notEqual(first.id, second.id);
  assert.equal(first.code, first.id);
  assert.equal(second.code, second.id);
  assert.equal(first.hasApiKey, true);
  assert.equal(first.isSystem, false);

  providerModelRepository.replaceForConnection(first.id, [
    {
      providerConnectionId: first.id,
      providerCode: null,
      remoteModelId: "model-a",
      modelName: "Model A",
      rawPayloadJson: JSON.stringify({ id: "model-a" }),
      isActive: true,
      syncedAt: "2026-07-06T12:00:00.000Z",
    },
  ]);
  providerModelRepository.replaceForConnection(second.id, [
    {
      providerConnectionId: second.id,
      providerCode: null,
      remoteModelId: "model-b",
      modelName: "Model B",
      rawPayloadJson: JSON.stringify({ id: "model-b" }),
      isActive: true,
      syncedAt: "2026-07-06T12:00:00.000Z",
    },
  ]);

  const updated = providerSettingsService.selectRoleModel(first.id, "llm", "model-a");
  assert.equal(updated.providerConnectionId, first.id);
  assert.equal(updated.providerTemplateCode, "openai-compatible-custom");
  assert.equal(updated.providerCode, first.id);

  const detail = providerSettingsService.getProviderDetail(first.id);
  assert.equal(detail.provider.templateCode, "openai-compatible-custom");
  assert.deepEqual(detail.assignments.llm, {
    providerCode: first.id,
    providerConnectionId: first.id,
    providerTemplateCode: "openai-compatible-custom",
    remoteModelId: "model-a",
    modelName: "Model A",
  });
});

test("deleting a custom provider clears every default role binding that points to it", () => {
  const custom = providerSettingsService.createProviderConnection({
    templateCode: "openai-compatible-custom",
    displayName: "Custom Delete",
    baseUrl: "https://delete.example.com/v1",
    apiKey: "delete-key",
  });

  providerModelRepository.replaceForConnection(custom.id, [
    {
      providerConnectionId: custom.id,
      providerCode: null,
      remoteModelId: "llm-model",
      modelName: "LLM Model",
      rawPayloadJson: JSON.stringify({ id: "llm-model" }),
      isActive: true,
      syncedAt: "2026-07-07T10:00:00.000Z",
    },
    {
      providerConnectionId: custom.id,
      providerCode: null,
      remoteModelId: "embed-model",
      modelName: "Embed Model",
      rawPayloadJson: JSON.stringify({ id: "embed-model", dimensions: 1536 }),
      isActive: true,
      syncedAt: "2026-07-07T10:00:00.000Z",
    },
  ]);

  providerSettingsService.selectRoleModel(custom.id, "llm", "llm-model");
  providerSettingsService.selectRoleModel(custom.id, "embedding", "embed-model");

  providerSettingsService.deleteProviderConnection(custom.id);

  const llmConfig = modelConfigRepository.findDefaultByType("llm");
  const embeddingConfig = modelConfigRepository.findDefaultByType("embedding");

  assert.equal(llmConfig?.providerConnectionId, null);
  assert.equal(llmConfig?.providerCode, null);
  assert.equal(llmConfig?.remoteModelId, null);
  assert.equal(llmConfig?.name, "");

  assert.equal(embeddingConfig?.providerConnectionId, null);
  assert.equal(embeddingConfig?.providerCode, null);
  assert.equal(embeddingConfig?.remoteModelId, null);
  assert.equal(embeddingConfig?.name, "");
  assert.deepEqual(
    embeddingConfig ? JSON.parse(embeddingConfig.params) : null,
    buildDefaultParams("embedding"),
  );
});

test("google provider can save config and sync models through the provider instance path", async () => {
  const listSpy = vi
    .spyOn(openAiCompatibleProvider, "listOpenAICompatibleModels")
    .mockResolvedValue([
      {
        id: "gemini-2.5-flash",
        name: "gemini-2.5-flash",
        raw: { id: "gemini-2.5-flash" },
      },
    ]);

  providerSettingsService.saveProviderConnection("google", {
    displayName: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    apiKey: "google-key",
  });

  const synced = await providerSettingsService.syncProviderModels("google");

  assert.equal(listSpy.mock.calls.length > 0, true);
  assert.equal(synced.provider.id, "google");
  assert.equal(synced.provider.templateCode, "google");
  assert.deepEqual(synced.models, [
    {
      id: "gemini-2.5-flash",
      name: "gemini-2.5-flash",
    },
  ]);

  listSpy.mockRestore();
});
