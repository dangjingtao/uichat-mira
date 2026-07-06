import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/request", () => ({
  del: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));

import { del, get, post, put } from "@/shared/lib/request";
import {
  createProviderConnection,
  deleteProviderConnection,
  getRoleModelConfigs,
  updateRoleModelConfigParams,
  getProviders,
  getProviderDetail,
  getProviderTemplates,
  saveProviderConfig,
  syncProviderModels,
  selectProviderRoleModel,
  resetProviderRoleModel,
  type ProviderTemplateSummary,
  type RoleModelConfig,
  type ProviderSummary,
  type ProviderDetail,
  type SyncModelsResponse,
} from "../modelSettings";

const sampleRoleConfig: RoleModelConfig = {
  id: "cfg-1",
  type: "llm",
  name: "LLM",
  providerCode: "openai",
  providerConnectionId: "openai",
  providerTemplateCode: "openai",
  remoteModelId: "gpt-4o",
  params: { temperature: 0.7 },
  isDefault: false,
  createdAt: "2026-07-06T00:00:00.000Z",
  updatedAt: "2026-07-06T00:00:00.000Z",
};

const sampleProvider: ProviderSummary = {
  id: "openai",
  code: "openai",
  templateCode: "openai",
  providerCode: "openai",
  displayName: "OpenAI",
  baseUrl: "https://api.openai.com",
  hasApiKey: true,
  status: "connected",
  lastError: null,
  lastSyncedAt: "2026-07-06T00:00:00.000Z",
  assignedRoles: ["llm"],
  isSystem: true,
  capabilities: {
    syncAdapter: "openai-compatible",
    chatAdapter: "openai-compatible",
    embeddingAdapter: "openai-compatible",
    rerankAdapter: "none",
    imageAdapter: "openai-images",
    supportsRoles: ["llm"],
  },
};

const sampleProviderDetail: ProviderDetail = {
  provider: {
    id: "openai",
    code: "openai",
    templateCode: "openai",
    providerCode: "openai",
    displayName: "OpenAI",
    baseUrl: "https://api.openai.com",
    apiKey: "sk-***",
    hasApiKey: true,
    status: "connected",
    lastError: null,
    lastSyncedAt: "2026-07-06T00:00:00.000Z",
    isSystem: true,
    capabilities: sampleProvider.capabilities,
  },
  models: [{ id: "gpt-4o", name: "GPT-4o" }],
  assignments: {
    llm: {
      providerCode: "openai",
      providerConnectionId: "openai",
      providerTemplateCode: "openai",
      remoteModelId: "gpt-4o",
      modelName: "GPT-4o",
    },
    embedding: null,
    rerank: null,
    task: null,
    agentTask: null,
    evaluation: null,
    imageGeneration: null,
  },
};

const sampleTemplates: ProviderTemplateSummary[] = [
  {
    code: "google",
    displayName: "Google Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    capabilities: sampleProvider.capabilities,
    isCustomTemplate: false,
  },
];

const sampleSyncResponse: SyncModelsResponse = {
  provider: sampleProvider,
  models: [{ id: "gpt-4o", name: "GPT-4o" }],
};

