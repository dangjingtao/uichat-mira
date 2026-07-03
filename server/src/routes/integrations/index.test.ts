import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import integrationsRoute from "./index.js";
import { sendRouteError } from "@/utils/route-errors.js";
import { getLoggerConfig } from "@/logger";
import { getSqlite } from "@/db/index.js";
import { integrationCapabilitiesRepository } from "@/db/repositories/integration-capabilities.repository.js";
import { integrationInstancesRepository } from "@/db/repositories/integration-instances.repository.js";
import { wecomSettingsRepository } from "@/db/repositories/wecom-settings.repository.js";

const requireAuthMock = vi.hoisted(() =>
  vi.fn(async (request: { authUser?: unknown }) => {
    request.authUser = {
      id: 1,
      username: "Tomz",
      role: "admin",
    };
  }),
);

vi.mock("@/db/auth.db.js", () => ({
  requireAuth: requireAuthMock,
}));

describe("integrations route", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `file:${process.cwd()}/tmp-integrations-route.sqlite`;
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
    requireAuthMock.mockClear();
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
  });

  it("lists providers, instances, and capabilities", async () => {
    const instance = integrationInstancesRepository.create({
      provider: "wecom",
      name: "Acme WeCom",
      externalTenantId: "ww-acme",
      config: {
        corpId: "ww-acme",
      },
      enabled: true,
      isDefault: false,
    });

    integrationCapabilitiesRepository.create({
      instanceId: instance.id,
      provider: "wecom",
      type: "wecom.smart_robot",
      name: "Acme Smart Robot",
      enabled: true,
      knowledgeBaseId: null,
      config: {
        botId: "bot-1",
        replyMode: "stream",
      },
      runtime: {
        status: "idle",
      },
      isDefault: true,
    });

    const app = Fastify({
      logger: getLoggerConfig(),
      serializerOpts: { encoding: "utf8" },
    });
    app.setErrorHandler(sendRouteError);
    await app.register(integrationsRoute);

    const providersResponse = await app.inject({
      method: "GET",
      url: "/integrations/providers",
    });
    expect(providersResponse.statusCode).toBe(200);
    expect(
      (providersResponse.json() as {
        data: { providers: Array<{ code: string }> };
      }).data.providers.some((provider) => provider.code === "wecom"),
    ).toBe(true);

    const instancesResponse = await app.inject({
      method: "GET",
      url: "/integrations/instances?provider=wecom&includeCapabilities=true",
    });
    expect(instancesResponse.statusCode).toBe(200);
    expect(
      (instancesResponse.json() as {
        data: { instances: Array<{ id: string; capabilities: unknown[] }> };
      }).data.instances.some(
        (currentInstance) =>
          currentInstance.id === instance.id &&
          currentInstance.capabilities.length > 0,
      ),
    ).toBe(true);

    const capabilitiesResponse = await app.inject({
      method: "GET",
      url: `/integrations/capabilities?instanceId=${instance.id}`,
    });
    expect(capabilitiesResponse.statusCode).toBe(200);
    expect(
      (capabilitiesResponse.json() as {
        data: { capabilities: Array<{ instanceId: string; type: string }> };
      }).data.capabilities,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          instanceId: instance.id,
          type: "wecom.smart_robot",
        }),
      ]),
    );

    await app.close();
  });

  it("creates, updates, and deletes integration resources", async () => {
    const app = Fastify({
      logger: getLoggerConfig(),
      serializerOpts: { encoding: "utf8" },
    });
    app.setErrorHandler(sendRouteError);
    await app.register(integrationsRoute);

    const createInstanceResponse = await app.inject({
      method: "POST",
      url: "/integrations/instances",
      payload: {
        provider: "wecom",
        name: "New Tenant",
        externalTenantId: "ww-new",
        config: {
          corpId: "ww-new",
        },
        enabled: true,
      },
    });
    expect(createInstanceResponse.statusCode).toBe(200);
    const createdInstance = (
      createInstanceResponse.json() as {
        data: { instance: { id: string } };
      }
    ).data.instance;

    const updateInstanceResponse = await app.inject({
      method: "PATCH",
      url: `/integrations/instances/${createdInstance.id}`,
      payload: {
        name: "New Tenant Updated",
        isDefault: true,
      },
    });
    expect(updateInstanceResponse.statusCode).toBe(200);
    expect(
      (updateInstanceResponse.json() as {
        data: { instance: { name: string; isDefault: boolean } };
      }).data.instance,
    ).toMatchObject({
      name: "New Tenant Updated",
      isDefault: true,
    });

    const createCapabilityResponse = await app.inject({
      method: "POST",
      url: "/integrations/capabilities",
      payload: {
        instanceId: createdInstance.id,
        provider: "wecom",
        type: "wecom.webhook_robot",
        name: "Notifier",
        config: {
          webhookUrl: "https://example.com/webhook",
        },
      },
    });
    expect(createCapabilityResponse.statusCode).toBe(200);
    const createdCapability = (
      createCapabilityResponse.json() as {
        data: { capability: { id: string } };
      }
    ).data.capability;

    const updateCapabilityResponse = await app.inject({
      method: "PATCH",
      url: `/integrations/capabilities/${createdCapability.id}`,
      payload: {
        name: "Notifier Updated",
        enabled: false,
        runtime: {
          status: "stopped",
        },
      },
    });
    expect(updateCapabilityResponse.statusCode).toBe(200);
    expect(
      (updateCapabilityResponse.json() as {
        data: { capability: { name: string; enabled: boolean } };
      }).data.capability,
    ).toMatchObject({
      name: "Notifier Updated",
      enabled: false,
    });

    const deleteCapabilityResponse = await app.inject({
      method: "DELETE",
      url: `/integrations/capabilities/${createdCapability.id}`,
    });
    expect(deleteCapabilityResponse.statusCode).toBe(200);
    expect(
      (deleteCapabilityResponse.json() as { data: { deleted: boolean } }).data,
    ).toMatchObject({
      deleted: true,
    });

    await app.close();
  });

  it("starts, stops, and reports capability runtime status", async () => {
    const instance = integrationInstancesRepository.create({
      provider: "wecom",
      name: "Runtime Tenant",
      externalTenantId: "ww-runtime",
      config: {
        corpId: "ww-runtime",
      },
      enabled: true,
      isDefault: false,
    });

    const capability = integrationCapabilitiesRepository.create({
      instanceId: instance.id,
      provider: "wecom",
      type: "wecom.smart_robot",
      name: "Runtime Smart Robot",
      enabled: true,
      knowledgeBaseId: "default",
      config: {
        botId: "bot-runtime",
        secret: "bot-runtime-secret",
        replyMode: "send",
      },
      runtime: {},
      isDefault: false,
    });

    const app = Fastify({
      logger: getLoggerConfig(),
      serializerOpts: { encoding: "utf8" },
    });
    app.setErrorHandler(sendRouteError);
    await app.register(integrationsRoute);

    const statusResponse = await app.inject({
      method: "GET",
      url: `/integrations/capabilities/${capability.id}/status`,
    });
    expect(statusResponse.statusCode).toBe(200);
    expect(
      (statusResponse.json() as {
        data: { botId: string; hasSecret: boolean; status: string };
      }).data,
    ).toMatchObject({
      botId: "bot-runtime",
      hasSecret: true,
      status: "idle",
    });

    const stopResponse = await app.inject({
      method: "POST",
      url: `/integrations/capabilities/${capability.id}/stop`,
    });
    expect(stopResponse.statusCode).toBe(200);
    expect(
      (stopResponse.json() as {
        data: { status: string };
      }).data.status,
    ).toBe("stopped");

    await app.close();
  });
});
