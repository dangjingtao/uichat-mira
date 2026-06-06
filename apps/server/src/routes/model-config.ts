/**
 * 模型配置路由
 */
import { FastifyInstance } from "fastify";
import {
  modelConfigService,
  ModelConfigResponse,
} from "@/services/model-config.service";
import { ModelType } from "@/db/model-config.db";

/**
 * 注册模型配置路由
 */
export async function modelConfigRoutes(fastify: FastifyInstance) {
  /**
   * 获取所有类型的默认配置
   * GET /api/models
   */
  fastify.get("/api/models", async (request, reply) => {
    try {
      const configs = await modelConfigService.getAllDefaultConfigs();
      return { ok: true, data: configs };
    } catch (error) {
      fastify.log.error(error);
      return reply
        .code(500)
        .send({ ok: false, message: "Failed to get models" });
    }
  });

  /**
   * 获取指定类型的默认模型配置
   * GET /api/models/:type/config
   */
  fastify.get<{
    Params: { type: string };
  }>(
    "/api/models/:type/config",
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
            .send({ ok: false, message: "Config not found" });
        }

        return { ok: true, data: config };
      } catch (error) {
        fastify.log.error(error);
        return reply
          .code(500)
          .send({ ok: false, message: "Failed to get config" });
      }
    },
  );

  /**
   * 更新指定类型的默认模型配置
   * PUT /api/models/:type/config
   */
  fastify.put<{
    Params: { type: string };
    Body: {
      name?: string;
      params?: Record<string, any>;
    };
  }>(
    "/api/models/:type/config",
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
            .send({ ok: false, message: "Config not found" });
        }

        return { ok: true, data: config };
      } catch (error) {
        fastify.log.error(error);
        return reply
          .code(500)
          .send({ ok: false, message: "Failed to update config" });
      }
    },
  );

  /**
   * 获取参数模板
   * GET /api/models/param-templates
   */
  fastify.get<{
    Querystring: { type?: string };
  }>("/api/models/param-templates", async (request, reply) => {
    try {
      const { type } = request.query;
      const templates = await modelConfigService.getParamTemplates(
        type as ModelType | undefined,
      );
      return { ok: true, data: templates };
    } catch (error) {
      fastify.log.error(error);
      return reply
        .code(500)
        .send({ ok: false, message: "Failed to get param templates" });
    }
  });

  /**
   * 获取所有模型配置（非仅默认）
   * GET /api/models/configs
   */
  fastify.get<{
    Querystring: { type?: string };
  }>("/api/models/configs", async (request, reply) => {
    try {
      const { type } = request.query;
      const configs = await modelConfigService.getAllConfigs(
        type as ModelType | undefined,
      );
      return { ok: true, data: configs };
    } catch (error) {
      fastify.log.error(error);
      return reply
        .code(500)
        .send({ ok: false, message: "Failed to get configs" });
    }
  });

  /**
   * 创建新模型配置
   * POST /api/models/configs
   */
  fastify.post<{
    Body: {
      type: ModelType;
      name: string;
      params: Record<string, any>;
    };
  }>(
    "/api/models/configs",
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
        return reply.code(201).send({ ok: true, data: config });
      } catch (error) {
        fastify.log.error(error);
        return reply
          .code(500)
          .send({ ok: false, message: "Failed to create config" });
      }
    },
  );

  /**
   * 删除模型配置
   * DELETE /api/models/configs/:id
   */
  fastify.delete<{
    Params: { id: string };
  }>("/api/models/configs/:id", async (request, reply) => {
    try {
      const { id } = request.params;
      const deleted = await modelConfigService.deleteConfig(id);

      if (!deleted) {
        return reply.code(404).send({
          ok: false,
          message: "Config not found or is default config",
        });
      }

      return { ok: true, message: "Config deleted" };
    } catch (error) {
      fastify.log.error(error);
      return reply
        .code(500)
        .send({ ok: false, message: "Failed to delete config" });
    }
  });
}

export default modelConfigRoutes;
