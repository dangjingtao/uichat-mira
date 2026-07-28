import type { FastifyPluginAsync } from "fastify";
import type { createNewsHubService } from "@/microapps/news-hub/index.js";
import { success } from "@/utils/index.js";
import { successEnvelope } from "@/routes/schema-helpers.js";
import { getDashboardNews, getDashboardOverview, getDashboardWeather } from "./dashboard-service.js";

type DashboardControllerOptions = {
  newsHubService: ReturnType<typeof createNewsHubService>;
};

const dashboardController: FastifyPluginAsync<DashboardControllerOptions> = async (app, options) => {
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

  app.get<{ Querystring: { language?: string } }>(
    "/dashboard/news",
    {
      schema: {
        tags: ["Dashboard"],
        summary: "Read dashboard news from NewsHub",
        operationId: "getDashboardNews",
        querystring: {
          type: "object",
          properties: { language: { type: "string", maxLength: 16 } },
        },
        response: {
          200: successEnvelope({ type: "object", additionalProperties: true }),
        },
      },
    },
    async (request) => success(await getDashboardNews(options.newsHubService, new Date(), request.query.language), "Dashboard news loaded"),
  );

  app.get(
    "/dashboard/weather",
    {
      schema: {
        tags: ["Dashboard"],
        summary: "Read dashboard weather",
        operationId: "getDashboardWeather",
        response: {
          200: successEnvelope({ type: "object", additionalProperties: true }),
        },
      },
    },
    async () => success(await getDashboardWeather(), "Dashboard weather loaded"),
  );
};

export default dashboardController;
