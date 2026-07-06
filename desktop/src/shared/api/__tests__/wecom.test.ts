import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/request", () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

import { get, post, put, del } from "@/shared/lib/request";
import {
  getWecomIntegrationStatus,
  getWecomBindingMe,
  bindWecomUserManually,
  startWecomOAuthBinding,
  pollWecomOAuthBinding,
  unbindWecomUser,
  getWecomConfig,
  updateWecomConfig,
  sendWecomRobotTestMessage,
  getWecomSmartRobotStatus,
  startWecomSmartRobot,
  stopWecomSmartRobot,
  type WecomIntegrationStatus,
  type WecomOAuthStartResponse,
  type WecomOAuthPollResponse,
} from "../wecom";

const sampleStatus: WecomIntegrationStatus = {
  config: {
    corpId: "corp-1",
    agentId: "agent-1",
    hasAppSecret: true,
    hasContactsSecret: true,
    hasRobotWebhook: true,
    hasSmartRobot: true,
  },
  smartRobotKnowledgeBaseId: "kb-1",
  smartRobot: {
    enabled: true,
    status: "connected",
    botId: "bot-1",
    hasSecret: true,
    lastError: null,
    lastConnectedAt: "2026-07-06T00:00:00.000Z",
  },
  binding: {
    bound: true,
    externalUserId: "user-1",
    externalUnionId: "union-1",
    bindSource: "manual",
  },
};

const sampleOAuthStart: WecomOAuthStartResponse = {
  authorizeUrl: "https://open.weixin.qq.com/connect/oauth2/authorize",
  ticket: "ticket-1",
};

const sampleOAuthPoll: WecomOAuthPollResponse = {
  status: "ready",
  ticket: "ticket-1",
  userid: "user-1",
  externalUnionId: "union-1",
  bindSource: "oauth",
};

const sampleConfig = {
  corpId: "corp-1",
  agentId: "agent-1",
  appSecret: "secret-1",
  contactsSecret: "secret-2",
  robotWebhookUrl: "https://example.com/webhook",
  robotWebhookSecret: "wh-secret",
  smartRobotBotId: "bot-1",
  smartRobotSecret: "sr-secret",
  smartRobotKnowledgeBaseId: "kb-1",
  smartRobotReplyMode: "stream" as const,
};

describe("wecom api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getWecomIntegrationStatus 获取集成状态", async () => {
    vi.mocked(get).mockResolvedValueOnce(sampleStatus);

    const result = await getWecomIntegrationStatus();

    expect(get).toHaveBeenCalledWith("/integrations/wecom/status");
    expect(result).toBe(sampleStatus);
  });

  it("getWecomBindingMe 获取当前绑定", async () => {
    vi.mocked(get).mockResolvedValueOnce(sampleStatus.binding);

    const result = await getWecomBindingMe();

    expect(get).toHaveBeenCalledWith("/integrations/wecom/bind/me");
    expect(result).toBe(sampleStatus.binding);
  });

  it("bindWecomUserManually 手动绑定用户", async () => {
    vi.mocked(post).mockResolvedValueOnce(sampleStatus.binding);

    const input = { externalUserId: "user-1", bindSource: "manual" as const };
    const result = await bindWecomUserManually(input);

    expect(post).toHaveBeenCalledWith("/integrations/wecom/bind/manual", input);
    expect(result).toBe(sampleStatus.binding);
  });

  it("startWecomOAuthBinding 启动 OAuth 绑定", async () => {
    vi.mocked(post).mockResolvedValueOnce(sampleOAuthStart);

    const result = await startWecomOAuthBinding();

    expect(post).toHaveBeenCalledWith("/integrations/wecom/bind/oauth/start");
    expect(result).toBe(sampleOAuthStart);
  });

  it("pollWecomOAuthBinding 轮询 OAuth 状态", async () => {
    vi.mocked(post).mockResolvedValueOnce(sampleOAuthPoll);

    const result = await pollWecomOAuthBinding("ticket-1");

    expect(post).toHaveBeenCalledWith(
      "/integrations/wecom/bind/oauth/poll",
      { ticket: "ticket-1" },
    );
    expect(result).toBe(sampleOAuthPoll);
  });

  it("unbindWecomUser 解绑当前用户", async () => {
    vi.mocked(del).mockResolvedValueOnce({ deleted: true });

    const result = await unbindWecomUser();

    expect(del).toHaveBeenCalledWith("/integrations/wecom/bind/me");
    expect(result).toEqual({ deleted: true });
  });

  it("getWecomConfig 获取配置", async () => {
    vi.mocked(get).mockResolvedValueOnce(sampleConfig);

    const result = await getWecomConfig();

    expect(get).toHaveBeenCalledWith("/mcp/wecom/config");
    expect(result).toBe(sampleConfig);
  });

  it("updateWecomConfig 更新配置", async () => {
    vi.mocked(put).mockResolvedValueOnce(sampleConfig);

    const input = { corpId: "corp-2" };
    const result = await updateWecomConfig(input);

    expect(put).toHaveBeenCalledWith("/mcp/wecom/config", input);
    expect(result).toBe(sampleConfig);
  });

  it("sendWecomRobotTestMessage 发送测试消息", async () => {
    vi.mocked(post).mockResolvedValueOnce({
      success: true,
      target: "webhook",
      summary: "ok",
    });

    const input = { content: "hello" };
    const result = await sendWecomRobotTestMessage(input);

    expect(post).toHaveBeenCalledWith("/integrations/wecom/test/send-message", input);
    expect(result).toEqual({ success: true, target: "webhook", summary: "ok" });
  });

  it("getWecomSmartRobotStatus 获取智能机器人状态", async () => {
    vi.mocked(get).mockResolvedValueOnce(sampleStatus.smartRobot);

    const result = await getWecomSmartRobotStatus();

    expect(get).toHaveBeenCalledWith("/integrations/wecom/smart-robot/status");
    expect(result).toBe(sampleStatus.smartRobot);
  });

  it("startWecomSmartRobot 启动智能机器人", async () => {
    vi.mocked(post).mockResolvedValueOnce(sampleStatus.smartRobot);

    const result = await startWecomSmartRobot();

    expect(post).toHaveBeenCalledWith("/integrations/wecom/smart-robot/start");
    expect(result).toBe(sampleStatus.smartRobot);
  });

  it("stopWecomSmartRobot 停止智能机器人", async () => {
    vi.mocked(post).mockResolvedValueOnce(sampleStatus.smartRobot);

    const result = await stopWecomSmartRobot();

    expect(post).toHaveBeenCalledWith("/integrations/wecom/smart-robot/stop");
    expect(result).toBe(sampleStatus.smartRobot);
  });
});
