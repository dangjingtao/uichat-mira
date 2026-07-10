// @vitest-environment jsdom

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ProviderDetail,
  ProviderSummary,
  RoleModelConfig,
  ProviderTemplateSummary,
} from "@/shared/api/modelSettings";

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
      imageAdapter: "openai-images",
      supportsRoles: ["llm", "embedding", "task", "imageGeneration"],
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
    voice: null,
  },
};

const customProviderDetail: ProviderDetail = {
  provider: {
    id: "custom-openai",
    code: "custom-openai",
    templateCode: "openai-compatible-custom",
    providerCode: null,
    displayName: "Custom OpenAI",
    baseUrl: "https://custom.example/v1",
    apiKey: "secret",
    hasApiKey: true,
    status: "idle",
    lastError: null,
    lastSyncedAt: null,
    isSystem: false,
    capabilities: providerSummaries[1].capabilities,
  },
  models: [{ id: "custom-model", name: "custom-model" }],
  assignments: {
    llm: {
      providerCode: "custom-openai",
      providerConnectionId: "custom-openai",
      providerTemplateCode: "openai-compatible-custom",
      remoteModelId: "custom-model",
      modelName: "custom-model",
    },
    embedding: null,
    rerank: null,
    task: null,
    agentTask: null,
    evaluation: null,
    imageGeneration: null,
    voice: null,
  },
};

const providerTemplates: ProviderTemplateSummary[] = [
  {
    code: "openai-compatible-custom",
    displayName: "Custom OpenAI-Compatible",
    defaultBaseUrl: "https://api.example.com/v1",
    capabilities: providerSummaries[1].capabilities,
    isCustomTemplate: true,
  },
];

const refreshMock = vi.fn(async () => []);
const configMap = {
  llm: {
    id: "cfg-custom-llm",
    type: "llm",
    name: "custom-model",
    providerCode: "custom-openai",
    providerConnectionId: "custom-openai",
    providerConnectionDisplayName: "Custom OpenAI",
    providerTemplateCode: "openai-compatible-custom",
    remoteModelId: "custom-model",
    params: {},
    isDefault: true,
    createdAt: "2026-07-06T10:00:00.000Z",
    updatedAt: "2026-07-06T10:00:00.000Z",
  },
  embedding: null,
  rerank: null,
  task: null,
  agentTask: null,
  evaluation: null,
  imageGeneration: null,
  voice: null,
} as const;
const apiMocks = vi.hoisted(() => ({
  selectProviderRoleModelMock: vi.fn(
    async (): Promise<RoleModelConfig> => ({
      id: "cfg-1",
      type: "llm",
      name: "qwen2.5:latest",
      providerCode: "ollama",
      providerConnectionId: "ollama",
      providerConnectionDisplayName: "Ollama",
      providerTemplateCode: "ollama",
      remoteModelId: "qwen2.5:latest",
      params: {},
      isDefault: true,
      createdAt: "2026-07-06T10:00:00.000Z",
      updatedAt: "2026-07-06T10:00:00.000Z",
    }),
  ),
  createProviderConnectionMock: vi.fn(async () => providerSummaries[1]),
  deleteProviderConnectionMock: vi.fn(async () => ({ id: "custom-openai" })),
  modalConfirmMock: vi.fn(),
}));

vi.mock("@/shared/api/modelSettings", () => ({
  getProviders: vi.fn(async () => providerSummaries),
  getProviderDetail: vi.fn(async (providerCode: string) =>
    providerCode === "custom-openai" ? customProviderDetail : providerDetail,
  ),
  getProviderTemplates: vi.fn(async () => providerTemplates),
  createProviderConnection: apiMocks.createProviderConnectionMock,
  deleteProviderConnection: apiMocks.deleteProviderConnectionMock,
  saveProviderConfig: vi.fn(async () => undefined),
  selectProviderRoleModel: apiMocks.selectProviderRoleModelMock,
  syncProviderModels: vi.fn(async () => undefined),
}));

vi.mock("@/app/providers/RoleModelConfigProvider", () => ({
  useRoleModelConfigs: () => ({
    configMap,
    refresh: refreshMock,
  }),
  broadcastRoleModelConfigChanged: () => {},
}));

