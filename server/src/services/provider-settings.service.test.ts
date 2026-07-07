import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { afterAll, test, vi } from "vitest";
import { getSqlite, resetDatabaseClients } from "@/db/index.js";
import { initializeModelConfigDatabase } from "@/db/model-config.db";
import {
  modelConfigRepository,
  providerModelRepository,
} from "@/db/repositories";
import { modelConfigService } from "./model-config.service.js";
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
  CREATE TABLE model_configs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('llm', 'embedding', 'rerank', 'task', 'evaluation')),
    name TEXT NOT NULL DEFAULT '',
    provider_code TEXT,
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

  assert.ok(modelConfigSql?.sql?.includes("'agentTask'"));
  assert.ok(modelConfigSql?.sql?.includes("'imageGeneration'"));
  assert.ok(templateSql?.sql?.includes("'agentTask'"));
  assert.ok(templateSql?.sql?.includes("'imageGeneration'"));

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
