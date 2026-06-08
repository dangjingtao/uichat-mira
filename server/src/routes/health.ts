import { FastifyPluginAsync } from "fastify";
import { success } from "@/utils/index.js";

const healthRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/health",
    {
      schema: {
        tags: ["System"],
        summary: "Service health check",
        response: {
          200: {
            type: "object",
            required: ["success", "data", "timestamp"],
            properties: {
              success: { type: "boolean", const: true },
              data: {
                type: "object",
                required: ["service"],
                properties: {
                  service: { type: "string" },
            },
          },
          message: { type: "string" },
          timestamp: { type: "string", format: "date-time" },
        },
      },
        },
      },
    },
    async () =>
      success(
        { service: "ui-chat-rag-tester-server" },
        "Service is healthy",
      ),
  );
};

export default healthRoute;