vi.mock("@/shared/ui/Modal", () => ({
  Modal: {
    confirm: (options: { onConfirm: () => void | Promise<void> }) => {
      apiMocks.modalConfirmMock(options);
      void options.onConfirm();
      return "modal_1";
    },
    show: vi.fn(),
    close: vi.fn(),
    destroy: vi.fn(),
  },
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
        "settings.model.api.modelName": "Model Name",
        "settings.model.api.modelNamePlaceholder": "Enter model name",
        "settings.model.api.syncedModel": "Synced Model",
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
        "settings.model.platform.searchPlaceholder": "Search providers",
        "settings.model.platform.addProvider": "Add provider",
        "settings.model.platform.noResults": "No matching providers",
        "settings.model.platform.createTitle": "Create provider",
        "settings.model.platform.createDescription":
          "Create a custom OpenAI-compatible provider connection.",
        "settings.model.platform.createNamePlaceholder":
          "Enter provider name",
        "settings.model.platform.createNameRequired":
          "Please enter provider name",
        "settings.model.platform.createProvider": "Create provider",
        "settings.model.platform.creatingProvider": "Creating...",
        "settings.model.platform.createSuccess": "Provider created",
        "settings.model.platform.createFailed": "Create failed",
        "settings.model.platform.deleteProvider": "Delete provider",
        "settings.model.platform.deletingProvider": "Deleting...",
        "settings.model.platform.deleteTitle": "Delete custom provider",
        "settings.model.platform.deleteDescription":
          "After deletion, {{name}} and every default model binding that points to it will be cleared.",
        "settings.model.platform.deleteConfirm": "Delete provider",
        "settings.model.platform.deleteSuccess":
          "Provider deleted and related default model bindings were cleared",
        "settings.model.platform.deleteFailed": "Delete failed",
        "settings.model.platformConfig.syncSuccess": "Sync success",
        "settings.model.platformConfig.syncFailed": "Sync failed",
        "settings.model.platformConfig.loadFailed": "Load failed",
        "settings.model.platformConfig.loadDetailFailed": "Load detail failed",
        "settings.model.platformConfig.requestAborted": "Request aborted",
        "settings.model.api.displayName": "Display Name",
      },
    },
  },
});

import PlatformConfigModal from "./PlatformConfigModal";

