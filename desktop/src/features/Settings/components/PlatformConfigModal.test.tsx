// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import type { ProviderDetail, ProviderSummary } from "@/shared/api/modelSettings";

const providerSummaries: ProviderSummary[] = [
  {
    id: "ollama",
    code: "ollama",
    templateCode: "ollama",
    providerCode: "ollama",
    displayName: "Ollama",
    baseUrl: "http://127.0.0.1:11434",
    hasApiKey: false,
    status: "connected",
    lastError: null,
    lastSyncedAt: "2026-07-06T10:00:00.000Z",
    assignedRoles: ["llm"],
    isSystem: true,
    capabilities: {
      syncAdapter: "ollama",
      chatAdapter: "ollama",
      embeddingAdapter: "ollama",
      rerankAdapter: "none",
      imageAdapter: "none",
      supportsRoles: ["llm", "embedding"],
    },
  },
  {
    id: "custom-openai",
    code: "custom-openai",
    templateCode: "openai-compatible-custom",
    providerCode: null,
    displayName: "Custom OpenAI",
    baseUrl: "https://custom.example/v1",
    hasApiKey: true,
    status: "idle",
    lastError: null,
    lastSyncedAt: null,
    assignedRoles: [],
    isSystem: false,
    capabilities: {
      syncAdapter: "openai-compatible",
      chatAdapter: "openai-compatible",
      embeddingAdapter: "openai-compatible",
      rerankAdapter: "none",
      imageAdapter: "none",
      supportsRoles: ["llm", "embedding", "task"],
    },
  },
];

const providerDetail: ProviderDetail = {
  provider: {
    id: "ollama",
    code: "ollama",
    templateCode: "ollama",
    providerCode: "ollama",
    displayName: "Ollama",
    baseUrl: "http://127.0.0.1:11434",
    apiKey: "",
    hasApiKey: false,
    status: "connected",
    lastError: null,
    lastSyncedAt: "2026-07-06T10:00:00.000Z",
    isSystem: true,
    capabilities: providerSummaries[0].capabilities,
  },
  models: [{ id: "qwen2.5:latest", name: "qwen2.5:latest" }],
  assignments: {
    llm: null,
    embedding: null,
    rerank: null,
    task: null,
    agentTask: null,
    evaluation: null,
    imageGeneration: null,
  },
};

const refreshMock = vi.fn(async () => []);

vi.mock("@/shared/api/modelSettings", () => ({
  getProviders: vi.fn(async () => providerSummaries),
  getProviderDetail: vi.fn(async () => providerDetail),
  saveProviderConfig: vi.fn(async () => undefined),
  selectProviderRoleModel: vi.fn(async () => ({})),
  syncProviderModels: vi.fn(async () => undefined),
}));

vi.mock("@/app/providers/RoleModelConfigProvider", () => ({
  useRoleModelConfigs: () => ({
    refresh: refreshMock,
  }),
  broadcastRoleModelConfigChanged: () => {},
}));

const i18n = i18next.createInstance();
void i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: {
      translation: {
        "settings.model.api.description": "Provider description",
        "settings.model.api.apiKey": "API Key",
        "settings.model.api.apiKeyPlaceholder": "Enter API key",
        "settings.model.api.apiUrl": "API URL",
        "settings.model.api.apiUrlPlaceholder": "Enter API URL",
        "settings.model.api.currentModel": "Current Model",
        "settings.model.api.selectModel": "Select model...",
        "settings.model.api.noModels": "No models",
        "settings.model.api.syncAriaLabel": "Sync models",
        "settings.model.api.setDefaultLlm": "Set as Default LLM",
        "settings.model.api.setDefaultEmbedding":
          "Set as Default Embedding",
        "settings.model.api.setDefaultRerank": "Set as Default ReRank",
        "settings.model.api.setDefaultTask": "Set as Default Task",
        "settings.model.api.setDefaultAgentTask":
          "Set as Default AgentTask",
        "settings.model.api.setDefaultEvaluation":
          "Set as Default Evaluation Model",
        "settings.model.api.setDefaultImageGeneration":
          "Set as Default Image Generation Model",
        "settings.model.api.setting": "Setting...",
        "settings.model.status.connected": "Connected",
        "settings.model.status.idle": "Idle",
        "settings.model.platform.title": "Platform",
        "settings.model.platform.bound": "Bound {{roles}}",
        "settings.model.platform.waitingSync": "Waiting sync",
        "settings.model.platformConfig.syncSuccess": "Sync success",
        "settings.model.platformConfig.syncFailed": "Sync failed",
        "settings.model.platformConfig.loadFailed": "Load failed",
        "settings.model.platformConfig.loadDetailFailed": "Load detail failed",
        "settings.model.platformConfig.requestAborted": "Request aborted",
      },
    },
  },
});

import PlatformConfigModal from "./PlatformConfigModal";

describe("PlatformConfigModal", () => {
  it("renders provider list with built-in and custom entries in one platform panel", async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <PlatformConfigModal />
      </I18nextProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Platform")).toBeInTheDocument();
    });

    expect(screen.getAllByText("Ollama").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Custom OpenAI").length).toBeGreaterThan(0);
  });
});
