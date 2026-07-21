// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import ApiConfigCard from "./ApiConfigCard";
import type { ProviderDetail } from "@/shared/api/modelSettings";

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
    capabilities: {
      syncAdapter: "ollama",
      chatAdapter: "ollama",
      embeddingAdapter: "ollama",
      rerankAdapter: "none",
      imageAdapter: "none",
      supportsRoles: ["llm", "embedding", "task", "agentTask"],
    },
  },
  models: [{ id: "qwen2.5:latest", name: "qwen2.5:latest" }],
  assignments: {
    llm: {
      providerCode: "ollama",
      providerConnectionId: "ollama",
      providerTemplateCode: "ollama",
      remoteModelId: "qwen2.5:latest",
      modelName: "qwen2.5:latest",
    },
    embedding: null,
    rerank: null,
    task: null,
    agentTask: null,
    evaluation: null,
    imageGeneration: null,
  },
};

const i18n = i18next.createInstance();
void i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: {
      translation: {
        "settings.model.api.description": "Provider description",
        "settings.model.api.displayName": "Display name",
        "settings.model.api.displayNamePlaceholder": "Enter display name",
        "settings.model.api.connectionId": "Connection ID",
        "settings.model.api.apiKey": "API Key",
        "settings.model.api.apiKeyPlaceholder": "Enter API key",
        "settings.model.api.apiUrl": "API URL",
        "settings.model.api.apiUrlPlaceholder": "Enter API URL",
        "settings.model.api.modelName": "Model Name",
        "settings.model.api.modelNamePlaceholder": "Enter model name",
        "settings.model.api.syncedModel": "Synced Model",
        "settings.model.api.currentModel": "Current Model",
        "settings.model.api.syncedModelsTitle": "Synced Models",
        "settings.model.api.syncedModelsDescription": "Choose a synced model",
        "settings.model.api.roleBindingsTitle": "Role Bindings",
        "settings.model.api.roleBindingsDescription": "Bind model to roles",
        "settings.model.api.lastSyncedAt": "Last synced {{value}}",
        "settings.model.api.neverSynced": "Never synced",
        "settings.model.api.unassigned": "Unassigned",
        "settings.model.api.fetchFailed": "fetch failed",
        "settings.model.api.syncAriaLabel": "Sync models",
        "settings.model.api.selectModel": "Select model...",
        "settings.model.api.noModels": "No models",
        "settings.model.api.setting": "Setting...",
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
        "settings.model.status.connected": "Connected",
        "settings.model.connections.builtinBadge": "Built-in",
        "settings.model.connections.sectionTitle": "Connection",
        "settings.model.connections.sectionDescription":
          "Manage the provider connection.",
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
      },
    },
  },
});

describe("ApiConfigCard", () => {
  it("shows only assignment actions declared by provider capabilities", async () => {
    const user = userEvent.setup();
    const onSetDefaultRole = vi.fn();

    render(
      <I18nextProvider i18n={i18n}>
        <ApiConfigCard
          detail={providerDetail}
          selectedModelId="qwen2.5:latest"
          currentModelName="qwen2.5:latest"
          onApiKeyChange={() => {}}
          onApiUrlChange={() => {}}
          onSelectedModelChange={() => {}}
          onModelNameChange={() => {}}
          onTestConnection={() => {}}
          onSetDefaultRole={onSetDefaultRole}
        />
      </I18nextProvider>,
    );

    await user.click(
      screen.getByRole("button", { name: "Set as Default AgentTask" }),
    );
    expect(onSetDefaultRole).toHaveBeenNthCalledWith(1, "agentTask");
    expect(
      screen.queryByRole("button", {
        name: "Set as Default Image Generation Model",
      }),
    ).not.toBeInTheDocument();
  });

  it("shows capability badges and grouped role summaries", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ApiConfigCard
          detail={providerDetail}
          selectedModelId="qwen2.5:latest"
          currentModelName="qwen2.5:latest"
          onApiKeyChange={() => {}}
          onApiUrlChange={() => {}}
          onSelectedModelChange={() => {}}
          onModelNameChange={() => {}}
          onTestConnection={() => {}}
          onSetDefaultRole={() => {}}
        />
      </I18nextProvider>,
    );

    expect(screen.getByLabelText("API Key")).toBeInTheDocument();
    expect(screen.getByLabelText("API URL")).toBeInTheDocument();
    expect(screen.getByLabelText("Model Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Synced Model")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sync models" })).toBeInTheDocument();
  });
});
