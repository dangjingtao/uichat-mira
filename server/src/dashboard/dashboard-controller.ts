import type { FastifyPluginAsync } from "fastify";
import type { createNewsHubService } from "@/microapps/news-hub/index.js";
import type { createMailCenterService } from "@/microapps/mail-center/index.js";
import { success } from "@/utils/index.js";
import { successEnvelope } from "@/routes/schema-helpers.js";
import { getDashboardNews, getDashboardOverview, getDashboardWeather } from "./dashboard-service.js";
import { getDashboardMail } from "./dashboard-mail.js";

type DashboardControllerOptions = {
  newsHubService: ReturnType<typeof createNewsHubService>;
  mailCenterService: ReturnType<typeof createMailCenterService>;
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

  app.get<{ Querystring: { language?: string } }>(
    "/dashboard/mail",
    {
      schema: {
        tags: ["Dashboard"],
        summary: "Analyze today's Mail Center messages for the dashboard",
        operationId: "getDashboardMail",
        querystring: {
          type: "object",
          properties: { language: { type: "string", maxLength: 16 } },
        },
        response: {
          200: successEnvelope({ type: "object", additionalProperties: true }),
        },
      },
    },
    async (request) => success(
      await getDashboardMail(
        options.mailCenterService,
        request.authUser!.id,
        new Date(),
        request.query.language,
      ),
      "Dashboard mail loaded",
    ),
  );
};

export default dashboardController;
