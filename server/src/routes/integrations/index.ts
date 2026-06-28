import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "@/db/auth.db.js";
import {
  integrationCapabilitiesRepository,
  integrationInstancesRepository,
} from "@/db/repositories/index.js";
import { deletedResponseSchema, errorEnvelope, idParamsSchema, successEnvelope } from "@/routes/schema-helpers.js";
import {
  INTEGRATION_PROVIDER_LABELS,
  INTEGRATION_PROVIDER_VALUES,
  type IntegrationProviderValue,
} from "@/integrations/core/providers.js";
import {
  getSmartRobotStatusByCapability,
  startWecomSmartRobotByCapability,
  stopWecomSmartRobotByCapability,
} from "@/integrations/wecom/smart-robot.js";
import { success } from "@/utils/index.js";
import { badRequest, notFound, routeHandler } from "@/utils/route-errors.js";

const capabilitySchema = {
  type: "object",
  required: [
    "id",
    "instanceId",
    "provider",
    "type",
    "name",
    "enabled",
    "knowledgeBaseId",
    "config",
    "runtime",
    "isDefault",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string" },
    instanceId: { type: "string" },
    provider: { type: "string", enum: INTEGRATION_PROVIDER_VALUES },
    type: { type: "string" },
    name: { type: "string" },
    enabled: { type: "boolean" },
    knowledgeBaseId: { type: ["string", "null"] },
    config: { type: "object", additionalProperties: true },
    runtime: { type: "object", additionalProperties: true },
    isDefault: { type: "boolean" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
} as const;

const instanceSchema = {
  type: "object",
  required: [
    "id",
    "provider",
    "name",
    "externalTenantId",
    "config",
    "enabled",
    "isDefault",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string" },
    provider: { type: "string", enum: INTEGRATION_PROVIDER_VALUES },
    name: { type: "string" },
    externalTenantId: { type: ["string", "null"] },
    config: { type: "object", additionalProperties: true },
    enabled: { type: "boolean" },
    isDefault: { type: "boolean" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
    capabilities: {
      type: "array",
      items: capabilitySchema,
    },
  },
} as const;

const parseProvider = (
  value: string | undefined,
): IntegrationProviderValue | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (
    !INTEGRATION_PROVIDER_VALUES.includes(
      normalized as IntegrationProviderValue,
    )
  ) {
    throw badRequest(`Unsupported integration provider: ${value}`);
  }

  return normalized as IntegrationProviderValue;
};

const integrationsRoute: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get(
    "/integrations/providers",
    {
      schema: {
        tags: ["Tools"],
        summary: "List supported integration providers",
        security: [{ bearerAuth: [] }],
        response: {
          200: successEnvelope({
            type: "object",
            required: ["providers"],
            properties: {
              providers: {
                type: "array",
                items: {
                  type: "object",
                  required: ["code", "label", "enabled", "implemented"],
                  properties: {
                    code: {
                      type: "string",
                      enum: INTEGRATION_PROVIDER_VALUES,
                    },
                    label: { type: "string" },
                    enabled: { type: "boolean" },
                    implemented: { type: "boolean" },
                  },
                },
              },
            },
          }),
          401: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to list integration providers", async () =>
      success({
        providers: INTEGRATION_PROVIDER_VALUES.map((code) => ({
          code,
          label: INTEGRATION_PROVIDER_LABELS[code],
          enabled: code === "wecom",
          implemented: code === "wecom",
        })),
      }),
    ),
  );

  app.get<{
    Querystring: {
      provider?: string;
      includeCapabilities?: string;
    };
  }>(
    "/integrations/instances",
    {
      schema: {
        tags: ["Tools"],
        summary: "List integration instances",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            provider: {
              type: "string",
              enum: INTEGRATION_PROVIDER_VALUES,
            },
            includeCapabilities: { type: "string", enum: ["true", "false"] },
          },
        },
        response: {
          200: successEnvelope({
            type: "object",
            required: ["instances"],
            properties: {
              instances: {
                type: "array",
                items: instanceSchema,
              },
            },
          }),
          401: errorEnvelope,
          400: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to list integration instances", async (request) => {
      const provider = parseProvider(request.query.provider);
      const includeCapabilities = request.query.includeCapabilities === "true";
      const instances = integrationInstancesRepository.list(provider).map(
        (instance) => ({
          ...instance,
          capabilities: includeCapabilities
            ? integrationCapabilitiesRepository.listByInstance(instance.id)
            : [],
        }),
      );

      return success({ instances });
    }),
  );

  app.get<{
    Querystring: {
      provider?: string;
      instanceId?: string;
    };
  }>(
    "/integrations/capabilities",
    {
      schema: {
        tags: ["Tools"],
        summary: "List integration capabilities",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            provider: {
              type: "string",
              enum: INTEGRATION_PROVIDER_VALUES,
            },
            instanceId: { type: "string" },
          },
        },
        response: {
          200: successEnvelope({
            type: "object",
            required: ["capabilities"],
            properties: {
              capabilities: {
                type: "array",
                items: capabilitySchema,
              },
            },
          }),
          401: errorEnvelope,
          400: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to list integration capabilities", async (request) => {
      const provider = parseProvider(request.query.provider);
      const instanceId = request.query.instanceId?.trim();

      const instances = instanceId
        ? (() => {
            const instance = integrationInstancesRepository.getById(instanceId);
            if (!instance) {
              throw badRequest(`Integration instance not found: ${instanceId}`);
            }
            return [instance];
          })()
        : integrationInstancesRepository.list(provider);

      const capabilities = instances.flatMap((instance) =>
        integrationCapabilitiesRepository.listByInstance(instance.id),
      );

      return success({
        capabilities: provider
          ? capabilities.filter((capability) => capability.provider === provider)
          : capabilities,
      });
    }),
  );

  app.post<{
    Body: {
      provider: string;
      name?: string;
      externalTenantId?: string | null;
      config?: Record<string, unknown>;
      enabled?: boolean;
      isDefault?: boolean;
    };
  }>(
    "/integrations/instances",
    {
      schema: {
        tags: ["Tools"],
        summary: "Create integration instance",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          additionalProperties: false,
          required: ["provider"],
          properties: {
            provider: { type: "string", enum: INTEGRATION_PROVIDER_VALUES },
            name: { type: "string" },
            externalTenantId: { type: ["string", "null"] },
            config: { type: "object", additionalProperties: true },
            enabled: { type: "boolean" },
            isDefault: { type: "boolean" },
          },
        },
        response: {
          200: successEnvelope({
            type: "object",
            required: ["instance"],
            properties: {
              instance: instanceSchema,
            },
          }),
          400: errorEnvelope,
          401: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to create integration instance", async (request) => {
      const provider = parseProvider(request.body.provider);
      if (!provider) {
        throw badRequest("provider is required");
      }

      const instance = integrationInstancesRepository.create({
        provider,
        name: request.body.name ?? "",
        externalTenantId:
          typeof request.body.externalTenantId === "string"
            ? request.body.externalTenantId
            : request.body.externalTenantId === null
              ? null
              : undefined,
        config: request.body.config ?? {},
        enabled: request.body.enabled,
        isDefault: request.body.isDefault,
      });

      return success({ instance });
    }),
  );

  app.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      externalTenantId?: string | null;
      config?: Record<string, unknown>;
      enabled?: boolean;
      isDefault?: boolean;
    };
  }>(
    "/integrations/instances/:id",
    {
      schema: {
        tags: ["Tools"],
        summary: "Update integration instance",
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            externalTenantId: { type: ["string", "null"] },
            config: { type: "object", additionalProperties: true },
            enabled: { type: "boolean" },
            isDefault: { type: "boolean" },
          },
        },
        response: {
          200: successEnvelope({
            type: "object",
            required: ["instance"],
            properties: {
              instance: instanceSchema,
            },
          }),
          400: errorEnvelope,
          401: errorEnvelope,
          404: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to update integration instance", async (request) => {
      const instance = integrationInstancesRepository.update(request.params.id, {
        name: request.body.name,
        externalTenantId:
          typeof request.body.externalTenantId === "string"
            ? request.body.externalTenantId
            : request.body.externalTenantId === null
              ? null
              : undefined,
        config: request.body.config,
        enabled: request.body.enabled,
        isDefault: request.body.isDefault,
      });

      if (!instance) {
        throw notFound(`Integration instance not found: ${request.params.id}`);
      }

      return success({ instance });
    }),
  );

  app.post<{
    Body: {
      instanceId: string;
      provider: string;
      type: string;
      name?: string;
      enabled?: boolean;
      knowledgeBaseId?: string | null;
      config?: Record<string, unknown>;
      runtime?: Record<string, unknown>;
      isDefault?: boolean;
    };
  }>(
    "/integrations/capabilities",
    {
      schema: {
        tags: ["Tools"],
        summary: "Create integration capability",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          additionalProperties: false,
          required: ["instanceId", "provider", "type"],
          properties: {
            instanceId: { type: "string" },
            provider: { type: "string", enum: INTEGRATION_PROVIDER_VALUES },
            type: { type: "string" },
            name: { type: "string" },
            enabled: { type: "boolean" },
            knowledgeBaseId: { type: ["string", "null"] },
            config: { type: "object", additionalProperties: true },
            runtime: { type: "object", additionalProperties: true },
            isDefault: { type: "boolean" },
          },
        },
        response: {
          200: successEnvelope({
            type: "object",
            required: ["capability"],
            properties: {
              capability: capabilitySchema,
            },
          }),
          400: errorEnvelope,
          401: errorEnvelope,
          404: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to create integration capability", async (request) => {
      const provider = parseProvider(request.body.provider);
      if (!provider) {
        throw badRequest("provider is required");
      }

      const instance = integrationInstancesRepository.getById(
        request.body.instanceId,
      );
      if (!instance) {
        throw notFound(
          `Integration instance not found: ${request.body.instanceId}`,
        );
      }
      if (instance.provider !== provider) {
        throw badRequest("instance provider and capability provider must match");
      }

      const capability = integrationCapabilitiesRepository.create({
        instanceId: request.body.instanceId,
        provider,
        type: request.body.type as never,
        name: request.body.name ?? "",
        enabled: request.body.enabled,
        knowledgeBaseId:
          typeof request.body.knowledgeBaseId === "string"
            ? request.body.knowledgeBaseId
            : request.body.knowledgeBaseId === null
              ? null
              : undefined,
        config: request.body.config ?? {},
        runtime: request.body.runtime ?? {},
        isDefault: request.body.isDefault,
      });

      return success({ capability });
    }),
  );

  app.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      enabled?: boolean;
      knowledgeBaseId?: string | null;
      config?: Record<string, unknown>;
      runtime?: Record<string, unknown>;
      isDefault?: boolean;
    };
  }>(
    "/integrations/capabilities/:id",
    {
      schema: {
        tags: ["Tools"],
        summary: "Update integration capability",
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            enabled: { type: "boolean" },
            knowledgeBaseId: { type: ["string", "null"] },
            config: { type: "object", additionalProperties: true },
            runtime: { type: "object", additionalProperties: true },
            isDefault: { type: "boolean" },
          },
        },
        response: {
          200: successEnvelope({
            type: "object",
            required: ["capability"],
            properties: {
              capability: capabilitySchema,
            },
          }),
          400: errorEnvelope,
          401: errorEnvelope,
          404: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to update integration capability", async (request) => {
      const capability = integrationCapabilitiesRepository.update(
        request.params.id,
        {
          name: request.body.name,
          enabled: request.body.enabled,
          knowledgeBaseId:
            typeof request.body.knowledgeBaseId === "string"
              ? request.body.knowledgeBaseId
              : request.body.knowledgeBaseId === null
                ? null
                : undefined,
          config: request.body.config,
          runtime: request.body.runtime,
          isDefault: request.body.isDefault,
        },
      );

      if (!capability) {
        throw notFound(
          `Integration capability not found: ${request.params.id}`,
        );
      }

      return success({ capability });
    }),
  );

  app.delete<{
    Params: { id: string };
  }>(
    "/integrations/capabilities/:id",
    {
      schema: {
        tags: ["Tools"],
        summary: "Delete integration capability",
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        response: {
          200: successEnvelope(deletedResponseSchema),
          401: errorEnvelope,
          404: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to delete integration capability", async (request) => {
      const deleted = integrationCapabilitiesRepository.delete(request.params.id);
      if (!deleted) {
        throw notFound(
          `Integration capability not found: ${request.params.id}`,
        );
      }

      return success({ deleted: true });
    }),
  );

  app.get<{
    Params: { id: string };
  }>(
    "/integrations/capabilities/:id/status",
    {
      schema: {
        tags: ["Tools"],
        summary: "Get integration capability runtime status",
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        response: {
          200: successEnvelope({
            type: "object",
            required: [
              "enabled",
              "status",
              "botId",
              "hasSecret",
              "lastError",
              "lastConnectedAt",
            ],
            properties: {
              enabled: { type: "boolean" },
              status: { type: "string" },
              botId: { type: "string" },
              hasSecret: { type: "boolean" },
              lastError: { type: ["string", "null"] },
              lastConnectedAt: { type: ["string", "null"] },
            },
          }),
          401: errorEnvelope,
          404: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to get integration capability status", async (request) => {
      const status = getSmartRobotStatusByCapability(request.params.id);
      if (!status) {
        throw notFound(`Integration capability not found: ${request.params.id}`);
      }

      return success(status);
    }),
  );

  app.post<{
    Params: { id: string };
  }>(
    "/integrations/capabilities/:id/start",
    {
      schema: {
        tags: ["Tools"],
        summary: "Start integration capability runtime",
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        response: {
          200: successEnvelope({
            type: "object",
            required: [
              "enabled",
              "status",
              "botId",
              "hasSecret",
              "lastError",
              "lastConnectedAt",
            ],
            properties: {
              enabled: { type: "boolean" },
              status: { type: "string" },
              botId: { type: "string" },
              hasSecret: { type: "boolean" },
              lastError: { type: ["string", "null"] },
              lastConnectedAt: { type: ["string", "null"] },
            },
          }),
          401: errorEnvelope,
          404: errorEnvelope,
          400: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to start integration capability runtime", async (request) => {
      const status = await startWecomSmartRobotByCapability(request.params.id);
      return success(status);
    }),
  );

  app.post<{
    Params: { id: string };
  }>(
    "/integrations/capabilities/:id/stop",
    {
      schema: {
        tags: ["Tools"],
        summary: "Stop integration capability runtime",
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        response: {
          200: successEnvelope({
            type: "object",
            required: [
              "enabled",
              "status",
              "botId",
              "hasSecret",
              "lastError",
              "lastConnectedAt",
            ],
            properties: {
              enabled: { type: "boolean" },
              status: { type: "string" },
              botId: { type: "string" },
              hasSecret: { type: "boolean" },
              lastError: { type: ["string", "null"] },
              lastConnectedAt: { type: ["string", "null"] },
            },
          }),
          401: errorEnvelope,
          404: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to stop integration capability runtime", async (request) => {
      const status = stopWecomSmartRobotByCapability(request.params.id);
      return success(status);
    }),
  );
};

export default integrationsRoute;
