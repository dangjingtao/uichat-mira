import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendRouteError } from "@/utils/route-errors.js";

const service = vi.hoisted(() => ({
  getAllDefaultConfigs: vi.fn(),
  getDefaultConfig: vi.fn(),
  updateDefaultConfig: vi.fn(),
  getParamTemplates: vi.fn(),
}));

vi.mock("@/services/model-config.service.js", () => ({ modelConfigService: service }));

import modelConfigRoute from "./model-config.js";

const model = {
  id: "model-1",
  type: "llm",
  name: "Primary",
  providerCode: "openai",
  providerConnectionId: "openai",
  providerConnectionDisplayName: "OpenAI",
  providerTemplateCode: "openai",
  remoteModelId: "gpt-test",
  params: { temperature: 0.2 },
  isDefault: true,
  createdAt: "2026-08-04T00:00:00.000Z",
  updatedAt: "2026-08-04T00:00:00.000Z",
};

const createApp = async () => {
  const app = Fastify();
  app.setSerializerCompiler(() => (data) => JSON.stringify(data));
  app.setErrorHandler(sendRouteError);
  await app.register(modelConfigRoute);
  return app;
};

describe("model config routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.getAllDefaultConfigs.mockReturnValue([model]);
    service.getDefaultConfig.mockReturnValue(model);
    service.updateDefaultConfig.mockReturnValue(model);
    service.getParamTemplates.mockReturnValue({ llm: [] });
  });

  it("lists and reads active model configurations", async () => {
    const app = await createApp();
    const list = await app.inject({ method: "GET", url: "/models" });
    expect(list.statusCode).toBe(200);
    expect(list.json().data).toEqual([model]);

    const detail = await app.inject({ method: "GET", url: "/models/llm/config" });
    expect(detail.statusCode).toBe(200);
    expect(service.getDefaultConfig).toHaveBeenCalledWith("llm");
    await app.close();
  });

  it("returns 404 when an active role model does not exist", async () => {
    service.getDefaultConfig.mockReturnValue(null);
    const app = await createApp();
    const response = await app.inject({ method: "GET", url: "/models/llm/config" });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ success: false, code: "NOT_FOUND" });
    await app.close();
  });

  it("validates roles and strips undeclared update fields", async () => {
    const app = await createApp();
    const updated = await app.inject({
      method: "PUT",
      url: "/models/task/config",
      payload: { name: "Task model", params: { enabled: true }, ignored: true },
    });
    expect(updated.statusCode).toBe(200);
    expect(service.updateDefaultConfig).toHaveBeenCalledWith("task", {
      name: "Task model",
      params: { enabled: true },
    });

    const invalidRole = await app.inject({ method: "GET", url: "/models/not-a-role/config" });
    expect(invalidRole.statusCode).toBe(400);
    await app.close();
  });

  it("passes an optional validated role to parameter template lookup", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/models/param-templates?type=rerank",
    });
    expect(response.statusCode).toBe(200);
    expect(service.getParamTemplates).toHaveBeenCalledWith("rerank");
    await app.close();
  });
});
