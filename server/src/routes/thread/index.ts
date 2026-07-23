import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "@/db/auth.db.js";
import { registerThreadMessageRoutes } from "./messages.routes.js";
import { registerThreadSkillReportRoutes } from "./skill-reports.routes.js";
import { registerThreadRoutes } from "./threads.routes.js";

const threadRoute: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);
  await registerThreadRoutes(app);
  await registerThreadMessageRoutes(app);
  await registerThreadSkillReportRoutes(app);
};

export default threadRoute;
