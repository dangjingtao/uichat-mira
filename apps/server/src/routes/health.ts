import { FastifyPluginAsync } from "fastify";

const healthRoute: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => ({
    ok: true,
    service: "ui-chat-rag-tester-server",
    now: new Date().toISOString(),
  }));
};

export default healthRoute;
