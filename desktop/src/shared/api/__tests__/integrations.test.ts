import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/request", () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));

import { get, post, put, patch, del } from "@/shared/lib/request";
import {
  getIntegrationProviders,
  getIntegrationInstances,
  getIntegrationCapabilities,
  getIntegrationMicroApps,
  updateIntegrationMicroApp,
  getIntegrationCapabilityMicroAppBinding,
  updateIntegrationCapabilityMicroAppBinding,
  createIntegrationInstance,
  updateIntegrationInstance,
  createIntegrationCapability,
  updateIntegrationCapability,
  deleteIntegrationCapability,
  getIntegrationCapabilityStatus,
  startIntegrationCapability,
  stopIntegrationCapability,
  getWecomIntegrationStatus,
  sendWecomRobotTestMessage,
  sendWecomRobotCapabilityTestMessage,
  type IntegrationProviderSummary,
  type IntegrationInstanceRecord,
  type IntegrationCapabilityRecord,
  type MicroAppRecord,
  type IntegrationCapabilityStatus,
} from "../integrations";

const sampleProvider: IntegrationProviderSummary = {
  code: "wecom",
  label: "企业微信",
  enabled: true,
  implemented: true,
};

const sampleInstance: IntegrationInstanceRecord = {
  id: "inst-1",
  provider: "wecom",
  name: "企微实例",
  externalTenantId: "tenant-1",
  config: {},
  enabled: true,
  isDefault: true,
  createdAt: "2026-07-06T00:00:00.000Z",
  updatedAt: "2026-07-06T00:00:00.000Z",
};

const sampleCapability: IntegrationCapabilityRecord = {
  id: "cap-1",
  instanceId: "inst-1",
  provider: "wecom",
  type: "smart_robot",
  name: "智能机器人",
  enabled: true,
  knowledgeBaseId: "kb-1",
  config: {},
  runtime: {},
  isDefault: true,
  createdAt: "2026-07-06T00:00:00.000Z",
  updatedAt: "2026-07-06T00:00:00.000Z",
};

const sampleMicroApp: MicroAppRecord = {
  id: "app-1",
  type: "knowledge_query",
  name: "知识查询",
  description: "desc",
  supportedAccessPoints: ["wecom"],
  bindingSchema: { fields: [] },
  runtimeKey: "knowledge_query",
  enabled: true,
  createdAt: "2026-07-06T00:00:00.000Z",
  updatedAt: "2026-07-06T00:00:00.000Z",
};

const sampleCapabilityStatus: IntegrationCapabilityStatus = {
  enabled: true,
  status: "connected",
  botId: "bot-1",
  hasSecret: true,
  lastError: null,
  lastConnectedAt: "2026-07-06T00:00:00.000Z",
};

