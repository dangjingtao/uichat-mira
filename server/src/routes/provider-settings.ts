import { FastifyPluginAsync } from "fastify";
import { providerSettingsService } from "@/services/provider-settings.service.js";
import type { ModelType, ProviderCode } from "@/db/schema.js";
import { ErrorCodes, error, success } from "@/utils/index.js";

const providerCodeSchema = {
  type: "string",
  enum: ["ollama", "lmstudio", "openai", "cloudflare"],
} as const;

const modelTypeSchema = {
  type: "string",
  enum: ["llm", "embedding", "rerank"],
} as const;

const errorEnvelope = {
  type: "object",
  required: ["success", "message", "timestamp"],
  properties: {
    success: { type: "boolean", const: false },
    message: { type: "string" },
    code: { type: "string" },
    errors: {
      type: "array",
      items: {},
    },
    timestamp: { type: "string", format: "date-time" },
  },
} as const;

const successEnvelope = (dataSchema: Record<string, unknown>) => ({
  type: "object",
  required: ["success", "data", "timestamp"],
  properties: {
    success: { type: "boolean", const: true },
    data: dataSchema,
    message: { type: "string" },
    timestamp: { type: "string", format: "date-time" },
  },
});

const providerSummarySchema = {
  type: "object",
  required: [
    "code",
    "displayName",
    "baseUrl",
    "hasApiKey",
    "status",
    "lastError",
    "lastSyncedAt",
    "assignedRoles",
  ],
  properties: {
    code: providerCodeSchema,
    displayName: { type: "string" },
    baseUrl: { type: "string" },
    hasApiKey: { type: "boolean" },
    status: {
      type: "string",
      enum: ["idle", "syncing", "connected", "error"],
    },
    lastError: { anyOf: [{ type: "string" }, { type: "null" }] },
    lastSyncedAt: {
      anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
    },
    assignedRoles: {
      type: "array",
      items: modelTypeSchema,
    },
  },
} as const;

const roleAssignmentSchema = {
  anyOf: [
    {
      type: "object",
      required: ["providerCode", "remoteModelId", "modelName"],
      properties: {
        providerCode: providerCodeSchema,
        remoteModelId: { type: "string" },
        modelName: { type: "string" },
      },
    },
    { type: "null" },
  ],
} as const;

