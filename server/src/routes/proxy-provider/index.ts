import type { FastifyPluginAsync } from "fastify";
import { registerProxyProviderChatRoutes } from "./chat.routes.js";
import { registerProxyProviderEmbeddingRoutes } from "./embeddings.routes.js";

const proxyProviderRoute: FastifyPluginAsync = async (app) => {
  await registerProxyProviderChatRoutes(app);
  await registerProxyProviderEmbeddingRoutes(app);
};

export default proxyProviderRoute;

