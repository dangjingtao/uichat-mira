import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import wecomRoute from "./wecom.js";
import { sendRouteError } from "@/utils/route-errors.js";
import { getLoggerConfig } from "@/logger";
import { integrationCapabilitiesRepository } from "@/db/repositories/integration-capabilities.repository.js";
import { integrationInstancesRepository } from "@/db/repositories/integration-instances.repository.js";
import { wecomSettingsRepository } from "@/db/repositories/wecom-settings.repository.js";
import { wecomIdentityBindingsRepository } from "@/db/repositories/wecom-identity-bindings.repository.js";
import { getSqlite, resetDatabaseClients } from "@/db/index.js";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";

const getWecomUserByUserIdMock = vi.hoisted(() => vi.fn());
const startWecomOAuthRelayMock = vi.hoisted(() => vi.fn());
const pollWecomOAuthRelayMock = vi.hoisted(() => vi.fn());
const requireAuthMock = vi.hoisted(() => vi.fn(async (request: { authUser?: unknown }) => {
  request.authUser = {
    id: 1,
    username: "Tomz",
    role: "admin",
  };
}));

vi.mock("@/integrations/wecom/client.js", () => ({
  getWecomUserByUserId: getWecomUserByUserIdMock,
}));

vi.mock("@/integrations/wecom/bind-relay.js", () => ({
  startWecomOAuthRelay: startWecomOAuthRelayMock,
  pollWecomOAuthRelay: pollWecomOAuthRelayMock,
}));

vi.mock("@/db/auth.db.js", () => ({
  requireAuth: requireAuthMock,
}));

describe("wecom route", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `file:${createTimestampedTestArtifactPath("db", "tmp-wecom-route", ".sqlite")}`;
    resetDatabaseClients();
    const sqlite = getSqlite();
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    sqlite.exec(`
      INSERT OR IGNORE INTO users (id, username, password_hash, role, is_active)
      VALUES (1, 'Tomz', 'hash', 'admin', 1)
    `);
    wecomSettingsRepository.initialize();
    integrationInstancesRepository.initialize();
    integrationCapabilitiesRepository.initialize();
    wecomIdentityBindingsRepository.initialize();
    getWecomUserByUserIdMock.mockReset();
    startWecomOAuthRelayMock.mockReset();
    pollWecomOAuthRelayMock.mockReset();
    requireAuthMock.mockClear();
  });

  afterEach(() => {
    resetDatabaseClients();
    delete process.env.DATABASE_URL;
  });

  it("starts oauth relay, binds manually, and reports status", async () => {
    getWecomUserByUserIdMock.mockResolvedValue({
      userid: "tomz",
      name: "Tomz",
      department: [1],
    });
    startWecomOAuthRelayMock.mockResolvedValue({
      success: true,
      authorizeUrl: "https://xxxx.tomz.io/wecom/start?ticket=abc",
      ticket: "abc",
    });
    pollWecomOAuthRelayMock.mockResolvedValue({
      success: true,
      status: "ready",
      ticket: "abc",
      userid: "tomz",
      bindSource: "oauth",
    });

    const app = Fastify({
      logger: getLoggerConfig(),
      serializerOpts: { encoding: "utf8" },
    });
    app.setErrorHandler(sendRouteError);
    await app.register(wecomRoute);

    const startResponse = await app.inject({
      method: "POST",
      url: "/integrations/wecom/bind/oauth/start",
    });
    expect(startResponse.statusCode).toBe(200);
    expect((startResponse.json() as { data: { ticket: string } }).data.ticket).toBe("abc");

    const pollResponse = await app.inject({
      method: "POST",
      url: "/integrations/wecom/bind/oauth/poll",
      payload: {
        ticket: "abc",
      },
    });
    expect(pollResponse.statusCode).toBe(200);
    expect((pollResponse.json() as { data: { userid: string; bindSource: string } }).data)
      .toMatchObject({
        userid: "tomz",
        bindSource: "oauth",
      });

    const statusResponse = await app.inject({
      method: "GET",
      url: "/integrations/wecom/status",
    });
    expect(statusResponse.statusCode).toBe(200);
    expect((statusResponse.json() as { data: { binding: { bound: boolean } } }).data.binding.bound)
      .toBe(true);

    await app.close();
  });

  it("reads WeCom status from integration instance and capability config", async () => {
    const instance = integrationInstancesRepository.getDefault("wecom");
    expect(instance).toBeTruthy();

    integrationInstancesRepository.update(instance!.id, {
      config: {
        corpId: "ww-status",
        agentId: "1000002",
        appSecret: "app-secret-2",
        contactsSecret: "contacts-secret-2",
      },
    });

    const capabilities = integrationCapabilitiesRepository.listByInstance(
      instance!.id,
    );
    const webhookCapability = capabilities.find(
      (item) => item.type === "wecom.webhook_robot",
    );
    const smartRobotCapability = capabilities.find(
      (item) => item.type === "wecom.smart_robot",
    );

    if (webhookCapability) {
      integrationCapabilitiesRepository.update(webhookCapability.id, {
        config: {
          webhookUrl:
            "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=status-key",
          webhookSecret: "status-secret",
        },
      });
    } else {
      integrationCapabilitiesRepository.create({
        instanceId: instance!.id,
        provider: "wecom",
        type: "wecom.webhook_robot",
        name: "Status Webhook Robot",
        enabled: true,
        isDefault: true,
        config: {
          webhookUrl:
            "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=status-key",
          webhookSecret: "status-secret",
        },
      });
    }

    if (smartRobotCapability) {
      integrationCapabilitiesRepository.update(smartRobotCapability.id, {
        knowledgeBaseId: "default",
        config: {
          botId: "bot-status",
          secret: "bot-status-secret",
          replyMode: "send",
        },
      });
    } else {
      integrationCapabilitiesRepository.create({
        instanceId: instance!.id,
        provider: "wecom",
        type: "wecom.smart_robot",
        name: "Status Smart Robot",
        enabled: true,
        knowledgeBaseId: "default",
        config: {
          botId: "bot-status",
          secret: "bot-status-secret",
          replyMode: "send",
        },
      });
    }

    const app = Fastify({
      logger: getLoggerConfig(),
      serializerOpts: { encoding: "utf8" },
    });
    app.setErrorHandler(sendRouteError);
    await app.register(wecomRoute);

    const statusResponse = await app.inject({
      method: "GET",
      url: "/integrations/wecom/status",
    });
    expect(statusResponse.statusCode).toBe(200);
    expect(
      (statusResponse.json() as {
        data: {
          config: {
            corpId: string;
            agentId: string;
            hasAppSecret: boolean;
            hasContactsSecret: boolean;
            hasRobotWebhook: boolean;
            hasSmartRobot: boolean;
          };
          smartRobot: {
            botId: string;
            hasSecret: boolean;
          };
        };
      }).data,
    ).toMatchObject({
      config: {
        corpId: "ww-status",
        agentId: "1000002",
        hasAppSecret: true,
        hasContactsSecret: true,
        hasRobotWebhook: true,
        hasSmartRobot: true,
      },
      smartRobot: {
        botId: "bot-status",
        hasSecret: true,
      },
    });

    await app.close();
  });
});
