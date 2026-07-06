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
        "settings.model.connections.sidebarTitle": "Provider Connections",
        "settings.model.connections.sidebarDescription":
          "Review built-in and custom providers.",
        "settings.model.connections.builtinGroupTitle": "Built-in providers",
        "settings.model.connections.builtinGroupDescription":
          "System-managed providers",
        "settings.model.connections.customGroupTitle": "Custom providers",
        "settings.model.connections.customGroupDescription":
          "User-created provider connections",
        "settings.model.connections.boundSummary": "Bound {{roles}}",
        "settings.model.connections.unassignedSummary": "No role bindings yet",
        "settings.model.connections.loading": "Loading...",
        "settings.model.connections.emptyGroup": "Nothing here yet",
        "settings.model.connections.builtinBadge": "Built-in",
        "settings.model.connections.customBadge": "Custom",
        "settings.model.connections.sectionTitle": "Connection",
        "settings.model.connections.sectionDescription":
          "Manage the provider connection.",
        "settings.model.api.description": "Provider description",
        "settings.model.api.displayName": "Display name",
        "settings.model.api.displayNamePlaceholder": "Enter display name",
        "settings.model.api.connectionId": "Connection ID",
        "settings.model.api.apiKey": "API Key",
        "settings.model.api.apiKeyPlaceholder": "Enter API key",
        "settings.model.api.apiUrl": "API URL",
        "settings.model.api.apiUrlPlaceholder": "Enter API URL",
        "settings.model.api.currentModel": "Current Model",
        "settings.model.api.selectModel": "Select model...",
        "settings.model.api.noModels": "No models",
        "settings.model.api.fetchFailed": "fetch failed",
        "settings.model.api.syncedModelsTitle": "Synced Models",
        "settings.model.api.syncedModelsDescription": "Choose a synced model",
        "settings.model.api.roleBindingsTitle": "Role Bindings",
        "settings.model.api.roleBindingsDescription": "Bind model to roles",
        "settings.model.api.lastSyncedAt": "Last synced {{value}}",
        "settings.model.api.neverSynced": "Never synced",
        "settings.model.api.unassigned": "Unassigned",
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
        "settings.model.capabilities.sectionTitle": "Capabilities",
        "settings.model.capabilities.sectionDescription":
          "Capabilities are derived from backend support roles.",
        "settings.model.capabilities.chat": "Chat",
        "settings.model.capabilities.embedding": "Embedding",
        "settings.model.capabilities.rerank": "Rerank",
        "settings.model.capabilities.image": "Image",
        "settings.model.groups.chat.title": "Chat",
        "settings.model.groups.chat.description": "Chat group",
        "settings.model.groups.agentTask.title": "Agent / Task",
        "settings.model.groups.agentTask.description": "Agent group",
        "settings.model.groups.knowledgeBase.title": "Knowledge Base",
        "settings.model.groups.knowledgeBase.description": "KB group",
        "settings.model.groups.evaluation.title": "Evaluation",
        "settings.model.groups.evaluation.description": "Eval group",
        "settings.model.groups.imageGeneration.title": "Image Generation",
        "settings.model.groups.imageGeneration.description": "Image group",
        "settings.model.config.llm.title": "LLM",
        "settings.model.config.embedding.title": "Embedding",
        "settings.model.config.rerank.title": "Rerank",
        "settings.model.config.task.title": "Task",
        "settings.model.config.agentTask.title": "AgentTask",
        "settings.model.config.evaluation.title": "Evaluation",
        "settings.model.config.imageGeneration.title": "Image",
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
  it("groups built-in and custom providers in the sidebar", async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <PlatformConfigModal />
      </I18nextProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Built-in providers")).toBeInTheDocument();
    });

    expect(screen.getByText("Custom providers")).toBeInTheDocument();
    expect(screen.getAllByText("Ollama").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Custom OpenAI").length).toBeGreaterThan(0);
  });
});
