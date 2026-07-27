import type { FastifyPluginAsync } from "fastify";
import { success } from "@/utils/index.js";
import { successEnvelope } from "@/routes/schema-helpers.js";
import { getDashboardOverview } from "./dashboard-service.js";

const dashboardController: FastifyPluginAsync = async (app) => {
  app.get(
    "/dashboard/overview",
    {
      schema: {
        tags: ["Dashboard"],
        summary: "Read the dashboard overview",
        operationId: "getDashboardOverview",
        response: {
          200: successEnvelope({
            type: "object",
            required: ["generatedAt", "widgets"],
            properties: {
              generatedAt: { type: "string", format: "date-time" },
              widgets: { type: "array", items: { type: "object", additionalProperties: true } },
            },
          }),
        },
      },
    },
    async () => success(await getDashboardOverview(), "Dashboard overview loaded"),
  );
};

export default dashboardController;