describe("PlatformConfigModal", () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

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

  it("hides role buttons and confirms a single role selection in selection mode", async () => {
    const ref = { current: null as null | { confirmSelection: () => Promise<boolean> } };

    render(
      <I18nextProvider i18n={i18n}>
        <PlatformConfigModal
          ref={(value) => {
            ref.current = value;
          }}
          selectionRole="llm"
          onSelectionStateChange={() => {}}
        />
      </I18nextProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Model Name")).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("button", { name: "Set as Default LLM" }),
    ).not.toBeInTheDocument();

    let confirmed = false;
    await act(async () => {
      confirmed = (await ref.current?.confirmSelection()) ?? false;
    });
    expect(confirmed).toBe(true);
    expect(apiMocks.selectProviderRoleModelMock).toHaveBeenCalledWith(
      "custom-openai",
      "llm",
      "custom-model",
      {
        baseUrl: "https://custom.example/v1",
        apiKey: "secret",
      },
    );
  });

  it("filters providers by search query", async () => {
    const user = userEvent.setup();

    render(
      <I18nextProvider i18n={i18n}>
        <PlatformConfigModal />
      </I18nextProvider>,
    );

    const searchInput = await screen.findByPlaceholderText("Search providers");
    await user.type(searchInput, "custom");

    expect(screen.getAllByText("Custom OpenAI").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: /Ollama/i }),
    ).not.toBeInTheDocument();
  });

  it("shows delete action for custom providers and deletes after confirmation", async () => {
    const user = userEvent.setup();

    render(
      <I18nextProvider i18n={i18n}>
        <PlatformConfigModal />
      </I18nextProvider>,
    );

    const customProviderButton = await screen.findByRole("button", {
      name: /Custom OpenAI/i,
    });
    await user.click(customProviderButton);

    const deleteButton = await screen.findByRole("button", {
      name: /Delete provider/i,
    });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(apiMocks.deleteProviderConnectionMock).toHaveBeenCalledWith(
        "custom-openai",
      );
    });
    expect(apiMocks.modalConfirmMock).toHaveBeenCalled();
  });

  it("reports confirmable selection state for imageGeneration on custom openai-compatible providers", async () => {
    const onSelectionStateChange = vi.fn();
    const user = userEvent.setup();

    render(
      <I18nextProvider i18n={i18n}>
        <PlatformConfigModal
          selectionRole="imageGeneration"
          onSelectionStateChange={onSelectionStateChange}
        />
      </I18nextProvider>,
    );

    const customProviderButton = await screen.findByRole("button", {
      name: /Custom OpenAI/i,
    });
    await user.click(customProviderButton);
    await user.type(await screen.findByLabelText("Model Name"), "image-model");

    await waitFor(() => {
      expect(onSelectionStateChange).toHaveBeenLastCalledWith({
        canConfirm: true,
        confirming: false,
      });
    });
  });

  it("opens on the provider already bound to the current role and shows its detail", async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <PlatformConfigModal selectionRole="llm" onSelectionStateChange={() => {}} />
      </I18nextProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText("Custom OpenAI").length).toBeGreaterThan(0);
    });

    expect(
      screen.getByRole("button", { name: /Custom OpenAI/i }),
    ).toHaveClass("border-primary/20");
    expect(screen.getByDisplayValue("https://custom.example/v1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("custom-model")).toBeInTheDocument();
  });

  it("uses synced model dropdown as a helper and writes the chosen value into model name", async () => {
    const user = userEvent.setup();

    render(
      <I18nextProvider i18n={i18n}>
        <PlatformConfigModal
          selectionRole="imageGeneration"
          onSelectionStateChange={() => {}}
        />
      </I18nextProvider>,
    );

    const customProviderButton = await screen.findByRole("button", {
      name: /Custom OpenAI/i,
    });
    await user.click(customProviderButton);

    const syncedModelTrigger = await screen.findByRole("combobox", {
      name: "Synced Model",
    });
    await user.click(syncedModelTrigger);
    await user.click(await screen.findByRole("option", { name: "custom-model" }));

    expect(screen.getByDisplayValue("custom-model")).toBeInTheDocument();
    expect(
      globalThis.localStorage.getItem("rag-demo-model-name-drafts"),
    ).toContain("imageGeneration::custom-openai");
    expect(
      globalThis.localStorage.getItem("rag-demo-model-name-drafts"),
    ).toContain("custom-model");
  });

  it("restores the locally stored model draft for the current role and provider", async () => {
    const user = userEvent.setup();

    globalThis.localStorage.setItem(
      "rag-demo-model-name-drafts",
      JSON.stringify({
        "llm::custom-openai": "remembered-model",
      }),
    );

    render(
      <I18nextProvider i18n={i18n}>
        <PlatformConfigModal selectionRole="llm" onSelectionStateChange={() => {}} />
      </I18nextProvider>,
    );

    const customProviderButton = await screen.findByRole("button", {
      name: /Custom OpenAI/i,
    });
    await user.click(customProviderButton);

    await waitFor(() => {
      expect(screen.getByDisplayValue("remembered-model")).toBeInTheDocument();
    });
  });

  it("writes manual model name drafts into localStorage", async () => {
    const user = userEvent.setup();

    render(
      <I18nextProvider i18n={i18n}>
        <PlatformConfigModal selectionRole="imageGeneration" onSelectionStateChange={() => {}} />
      </I18nextProvider>,
    );

    const customProviderButton = await screen.findByRole("button", {
      name: /Custom OpenAI/i,
    });
    await user.click(customProviderButton);
    const modelNameInput = await screen.findByLabelText("Model Name");
    await user.clear(modelNameInput);
    await user.type(modelNameInput, "manual-image-model");

    expect(
      globalThis.localStorage.getItem("rag-demo-model-name-drafts"),
    ).toContain("imageGeneration::custom-openai");
    expect(
      globalThis.localStorage.getItem("rag-demo-model-name-drafts"),
    ).toContain("manual-image-model");
  });
});