describe("integrations api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getIntegrationProviders 获取提供商列表", async () => {
    vi.mocked(get).mockResolvedValueOnce({ providers: [sampleProvider] });

    const result = await getIntegrationProviders();

    expect(get).toHaveBeenCalledWith("/integrations/providers");
    expect(result.providers).toEqual([sampleProvider]);
  });

  it("getIntegrationInstances 支持 provider 与 capabilities 过滤", async () => {
    vi.mocked(get).mockResolvedValueOnce({ instances: [sampleInstance] });

    const result = await getIntegrationInstances({
      provider: "wecom",
      includeCapabilities: true,
    });

    expect(get).toHaveBeenCalledWith(
      "/integrations/instances?provider=wecom&includeCapabilities=true",
    );
    expect(result.instances).toEqual([sampleInstance]);
  });

  it("getIntegrationCapabilities 支持 provider 与 instanceId 过滤", async () => {
    vi.mocked(get).mockResolvedValueOnce({ capabilities: [sampleCapability] });

    const result = await getIntegrationCapabilities({
      provider: "wecom",
      instanceId: "inst-1",
    });

    expect(get).toHaveBeenCalledWith(
      "/integrations/capabilities?provider=wecom&instanceId=inst-1",
    );
    expect(result.capabilities).toEqual([sampleCapability]);
  });

  it("getIntegrationMicroApps 支持 type 过滤", async () => {
    vi.mocked(get).mockResolvedValueOnce({ microApps: [sampleMicroApp] });

    const result = await getIntegrationMicroApps({ type: "knowledge_query" });

    expect(get).toHaveBeenCalledWith("/integrations/micro-apps?type=knowledge_query");
    expect(result.microApps).toEqual([sampleMicroApp]);
  });

  it("updateIntegrationMicroApp 更新微应用", async () => {
    vi.mocked(patch).mockResolvedValueOnce({ microApp: sampleMicroApp });

    const result = await updateIntegrationMicroApp("app-1", { name: "New" });

    expect(patch).toHaveBeenCalledWith("/integrations/micro-apps/app-1", {
      name: "New",
    });
    expect(result.microApp).toBe(sampleMicroApp);
  });

  it("getIntegrationCapabilityMicroAppBinding 获取能力微应用绑定", async () => {
    vi.mocked(get).mockResolvedValueOnce({ binding: null, microApp: null });

    const result = await getIntegrationCapabilityMicroAppBinding("cap-1");

    expect(get).toHaveBeenCalledWith(
      "/integrations/capabilities/cap-1/micro-app-binding",
    );
    expect(result.binding).toBeNull();
  });

  it("updateIntegrationCapabilityMicroAppBinding 更新绑定", async () => {
    vi.mocked(put).mockResolvedValueOnce({ binding: null, microApp: null });

    const result = await updateIntegrationCapabilityMicroAppBinding("cap-1", {
      microAppId: "app-1",
      enabled: true,
    });

    expect(put).toHaveBeenCalledWith(
      "/integrations/capabilities/cap-1/micro-app-binding",
      { microAppId: "app-1", enabled: true },
    );
    expect(result.binding).toBeNull();
  });

  it("createIntegrationInstance 创建实例", async () => {
    vi.mocked(post).mockResolvedValueOnce({ instance: sampleInstance });

    const payload = { provider: "wecom" as const, name: "New" };
    const result = await createIntegrationInstance(payload);

    expect(post).toHaveBeenCalledWith("/integrations/instances", payload);
    expect(result.instance).toBe(sampleInstance);
  });

  it("updateIntegrationInstance 更新实例", async () => {
    vi.mocked(patch).mockResolvedValueOnce({ instance: sampleInstance });

    const result = await updateIntegrationInstance("inst-1", { name: "Updated" });

    expect(patch).toHaveBeenCalledWith("/integrations/instances/inst-1", {
      name: "Updated",
    });
    expect(result.instance).toBe(sampleInstance);
  });

  it("createIntegrationCapability 创建能力", async () => {
    vi.mocked(post).mockResolvedValueOnce({ capability: sampleCapability });

    const payload = {
      instanceId: "inst-1",
      provider: "wecom" as const,
      type: "smart_robot",
      name: "机器人",
    };
    const result = await createIntegrationCapability(payload);

    expect(post).toHaveBeenCalledWith("/integrations/capabilities", payload);
    expect(result.capability).toBe(sampleCapability);
  });

  it("updateIntegrationCapability 更新能力", async () => {
    vi.mocked(patch).mockResolvedValueOnce({ capability: sampleCapability });

    const result = await updateIntegrationCapability("cap-1", { name: "Updated" });

    expect(patch).toHaveBeenCalledWith("/integrations/capabilities/cap-1", {
      name: "Updated",
    });
    expect(result.capability).toBe(sampleCapability);
  });

  it("deleteIntegrationCapability 删除能力", async () => {
    vi.mocked(del).mockResolvedValueOnce({ deleted: true });

    const result = await deleteIntegrationCapability("cap-1");

    expect(del).toHaveBeenCalledWith("/integrations/capabilities/cap-1");
    expect(result).toEqual({ deleted: true });
  });

  it("getIntegrationCapabilityStatus 获取能力状态", async () => {
    vi.mocked(get).mockResolvedValueOnce(sampleCapabilityStatus);

    const result = await getIntegrationCapabilityStatus("cap-1");

    expect(get).toHaveBeenCalledWith("/integrations/capabilities/cap-1/status");
    expect(result).toBe(sampleCapabilityStatus);
  });

  it("startIntegrationCapability 启动能力", async () => {
    vi.mocked(post).mockResolvedValueOnce(sampleCapabilityStatus);

    const result = await startIntegrationCapability("cap-1");

    expect(post).toHaveBeenCalledWith("/integrations/capabilities/cap-1/start");
    expect(result).toBe(sampleCapabilityStatus);
  });

  it("stopIntegrationCapability 停止能力", async () => {
    vi.mocked(post).mockResolvedValueOnce(sampleCapabilityStatus);

    const result = await stopIntegrationCapability("cap-1");

    expect(post).toHaveBeenCalledWith("/integrations/capabilities/cap-1/stop");
    expect(result).toBe(sampleCapabilityStatus);
  });

  it("getWecomIntegrationStatus 获取企微集成状态", async () => {
    vi.mocked(get).mockResolvedValueOnce({
      config: {
        corpId: "corp-1",
        agentId: "agent-1",
        hasAppSecret: true,
        hasContactsSecret: true,
        hasRobotWebhook: true,
        hasSmartRobot: true,
      },
      smartRobotKnowledgeBaseId: "kb-1",
      smartRobot: sampleCapabilityStatus,
      binding: { bound: true },
    });

    const result = await getWecomIntegrationStatus();

    expect(get).toHaveBeenCalledWith("/integrations/wecom/status");
    expect(result.binding.bound).toBe(true);
  });

  it("sendWecomRobotTestMessage 发送测试消息", async () => {
    vi.mocked(post).mockResolvedValueOnce({
      success: true,
      target: "webhook",
      summary: "ok",
    });

    const result = await sendWecomRobotTestMessage({ content: "hi" });

    expect(post).toHaveBeenCalledWith(
      "/integrations/wecom/test/send-message",
      { content: "hi" },
    );
    expect(result.success).toBe(true);
  });

  it("sendWecomRobotCapabilityTestMessage 向指定能力发送测试消息", async () => {
    vi.mocked(post).mockResolvedValueOnce({
      success: true,
      target: "capability",
      summary: "ok",
    });

    const result = await sendWecomRobotCapabilityTestMessage("cap-1", {
      content: "hi",
    });

    expect(post).toHaveBeenCalledWith(
      "/integrations/wecom/capabilities/cap-1/test/send-message",
      { content: "hi" },
    );
    expect(result.success).toBe(true);
  });
});
