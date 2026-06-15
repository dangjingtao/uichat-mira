import type { FastifyPluginAsync } from "fastify";
import { registerKnowledgeBaseDocumentRoutes } from "./documents.routes.js";
import { registerKnowledgeBaseUploadRoutes } from "./uploads.routes.js";

const knowledgeBaseRoute: FastifyPluginAsync = async (app) => {
  await registerKnowledgeBaseDocumentRoutes(app);
  await registerKnowledgeBaseUploadRoutes(app);
};

export default knowledgeBaseRoute;

