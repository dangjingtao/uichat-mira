import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendRouteError } from "@/utils/route-errors.js";

const service = vi.hoisted(() => ({
  listProviderTemplates: vi.fn(),
  getProviderSummaries: vi.fn(),
  exportModelSettings: vi.fn(),
  importModelSettings: vi.fn(),
  createProviderConnection: vi.fn(),
  getProviderDetail: vi.fn(),
  saveProviderConnection: vi.fn(),
  deleteProviderConnection: vi.fn(),
  syncProviderModels: vi.fn(),
  selectRoleModel: vi.fn(),
  resetRoleModel: vi.fn(),
}));

vi.mock("@/services/provider-settings.service.js", () => ({ providerSettingsService: service }));

import providerSettingsRoute from "./index.js";

const createApp = async () => {
  const app = Fastify();
  app.setSerializerCompiler(() => (data) => JSON.stringify(data));
  app.setErrorHandler(sendRouteError);
  await app.register(providerSettingsRoute);
  return app;
};

describe("provider settings routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.listProviderTemplates.mockReturnValue([]);
    service.getProviderSummaries.mockReturnValue([]);
    service.exportModelSettings.mockReturnValue({ format: "uichat-mira-model-settings", version: 1 });
    service.createProviderConnection.mockReturnValue({ id: "custom-1" });
    service.getProviderDetail.mockReturnValue({ provider: { id: "custom-1" } });
    service.saveProviderConnection.mockReturnValue({ id: "custom-1" });
    service.syncProviderModels.mockResolvedValue({ models: [] });
    service.selectRoleModel.mockReturnValue({ id: "model-1" });
    service.resetRoleModel.mockReturnValue({ id: "model-1" });
  });

  it("creates, updates, and deletes a provider connection through the service", async () => {
    const app = await createApp();
    const created = await app.inject({
      method: "POST",
      url: "/providers",
      payload: {
        templateCode: "openai-compatible-custom",
        displayName: "Private gateway",
        baseUrl: "https://gateway.example/v1",
        apiKey: "secret",
      },
    });
    expect(created.statusCode).toBe(200);
    expect(service.createProviderConnection).toHaveBeenCalledWith(expect.objectContaining({
      displayName: "Private gateway",
      apiKey: "secret",
    }));

    const saved = await app.inject({
      method: "PUT",
      url: "/providers/custom-1",
      payload: { displayName: "Updated", baseUrl: "https://gateway.example/v1", apiKey: "new-secret" },
    });
    expect(saved.statusCode).toBe(200);
    expect(service.saveProviderConnection).toHaveBeenCalledWith("custom-1", expect.objectContaining({
      apiKey: "new-secret",
    }));

    const deleted = await app.inject({ method: "DELETE", url: "/providers/custom-1" });
    expect(deleted.statusCode).toBe(200);
    expect(service.deleteProviderConnection).toHaveBeenCalledWith("custom-1");
    await app.close();
  });

  it("maps invalid backup imports to a stable 400 error", async () => {
    service.importModelSettings.mockImplementation(() => {
      throw new Error("backup checksum mismatch");
    });
    const app = await createApp();
    const response = await app.inject({
      method: "PUT",
      url: "/providers/model-settings/import",
      payload: {
        format: "uichat-mira-model-settings",
        version: 1,
        exportedAt: "2026-08-04T00:00:00.000Z",
        connections: [],
        assignments: [],
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      success: false,
      code: "MODEL_SETTINGS_IMPORT_INVALID",
      message: "backup checksum mismatch",
    });
    await app.close();
  });

  it("normalizes legacy empty model-settings references before import", async () => {
    service.importModelSettings.mockReturnValue({
      connectionCount: 2,
      assignmentCount: 1,
    });
    const app = await createApp();
    const response = await app.inject({
      method: "PUT",
      url: "/providers/model-settings/import",
      payload: {
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
      },
    });

    expect(response.statusCode).toBe(200);
    expect(service.importModelSettings).toHaveBeenCalledWith({
      format: "uichat-mira-model-settings",
      version: 1,
      exportedAt: "2026-08-29T00:00:00.000Z",
      connections: [
        expect.objectContaining({ id: "custom-legacy", providerCode: null }),
        expect.objectContaining({ id: "ollama", providerCode: "ollama" }),
      ],
      assignments: [
        expect.objectContaining({
          type: "agentTask",
          providerConnectionId: null,
          remoteModelId: null,
        }),
      ],
    });
    await app.close();
  });

  it("maps provider sync and role-selection failures to 400 without hiding the cause", async () => {
    service.syncProviderModels.mockRejectedValue(new Error("provider offline"));
    service.selectRoleModel.mockImplementation(() => {
      throw new Error("remote model missing");
    });
    const app = await createApp();

    const sync = await app.inject({ method: "POST", url: "/providers/custom-1/sync-models" });
    expect(sync.statusCode).toBe(400);
    expect(sync.json().message).toContain("provider offline");

    const select = await app.inject({
      method: "PUT",
      url: "/providers/custom-1/select-model/task",
      payload: { remoteModelId: "missing-model" },
    });
    expect(select.statusCode).toBe(400);
    expect(select.json()).toMatchObject({
      code: "PROVIDER_MODEL_SELECTION_FAILED",
      message: "remote model missing",
    });
    await app.close();
  });

  it("resets a validated role assignment", async () => {
    const app = await createApp();
    const response = await app.inject({ method: "PUT", url: "/providers/reset-model/rerank" });
    expect(response.statusCode).toBe(200);
    expect(service.resetRoleModel).toHaveBeenCalledWith("rerank");

    const invalid = await app.inject({ method: "PUT", url: "/providers/reset-model/not-a-role" });
    expect(invalid.statusCode).toBe(400);
    expect(service.resetRoleModel).toHaveBeenCalledTimes(1);
    await app.close();
  });
});
