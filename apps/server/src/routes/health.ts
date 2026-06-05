import { FastifyPluginAsync } from "fastify";

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
            required: ["ok", "service", "now"],
            properties: {
              ok: { type: "boolean", const: true },
              service: { type: "string" },
              now: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    async () => ({
      ok: true,
      service: "ui-chat-rag-tester-server",
      now: new Date().toISOString(),
    }),
  );
};

export default healthRoute;
