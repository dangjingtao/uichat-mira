import type { FastifyPluginAsync } from "fastify";
import { success } from "@/utils/index.js";
import { badRequest, routeHandler } from "@/utils/route-errors.js";
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
    "lastFetchedAt",
    "lastFetchStatus",
    "lastFetchError",
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
    lastFetchedAt: { type: ["string", "null"] },
    lastFetchStatus: {
      type: "string",
      enum: ["idle", "succeeded", "failed"],
    },
    lastFetchError: { type: ["string", "null"] },
  },
} as const;

const newsHubConfigSchema = {
  type: "object",
  required: [
    "newsDataEnabled",
    "newsDataApiKey",
    "currentsEnabled",
    "currentsApiKey",
    "redditEnabled",
    "redditClientId",
    "redditClientSecret",
    "redditUserAgent",
    "redditSubreddits",
    "refreshTtlMinutes",
  ],
  properties: {
    newsDataEnabled: { type: "boolean" },
    newsDataApiKey: { type: "string" },
    currentsEnabled: { type: "boolean" },
    currentsApiKey: { type: "string" },
    redditEnabled: { type: "boolean" },
    redditClientId: { type: "string" },
    redditClientSecret: { type: "string" },
    redditUserAgent: { type: "string" },
    redditSubreddits: { type: "string" },
    refreshTtlMinutes: { type: "integer", minimum: 60, maximum: 1440 },
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

      const overview = await newsHubService.getOverview({
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
              "skippedCount",
              "ttlMinutes",
              "sources",
            ],
            properties: {
              startedAt: { type: "string" },
              finishedAt: { type: "string" },
              fetchedCount: { type: "number" },
              insertedCount: { type: "number" },
              updatedCount: { type: "number" },
              skippedCount: { type: "number" },
              ttlMinutes: { type: "number" },
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
                    "usedCache",
                    "lastFetchedAt",
                  ],
                  properties: {
                    key: { type: "string" },
                    name: { type: "string" },
                    fetchedCount: { type: "number" },
                    insertedCount: { type: "number" },
                    updatedCount: { type: "number" },
                    status: {
                      type: "string",
                      enum: ["succeeded", "failed", "skipped"],
                    },
                    error: { type: ["string", "null"] },
                    usedCache: { type: "boolean" },
                    lastFetchedAt: { type: ["string", "null"] },
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

  app.post<{ Body: { url: string } }>(
    "/microapps/news-hub/feeds/detect",
    {
      schema: {
        tags: ["Tools"],
        summary: "Detect RSS or Atom feeds from a page or feed URL",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          additionalProperties: false,
          required: ["url"],
          properties: { url: { type: "string", minLength: 1, maxLength: 2048 } },
        },
        response: { 200: successEnvelope({ type: "object", additionalProperties: true }) },
      },
    },
    routeHandler("Failed to detect news feed", async (request) => {
      try {
        return success(await newsHubService.detectFeed(request.body.url));
      } catch (error) {
        throw badRequest(error instanceof Error ? error.message : "无法检测订阅源");
      }
    }),
  );

  app.get(
    "/microapps/news-hub/feeds",
    {
      schema: {
        tags: ["Tools"],
        summary: "List RSS and Atom subscriptions",
        security: [{ bearerAuth: [] }],
        response: { 200: successEnvelope({ type: "array", items: { type: "object", additionalProperties: true } }) },
      },
    },
    routeHandler("Failed to list news feeds", async () => success(newsHubService.listFeedSubscriptions())),
  );

  app.post<{ Body: { feedUrl: string; name?: string; lang?: string; topic?: string } }>(
    "/microapps/news-hub/feeds",
    {
      schema: {
        tags: ["Tools"],
        summary: "Create an RSS or Atom subscription",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          additionalProperties: false,
          required: ["feedUrl"],
          properties: {
            feedUrl: { type: "string", minLength: 1, maxLength: 2048 },
            name: { type: "string", maxLength: 160 },
            lang: { type: "string", maxLength: 16 },
            topic: { type: "string", maxLength: 64 },
          },
        },
        response: { 200: successEnvelope({ type: "object", additionalProperties: true }) },
      },
    },
    routeHandler("Failed to create news feed", async (request) => {
      try { return success(await newsHubService.createFeedSubscription(request.body), "Feed subscribed"); }
      catch (error) { throw badRequest(error instanceof Error ? error.message : "添加订阅失败"); }
    }),
  );

  app.patch<{ Params: { id: string }; Body: { name?: string; enabled?: boolean; lang?: string; topic?: string } }>(
    "/microapps/news-hub/feeds/:id",
    {
      schema: {
        tags: ["Tools"],
        summary: "Update an RSS or Atom subscription",
        security: [{ bearerAuth: [] }],
        params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string", maxLength: 160 },
            enabled: { type: "boolean" },
            lang: { type: "string", maxLength: 16 },
            topic: { type: "string", maxLength: 64 },
          },
        },
        response: { 200: successEnvelope({ type: "object", additionalProperties: true }) },
      },
    },
    routeHandler("Failed to update news feed", async (request) => {
      try { return success(newsHubService.updateFeedSubscription(request.params.id, request.body)); }
      catch (error) { throw badRequest(error instanceof Error ? error.message : "更新订阅失败"); }
    }),
  );

  app.post<{ Params: { id: string } }>(
    "/microapps/news-hub/feeds/:id/refresh",
    {
      schema: {
        tags: ["Tools"],
        summary: "Force refresh one RSS or Atom subscription",
        security: [{ bearerAuth: [] }],
        params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
        response: { 200: successEnvelope({ type: "object", additionalProperties: true }) },
      },
    },
    routeHandler("Failed to refresh news feed", async (request) => {
      try { return success(await newsHubService.refreshFeedSubscription(request.params.id)); }
      catch (error) { throw badRequest(error instanceof Error ? error.message : "刷新订阅失败"); }
    }),
  );

  app.delete<{ Params: { id: string } }>(
    "/microapps/news-hub/feeds/:id",
    {
      schema: {
        tags: ["Tools"],
        summary: "Delete an RSS or Atom subscription and its cached items",
        security: [{ bearerAuth: [] }],
        params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
        response: { 200: successEnvelope({ type: "object", additionalProperties: true }) },
      },
    },
    routeHandler("Failed to delete news feed", async (request) => {
      try { return success(newsHubService.deleteFeedSubscription(request.params.id), "Feed deleted"); }
      catch (error) { throw badRequest(error instanceof Error ? error.message : "删除订阅失败"); }
    }),
  );

  app.get(
    "/microapps/news-hub/config",
    {
      schema: {
        tags: ["Tools"],
        summary: "Get news hub config",
        security: [{ bearerAuth: [] }],
        response: {
          200: successEnvelope(newsHubConfigSchema),
        },
      },
    },
    routeHandler("Failed to load news hub config", async () =>
      success(newsHubService.getConfig())),
  );

  app.put<{ Body: ReturnType<NewsHubRouteService["getConfig"]> }>(
    "/microapps/news-hub/config",
    {
      schema: {
        tags: ["Tools"],
        summary: "Save news hub config",
        security: [{ bearerAuth: [] }],
        body: {
          ...newsHubConfigSchema,
          additionalProperties: false,
        },
        response: {
          200: successEnvelope(newsHubConfigSchema),
        },
      },
    },
    routeHandler("Failed to save news hub config", async (request) =>
      success(newsHubService.updateConfig(request.body), "News hub config saved")),
  );
};

export default newsHubRoutes;