const roleModelConfigSchema = {
  type: "object",
  required: [
    "id",
    "type",
    "name",
    "providerCode",
    "remoteModelId",
    "params",
    "isDefault",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string" },
    type: modelTypeSchema,
    name: { type: "string" },
    providerCode: {
      anyOf: [providerCodeSchema, { type: "null" }],
    },
    remoteModelId: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    params: {
      type: "object",
      additionalProperties: true,
    },
    isDefault: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const;

const providerSettingsRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/providers",
    {
      schema: {
        tags: ["Provider Settings"],
        summary: "List provider summaries",
        description:
          "Return the configured provider platforms with connection status and assigned roles.",
        operationId: "listProviderSummaries",
        response: {
          200: successEnvelope({
            type: "array",
            items: providerSummarySchema,
          }),
          500: errorEnvelope,
        },
      },
    },
    async (request, reply) => {
      try {
        return success(providerSettingsService.getProviderSummaries());
      } catch (err) {
        app.log.error(err);
        return reply
          .code(500)
          .send(error("Failed to get providers", ErrorCodes.INTERNAL_ERROR));
      }
    },
  );

  app.get<{
    Params: { providerCode: ProviderCode };
  }>(
    "/providers/:providerCode",
    {
      schema: {
        tags: ["Provider Settings"],
        summary: "Get provider detail",
        description:
          "Return one provider's saved connection config, synced model list, and role assignments.",
        operationId: "getProviderDetail",
        params: {
          type: "object",
          properties: {
            providerCode: providerCodeSchema,
          },
          required: ["providerCode"],
        },
        response: {
          200: successEnvelope({
            type: "object",
            required: ["provider", "models", "assignments"],
            properties: {
              provider: {
                type: "object",
                required: [
                  "code",
                  "displayName",
                  "baseUrl",
                  "apiKey",
                  "hasApiKey",
                  "status",
                  "lastError",
                  "lastSyncedAt",
                ],
                properties: {
                  code: providerCodeSchema,
                  displayName: { type: "string" },
                  baseUrl: { type: "string" },
                  apiKey: { type: "string" },
                  hasApiKey: { type: "boolean" },
                  status: {
                    type: "string",
                    enum: ["idle", "syncing", "connected", "error"],
                  },
                  lastError: { anyOf: [{ type: "string" }, { type: "null" }] },
                  lastSyncedAt: {
                    anyOf: [
                      { type: "string", format: "date-time" },
                      { type: "null" },
                    ],
                  },
                },
              },
              models: {
                type: "array",
                items: {
                  type: "object",
                  required: ["id", "name"],
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                  },
                },
              },
              assignments: {
                type: "object",
                required: ["llm", "embedding", "rerank"],
                properties: {
                  llm: roleAssignmentSchema,
                  embedding: roleAssignmentSchema,
                  rerank: roleAssignmentSchema,
                },
              },
            },
          }),
          500: errorEnvelope,
        },
      },
    },
    async (request, reply) => {
      try {
        return success(
          providerSettingsService.getProviderDetail(
            request.params.providerCode,
          ),
        );
      } catch (err) {
        app.log.error(err);
        return reply
          .code(500)
          .send(
            error("Failed to get provider detail", ErrorCodes.INTERNAL_ERROR),
          );
      }
    },
  );

  app.put<{
    Params: { providerCode: ProviderCode };
    Body: { baseUrl: string; apiKey: string };
  }>(
    "/providers/:providerCode",
    {
      schema: {
        tags: ["Provider Settings"],
        summary: "Save provider connection config",
        description:
          "Persist base URL and API key for a provider. This does not sync models yet.",
        operationId: "saveProviderConnectionConfig",
        params: {
          type: "object",
          properties: {
            providerCode: providerCodeSchema,
          },
          required: ["providerCode"],
        },
        body: {
          type: "object",
          properties: {
            baseUrl: { type: "string" },
            apiKey: { type: "string" },
          },
          required: ["baseUrl", "apiKey"],
        },
        response: {
          200: successEnvelope({
            type: "object",
            required: [
              "providerCode",
              "displayName",
              "baseUrl",
              "isEnabled",
              "status",
              "createdAt",
              "updatedAt",
            ],
            properties: {
              providerCode: providerCodeSchema,
              displayName: { type: "string" },
              baseUrl: { type: "string" },
              apiKeyEncrypted: {
                anyOf: [{ type: "string" }, { type: "null" }],
              },
              isEnabled: { type: "boolean" },
              status: {
                type: "string",
                enum: ["idle", "syncing", "connected", "error"],
              },
              lastError: { anyOf: [{ type: "string" }, { type: "null" }] },
              lastSyncedAt: {
                anyOf: [
                  { type: "string", format: "date-time" },
                  { type: "null" },
                ],
              },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          }),
          500: errorEnvelope,
        },
      },
    },
    async (request, reply) => {
      try {
        const connection = providerSettingsService.saveProviderConnection(
          request.params.providerCode,
          request.body,
        );
        return success(connection, "Provider config saved");
      } catch (err) {
        app.log.error(err);
        return reply
          .code(500)
          .send(
            error("Failed to save provider config", ErrorCodes.INTERNAL_ERROR),
          );
      }
    },
  );

  app.post<{
    Params: { providerCode: ProviderCode };
  }>(
    "/providers/:providerCode/sync-models",
    {
      schema: {
        tags: ["Provider Settings"],
        summary: "Sync provider models",
        description:
          "Use the backend to fetch models from the provider and refresh the local provider model cache.",
        operationId: "syncProviderModels",
        params: {
          type: "object",
          properties: {
            providerCode: providerCodeSchema,
          },
          required: ["providerCode"],
        },
        response: {
          200: successEnvelope({
            type: "object",
            required: ["provider", "models"],
            properties: {
              provider: providerSummarySchema,
              models: {
                type: "array",
                items: {
                  type: "object",
                  required: ["id", "name"],
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                  },
                },
              },
            },
          }),
          400: errorEnvelope,
          500: errorEnvelope,
        },
      },
    },
    async (request, reply) => {
      try {
        const data = await providerSettingsService.syncProviderModels(
          request.params.providerCode,
        );
        return success(data, "Models synced successfully");
      } catch (err) {
        app.log.error(err);
        const message =
          err instanceof Error ? err.message : "Failed to sync provider models";
        return reply.code(400).send(error(message, ErrorCodes.DATABASE_ERROR));
      }
    },
  );

  app.put<{
    Params: { providerCode: ProviderCode; role: ModelType };
    Body: { remoteModelId: string };
  }>(
    "/providers/:providerCode/select-model/:role",
    {
      schema: {
        tags: ["Provider Settings"],
        summary: "Select default model for role",
        description:
          "Assign a provider model to llm, embedding, or rerank and reset that role's params to backend defaults.",
        operationId: "selectDefaultProviderModelForRole",
        params: {
          type: "object",
          properties: {
            providerCode: providerCodeSchema,
            role: modelTypeSchema,
          },
          required: ["providerCode", "role"],
        },
        body: {
          type: "object",
          properties: {
            remoteModelId: { type: "string" },
          },
          required: ["remoteModelId"],
        },
        response: {
          200: successEnvelope(roleModelConfigSchema),
          400: errorEnvelope,
          500: errorEnvelope,
        },
      },
    },
    async (request, reply) => {
      try {
        const config = providerSettingsService.selectRoleModel(
          request.params.providerCode,
          request.params.role,
          request.body.remoteModelId,
        );

        return success(config, "Default model updated");
      } catch (err) {
        app.log.error(err);
        const message =
          err instanceof Error ? err.message : "Failed to select default model";
        return reply.code(400).send(error(message, ErrorCodes.NOT_FOUND));
      }
    },
  );
};

export default providerSettingsRoute;
