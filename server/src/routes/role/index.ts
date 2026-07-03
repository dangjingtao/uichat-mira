import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "@/db/auth.db.js";
import { registerRoleRoutes } from "./roles.routes.js";

const roleRoute: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);
  await registerRoleRoutes(app);
};

export default roleRoute;
