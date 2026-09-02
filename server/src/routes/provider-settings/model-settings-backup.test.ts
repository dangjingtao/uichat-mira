import assert from "node:assert/strict";
import { test } from "vitest";
import type { ModelSettingsBackup } from "@/services/provider-settings.service.js";
import { normalizeModelSettingsBackup } from "./model-settings-backup.js";

test("normalizes legacy empty model-settings references without changing backup version", () => {
  const legacyBackup = {
    format: "uichat-mira-model-settings",
    version: 1,
    exportedAt: "2026-08-29T00:00:00.000Z",
    connections: [
      {
        id: "custom-legacy",
        templateCode: "openai-compatible-custom",
        providerCode: "",
        displayName: "Legacy Custom",
        baseUrl: "https://legacy.example.com/v1",
        apiKey: "secret",
      },
      {
        id: "ollama",
        templateCode: "ollama",
        providerCode: "",
        displayName: "Ollama",
        baseUrl: "http://127.0.0.1:11434",
        apiKey: "",
      },
    ],
    assignments: [
      {
        type: "agentTask",
        name: "",
        providerConnectionId: "",
        remoteModelId: "",
        params: { enabled: true },
      },
    ],
  } as unknown as ModelSettingsBackup;

  const normalized = normalizeModelSettingsBackup(legacyBackup);

  assert.equal(normalized.version, 1);
  assert.equal(normalized.connections[0]?.providerCode, null);
  assert.equal(normalized.connections[1]?.providerCode, "ollama");
  assert.equal(normalized.assignments[0]?.providerConnectionId, null);
  assert.equal(normalized.assignments[0]?.remoteModelId, null);
});
