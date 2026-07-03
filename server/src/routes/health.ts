import { FastifyPluginAsync } from "fastify";
import { success } from "@/utils/index.js";
import { successEnvelope } from "@/routes/schema-helpers.js";

const healthRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/health",
    {
      schema: {
        tags: ["System"],
        summary: "Service health check",
        operationId: "getServiceHealth",
        response: {
          200: successEnvelope({
            type: "object",
            required: ["service"],
            properties: {
              service: { type: "string" },
            },
          }),
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
