import { FastifyInstance } from "fastify";
import {
  modelConfigService,
  ModelConfigResponse,
} from "@/services/model-config.service.js";
import { ModelType } from "@/db/model-config.db.js";
import { success, error, ErrorCodes } from "@/utils/index.js";

export async function modelConfigRoutes(fastify: FastifyInstance) {
  fastify.get("/models", async (request, reply) => {
    try {
      const configs = await modelConfigService.getAllDefaultConfigs();
      return success(configs);
    } catch (err) {
      fastify.log.error(err);
      return reply
        .code(500)
        .send(error("Failed to get models", ErrorCodes.INTERNAL_ERROR));
    }
  });

  fastify.get<{
    Params: { type: string };
  }>(
    "/models/:type/config",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["llm", "embedding", "rerank"] },
          },
          required: ["type"],
        },
      },
    },
    async (request, reply) => {
      try {
        const { type } = request.params;
        const config = await modelConfigService.getDefaultConfig(
          type as ModelType,
        );

        if (!config) {
          return reply
            .code(404)
            .send(error("Config not found", ErrorCodes.NOT_FOUND));
        }

        return success(config);
      } catch (err) {
        fastify.log.error(err);
        return reply
          .code(500)
          .send(error("Failed to get config", ErrorCodes.INTERNAL_ERROR));
      }
    },
  );

  fastify.put<{
    Params: { type: string };
    Body: {
      name?: string;
      params?: Record<string, any>;
    };
  }>(
    "/models/:type/config",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["llm", "embedding", "rerank"] },
          },
          required: ["type"],
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            params: { type: "object" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { type } = request.params;
        const { name, params } = request.body;

        const config = await modelConfigService.updateDefaultConfig(
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
        fastify.log.error(err);
        return reply
          .code(500)
          .send(error("Failed to update config", ErrorCodes.INTERNAL_ERROR));
      }
    },
  );

  fastify.get<{
    Querystring: { type?: string };
  }>("/models/param-templates", async (request, reply) => {
    try {
      const { type } = request.query;
      const templates = await modelConfigService.getParamTemplates(
        type as ModelType | undefined,
      );
      return success(templates);
    } catch (err) {
      fastify.log.error(err);
      return reply
        .code(500)
        .send(
          error("Failed to get param templates", ErrorCodes.INTERNAL_ERROR),
        );
    }
  });

  fastify.get<{
    Querystring: { type?: string };
  }>("/models/configs", async (request, reply) => {
    try {
      const { type } = request.query;
      const configs = await modelConfigService.getAllConfigs(
        type as ModelType | undefined,
      );
      return success(configs);
    } catch (err) {
      fastify.log.error(err);
      return reply
        .code(500)
        .send(error("Failed to get configs", ErrorCodes.INTERNAL_ERROR));
    }
  });

  fastify.post<{
    Body: {
      type: ModelType;
      name: string;
      params: Record<string, any>;
    };
  }>(
    "/models/configs",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["llm", "embedding", "rerank"] },
            name: { type: "string" },
            params: { type: "object" },
          },
          required: ["type", "name", "params"],
        },
      },
    },
    async (request, reply) => {
      try {
        const { type, name, params } = request.body;
        const config = await modelConfigService.createConfig(
          type,
          name,
          params,
        );
        return reply.code(201).send(success(config, "Config created"));
      } catch (err) {
        fastify.log.error(err);
        return reply
          .code(500)
          .send(error("Failed to create config", ErrorCodes.INTERNAL_ERROR));
      }
    },
  );

  fastify.delete<{
    Params: { id: string };
  }>("/models/configs/:id", async (request, reply) => {
    try {
      const { id } = request.params;
      const deleted = await modelConfigService.deleteConfig(id);

      if (!deleted) {
        return reply
          .code(404)
          .send(
            error(
              "Config not found or is default config",
              ErrorCodes.NOT_FOUND,
            ),
          );
      }

      return success({ deleted: true }, "Config deleted");
    } catch (err) {
      fastify.log.error(err);
      return reply
        .code(500)
        .send(error("Failed to delete config", ErrorCodes.INTERNAL_ERROR));
    }
  });
}

export default modelConfigRoutes;
