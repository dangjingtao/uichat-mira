import type { FastifyPluginAsync } from "fastify";
import { success } from "@/utils/index.js";
import { successEnvelope } from "@/routes/schema-helpers.js";
import { routeHandler } from "@/utils/route-errors.js";
import { getToolDefinitions } from "@/services/tools/registry.js";

const toolDefinitionSchema = {
  type: "object",
  required: ["id", "name", "description", "category", "tags", "runtime"],
  properties: {
    id: { type: "string", description: "Unique tool identifier" },
    name: { type: "string", description: "Tool display name" },
    description: { type: "string", description: "Tool description" },
    version: { type: "string", description: "Tool version" },
    category: {
      type: "string",
      enum: ["rag", "system", "tool"],
      description: "Tool category",
    },
    tags: {
      type: "array",
      description: "Tags used for grouping and filtering",
      items: { type: "string" },
    },
    author: { type: "string", description: "Tool author" },
    parameters: {
      type: "object",
      description: "Tool parameter JSON Schema",
      additionalProperties: true,
    },
    runtime: {
      type: "object",
      description: "Tool runtime configuration",
      additionalProperties: true,
    },
  },
} as const;

const toolsRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/tools",
    {
      schema: {
        tags: ["Tools"],
        summary: "List built-in tools",
        operationId: "listTools",
        description: "Return metadata of built-in agent tools loaded from tools/ and extendTools/ directories.",
        response: {
          200: successEnvelope({
            type: "array",
            description: "工具定义列表",
            items: toolDefinitionSchema,
          }),
        },
      },
    },
    routeHandler("获取内置工具列表失败", async () =>
      success(getToolDefinitions()),
    ),
  );
};

export default toolsRoute;
