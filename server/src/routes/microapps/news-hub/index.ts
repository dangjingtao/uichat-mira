import type { FastifyPluginAsync } from "fastify";
import { success } from "@/utils/index.js";
import { routeHandler } from "@/utils/route-errors.js";
import { successEnvelope } from "@/routes/schema-helpers.js";
import type { createNewsHubService } from "@/microapps/news-hub/index.js";

export type NewsHubRouteService = ReturnType<typeof createNewsHubService>;

const newsHubSourceSchema = {
  type: "object",
  required: [
    "key",
    "name",
    "sourceType",
    "fetchUrl",
    "siteUrl",
    "topic",
    "lang",
    "tags",
    "itemCount",
    "lastPublishedAt",
    "lastIngestedAt",
  ],
  properties: {
    key: { type: "string" },
    name: { type: "string" },
    sourceType: { type: "string" },
    fetchUrl: { type: "string" },
    siteUrl: { type: "string" },
    topic: { type: "string" },
    lang: { type: "string" },
    tags: {
      type: "array",
      items: { type: "string" },
    },
    itemCount: { type: "number" },
    lastPublishedAt: { type: ["string", "null"] },
    lastIngestedAt: { type: ["string", "null"] },
  },
} as const;

const newsHubItemSchema = {
  type: "object",
  required: [
    "id",
    "sourceType",
    "sourceName",
    "sourceKey",
    "externalId",
    "title",
    "summary",
    "contentText",
    "url",
    "author",
    "publishedAt",
    "ingestedAt",
    "lang",
    "topic",
    "tags",
    "rawPayload",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string" },
    sourceType: { type: "string" },
    sourceName: { type: "string" },
    sourceKey: { type: "string" },
    externalId: { type: "string" },
    title: { type: "string" },
    summary: { type: "string" },
    contentText: { type: "string" },
    url: { type: "string" },
    author: { type: ["string", "null"] },
    publishedAt: { type: ["string", "null"] },
    ingestedAt: { type: "string" },
    lang: { type: "string" },
    topic: { type: "string" },
    tags: {
      type: "array",
      items: { type: "string" },
    },
    rawPayload: {
      type: "object",
      additionalProperties: true,
    },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
} as const;

const newsHubRoutes: FastifyPluginAsync<{
  newsHubService: NewsHubRouteService;
}> = async (app, options) => {
  const { newsHubService } = options;
  if (!newsHubService) {
    throw new Error("newsHubRoutes requires newsHubService");
  }

  app.get<{
    Querystring: {
      limit?: string;
      sourceKey?: string;
      q?: string;
    };
  }>(
    "/microapps/news-hub/overview",
    {
      schema: {
        tags: ["Tools"],
        summary: "Get news hub overview",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            limit: { type: "string" },
            sourceKey: { type: "string" },
            q: { type: "string" },
          },
        },
        response: {
          200: successEnvelope({
            type: "object",
            required: ["sources", "items", "total", "generatedAt"],
            properties: {
              sources: {
                type: "array",
                items: newsHubSourceSchema,
              },
              items: {
                type: "array",
                items: newsHubItemSchema,
              },
              total: { type: "number" },
              generatedAt: { type: "string" },
            },
          }),
        },
      },
    },
    routeHandler("Failed to load news hub overview", async (request) => {
      const limit =
        typeof request.query.limit === "string"
          ? Number.parseInt(request.query.limit, 10)
          : undefined;

      const overview = newsHubService.getOverview({
        limit: Number.isFinite(limit) ? limit : undefined,
        sourceKey: request.query.sourceKey || undefined,
        query: request.query.q || undefined,
      });

      return success(overview);
    }),
  );

  app.post(
    "/microapps/news-hub/refresh",
    {
      schema: {
        tags: ["Tools"],
        summary: "Refresh news hub sources",
        security: [{ bearerAuth: [] }],
        response: {
          200: successEnvelope({
            type: "object",
            required: [
              "startedAt",
              "finishedAt",
              "fetchedCount",
              "insertedCount",
              "updatedCount",
              "sources",
            ],
            properties: {
              startedAt: { type: "string" },
              finishedAt: { type: "string" },
              fetchedCount: { type: "number" },
              insertedCount: { type: "number" },
              updatedCount: { type: "number" },
              sources: {
                type: "array",
                items: {
                  type: "object",
                  required: [
                    "key",
                    "name",
                    "fetchedCount",
                    "insertedCount",
                    "updatedCount",
                    "status",
                    "error",
                  ],
                  properties: {
                    key: { type: "string" },
                    name: { type: "string" },
                    fetchedCount: { type: "number" },
                    insertedCount: { type: "number" },
                    updatedCount: { type: "number" },
                    status: { type: "string", enum: ["succeeded", "failed"] },
                    error: { type: ["string", "null"] },
                  },
                },
              },
            },
          }),
        },
      },
    },
    routeHandler("Failed to refresh news hub", async () => {
      const result = await newsHubService.refresh();
      return success(result, "News hub refreshed");
    }),
  );
};

export default newsHubRoutes;
