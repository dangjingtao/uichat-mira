import type { FastifyPluginAsync } from "fastify";
import { registerProviderAssignmentRoutes } from "./assignments.routes.js";
import { registerProviderConnectionRoutes } from "./connections.routes.js";
import { registerProviderModelRoutes } from "./models.routes.js";

const providerSettingsRoute: FastifyPluginAsync = async (app) => {
  await registerProviderConnectionRoutes(app);
  await registerProviderModelRoutes(app);
  await registerProviderAssignmentRoutes(app);
};

export default providerSettingsRoute;