describe("model settings api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getRoleModelConfigs 获取角色模型配置", async () => {
    vi.mocked(get).mockResolvedValueOnce([sampleRoleConfig]);

    const result = await getRoleModelConfigs();

    expect(get).toHaveBeenCalledWith("/models");
    expect(result).toEqual([sampleRoleConfig]);
  });

  it("updateRoleModelConfigParams 更新指定角色参数", async () => {
    vi.mocked(put).mockResolvedValueOnce(sampleRoleConfig);

    const result = await updateRoleModelConfigParams("llm", { temperature: 0.5 });

    expect(put).toHaveBeenCalledWith("/models/llm/config", {
      params: { temperature: 0.5 },
    });
    expect(result).toBe(sampleRoleConfig);
  });

  it("getProviders 获取提供商列表", async () => {
    vi.mocked(get).mockResolvedValueOnce([sampleProvider]);

    const result = await getProviders();

    expect(get).toHaveBeenCalledWith("/providers");
    expect(result).toEqual([sampleProvider]);
  });

  it("getProviderTemplates 获取提供商模板列表", async () => {
    vi.mocked(get).mockResolvedValueOnce(sampleTemplates);

    const result = await getProviderTemplates();

    expect(get).toHaveBeenCalledWith("/provider-templates");
    expect(result).toEqual(sampleTemplates);
  });

  it("getProviderDetail 获取提供商详情", async () => {
    vi.mocked(get).mockResolvedValueOnce(sampleProviderDetail);

    const result = await getProviderDetail("openai");

    expect(get).toHaveBeenCalledWith("/providers/openai");
    expect(result).toBe(sampleProviderDetail);
  });

  it("saveProviderConfig 保存提供商配置", async () => {
    vi.mocked(put).mockResolvedValueOnce(undefined);

    const payload = {
      displayName: "OpenAI",
      baseUrl: "https://api.openai.com",
      apiKey: "sk-xxx",
    };
    const result = await saveProviderConfig("openai", payload);

    expect(put).toHaveBeenCalledWith("/providers/openai", payload);
    expect(result).toBeUndefined();
  });

  it("createProviderConnection 创建自定义连接", async () => {
    vi.mocked(post).mockResolvedValueOnce(sampleProvider);

    const payload = {
      templateCode: "openai-compatible-custom",
      displayName: "Custom OpenAI",
      baseUrl: "https://custom.example/v1",
      apiKey: "sk-custom",
    };
    const result = await createProviderConnection(payload);

    expect(post).toHaveBeenCalledWith("/providers", payload);
    expect(result).toBe(sampleProvider);
  });

  it("syncProviderModels 同步指定提供商模型", async () => {
    vi.mocked(post).mockResolvedValueOnce(sampleSyncResponse);

    const result = await syncProviderModels("openai");

    expect(post).toHaveBeenCalledWith("/providers/openai/sync-models");
    expect(result).toBe(sampleSyncResponse);
  });

  it("selectProviderRoleModel 选择角色模型", async () => {
    vi.mocked(put).mockResolvedValueOnce(sampleRoleConfig);

    const result = await selectProviderRoleModel("openai", "llm", "gpt-4o");

    expect(put).toHaveBeenCalledWith(
      "/providers/openai/select-model/llm",
      { remoteModelId: "gpt-4o" },
    );
    expect(result).toBe(sampleRoleConfig);
  });

  it("selectProviderRoleModel 附带连接参数", async () => {
    vi.mocked(put).mockResolvedValueOnce(sampleRoleConfig);

    const connectionPayload = { baseUrl: "https://api.x.com", apiKey: "key" };
    const result = await selectProviderRoleModel(
      "openai",
      "llm",
      "gpt-4o",
      connectionPayload,
    );

    expect(put).toHaveBeenCalledWith(
      "/providers/openai/select-model/llm",
      { remoteModelId: "gpt-4o", ...connectionPayload },
    );
    expect(result).toBe(sampleRoleConfig);
  });

  it("deleteProviderConnection 删除自定义连接", async () => {
    vi.mocked(del).mockResolvedValueOnce({ id: "custom-1" });

    const result = await deleteProviderConnection("custom-1");

    expect(del).toHaveBeenCalledWith("/providers/custom-1");
    expect(result).toEqual({ id: "custom-1" });
  });

  it("resetProviderRoleModel 重置角色模型", async () => {
    vi.mocked(put).mockResolvedValueOnce(sampleRoleConfig);

    const result = await resetProviderRoleModel("llm");

    expect(put).toHaveBeenCalledWith("/providers/reset-model/llm", {});
    expect(result).toBe(sampleRoleConfig);
  });
});
