import { FastifyPluginAsync } from "fastify";
import { modelConfigService } from "@/services/model-config.service.js";
import type { ModelType } from "@/db/schema.js";
import { success, error, ErrorCodes } from "@/utils/index.js";
import { PROVIDER_CODE_ENUM } from "@/providers/catalog.js";

const modelTypeEnum = ["llm", "embedding", "rerank"] as const;

const modelConfigSchema = {
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
    type: { type: "string", enum: modelTypeEnum },
    name: { type: "string" },
    providerCode: {
      anyOf: [{ type: "string", enum: PROVIDER_CODE_ENUM }, { type: "null" }],
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

const paramTemplateItemSchema = {
  type: "object",
  required: ["key", "label", "type", "defaultValue"],
  properties: {
    key: { type: "string" },
    label: { type: "string" },
    type: { type: "string", enum: ["number", "select", "boolean"] },
    step: { type: "number" },
    options: {
      type: "array",
      items: {
        type: "object",
        required: ["value", "label"],
        properties: {
          value: { type: "string" },
          label: { type: "string" },
        },
      },
    },
    defaultValue: {},
  },
} as const;

const modelConfigRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/models",
    {
      schema: {
        tags: ["Model Settings"],
        summary: "Get active role model configs",
        description:
          "Return the current effective default configs for llm, embedding, and rerank.",
        operationId: "getActiveRoleModelConfigs",
        response: {
          200: successEnvelope({
            type: "array",
            items: modelConfigSchema,
          }),
          500: errorEnvelope,
        },
      },
    },
    async (_request, reply) => {
      try {
        const configs = modelConfigService.getAllDefaultConfigs();
        return success(configs);
      } catch (err) {
        app.log.error(err);
        return reply
          .code(500)
          .send(error("Failed to get models", ErrorCodes.INTERNAL_ERROR));
      }
    },
  );

  app.get<{
    Params: { type: string };
  }>(
    "/models/:type/config",
    {
      schema: {
        tags: ["Model Settings"],
        summary: "Get active config by role",
        description: "Return the current effective config for a specific role.",
        operationId: "getActiveRoleModelConfigByType",
        params: {
          type: "object",
          properties: {
            type: { type: "string", enum: modelTypeEnum },
          },
          required: ["type"],
        },
        response: {
          200: successEnvelope(modelConfigSchema),
          404: errorEnvelope,
          500: errorEnvelope,
        },
      },
    },
    async (request, reply) => {
      try {
        const { type } = request.params;
        const config = modelConfigService.getDefaultConfig(type as ModelType);

        if (!config) {
          return reply
            .code(404)
            .send(error("Config not found", ErrorCodes.NOT_FOUND));
        }

        return success(config);
      } catch (err) {
        app.log.error(err);
        return reply
          .code(500)
          .send(error("Failed to get config", ErrorCodes.INTERNAL_ERROR));
      }
    },
  );

  app.put<{
    Params: { type: string };
    Body: {
      name?: string;
      params?: Record<string, unknown>;
    };
  }>(
    "/models/:type/config",
    {
      schema: {
        tags: ["Model Settings"],
        summary: "Update active config params by role",
        description:
          "Update the current effective role config. Typically used by the main settings page to save params.",
        operationId: "updateActiveRoleModelConfigByType",
        params: {
          type: "object",
          properties: {
            type: { type: "string", enum: modelTypeEnum },
          },
          required: ["type"],
        },
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            params: { type: "object", additionalProperties: true },
          },
        },
        response: {
          200: successEnvelope(modelConfigSchema),
          404: errorEnvelope,
          500: errorEnvelope,
        },
      },
    },
    async (request, reply) => {
      try {
        const { type } = request.params;
        const { name, params } = request.body;

        const config = modelConfigService.updateDefaultConfig(
          type as ModelType,
          {
            name,
            params,
          },
        );

        if (!config) {
          return reply
            .code(404)
            .send(error("Config not found", ErrorCodes.NOT_FOUND));
        }

        return success(config, "Config updated successfully");
      } catch (err) {
        app.log.error(err);
        return reply
          .code(500)
          .send(error("Failed to update config", ErrorCodes.INTERNAL_ERROR));
      }
    },
  );

  app.get<{
    Querystring: { type?: string };
  }>(
    "/models/param-templates",
    {
      schema: {
        tags: ["Model Settings"],
        summary: "Get param templates",
        description:
          "Return backend-defined parameter templates for llm, embedding, and rerank.",
        operationId: "getRoleModelParamTemplates",
        querystring: {
          type: "object",
          properties: {
            type: { type: "string", enum: modelTypeEnum },
          },
        },
        response: {
          200: successEnvelope({
            type: "object",
            required: ["llm", "embedding", "rerank"],
            properties: {
              llm: { type: "array", items: paramTemplateItemSchema },
              embedding: { type: "array", items: paramTemplateItemSchema },
              rerank: { type: "array", items: paramTemplateItemSchema },
            },
          }),
          500: errorEnvelope,
        },
      },
    },
    async (request, reply) => {
      try {
        const { type } = request.query;
        const templates = modelConfigService.getParamTemplates(
          type as ModelType | undefined,
        );
        return success(templates);
      } catch (err) {
        app.log.error(err);
        return reply
          .code(500)
          .send(
            error("Failed to get param templates", ErrorCodes.INTERNAL_ERROR),
          );
      }
    },
  );
};

export default modelConfigRoute;
