import type { FastifyPluginAsync } from "fastify";
import { getAuthUserFromRequest } from "@/db/auth.db.js";
import { success } from "@/utils/index.js";
import { badRequest, routeHandler, unauthorized } from "@/utils/route-errors.js";
import type { EvolvingKnowledgeService } from "@/microapps/evolving-knowledge/index.js";

export type EvolvingKnowledgeRouteOptions = {
  service: EvolvingKnowledgeService;
};

const contentTypes = new Set(["text", "image"]);

const parseCaptureBody = (body: unknown) => {
  if (!body || typeof body !== "object") {
    throw badRequest("Capture body must be a JSON object");
  }

  const input = body as Record<string, unknown>;
  if (
    typeof input.sourceUrl !== "string" ||
    typeof input.title !== "string" ||
    typeof input.rawContent !== "string" ||
    typeof input.contentType !== "string" ||
    !contentTypes.has(input.contentType)
  ) {
    throw badRequest(
      "sourceUrl, title, rawContent, and a valid contentType are required",
    );
  }

  if (input.attachments !== undefined) {
    if (!Array.isArray(input.attachments)) {
      throw badRequest("attachments must be an array");
    }
    for (const attachment of input.attachments) {
      const attachmentInput = attachment as Record<string, unknown>;
      if (
        !attachment ||
        typeof attachment !== "object" ||
        typeof attachmentInput.filePath !== "string" ||
        typeof attachmentInput.mimeType !== "string" ||
        !attachmentInput.filePath.startsWith("/attachments/") ||
        !attachmentInput.mimeType.startsWith("image/")
      ) {
        throw badRequest("attachments must contain internal image attachment references");
      }
    }
  }

  if (input.favicon !== undefined && typeof input.favicon !== "string") {
    throw badRequest("favicon must be a string");
  }

  if (
    input.metadata !== undefined &&
    (typeof input.metadata !== "object" || input.metadata === null || Array.isArray(input.metadata))
  ) {
    throw badRequest("metadata must be an object");
  }

  return {
    sourceUrl: input.sourceUrl,
    title: input.title,
    favicon: input.favicon ?? "",
    contentType: input.contentType as "text" | "image",
    rawContent: input.rawContent,
    captureMetadata: (input.metadata ?? {}) as Record<string, unknown>,
    attachments: input.attachments as Array<{ filePath: string; mimeType: string }> | undefined,
  };
};

const evolvingKnowledgeRoutes: FastifyPluginAsync<
  EvolvingKnowledgeRouteOptions
> = async (app, options) => {
  const service = options.service;

  app.post(
    "/microapps/evolving-knowledge/captures",
    routeHandler("Failed to create capture", async (request) => {
      const user = getAuthUserFromRequest(request);
      if (!user) throw unauthorized("Missing auth token");
      const body = request.body as Record<string, unknown>;
      const capture = await service.processCapture(parseCaptureBody(body), {
        userId: user.id,
        processAi: body.processAi !== false,
      });

      return success(
        capture,
        body.processAi === true
          ? "Capture created and processed"
          : "Capture created without AI processing",
      );
    }),
  );

  app.get(
    "/microapps/evolving-knowledge/captures",
    routeHandler("Failed to list captures", async (request) => {
      const query = request.query as {
        limit?: string;
        offset?: string;
        contentType?: string;
      };
      const user = getAuthUserFromRequest(request);
      if (!user) throw unauthorized("Missing auth token");
      const captures = service.listCaptures(user.id, {
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
        contentType: query.contentType,
      });
      return success(captures);
    }),
  );

  app.get(
    "/microapps/evolving-knowledge/captures/search",
    routeHandler("Failed to search captures", async (request) => {
      const query = request.query as { q: string };
      const user = getAuthUserFromRequest(request);
      if (!user) throw unauthorized("Missing auth token");
      const captures = service.searchCaptures(query.q ?? "", user.id);
      return success(captures);
    }),
  );

  app.get(
    "/microapps/evolving-knowledge/captures/:id",
    routeHandler("Failed to get capture", async (request) => {
      const { id } = (request as any).params as { id: string };
      const user = getAuthUserFromRequest(request);
      if (!user) throw unauthorized("Missing auth token");
      const capture = service.getCaptureById(id, user.id);
      if (!capture) {
        throw { statusCode: 404, message: "Capture not found" };
      }
      return success(capture);
    }),
  );

  app.get(
    "/microapps/evolving-knowledge/captures/:id/relations",
    routeHandler("Failed to get relations", async (request) => {
      const { id } = (request as any).params as { id: string };
      const user = getAuthUserFromRequest(request);
      if (!user) throw unauthorized("Missing auth token");
      const relations = service.listRelationsForCapture(id, user.id);
      return success(relations);
    }),
  );

  app.delete(
    "/microapps/evolving-knowledge/captures/:id",
    routeHandler("Failed to delete capture", async (request) => {
      const { id } = (request as any).params as { id: string };
      const user = getAuthUserFromRequest(request);
      if (!user) throw unauthorized("Missing auth token");
      service.deleteCapture(id, user.id);
      return success(null, "Capture deleted");
    }),
  );

  app.get(
    "/microapps/evolving-knowledge/insights",
    routeHandler("Failed to list insights", async (request) => {
      const user = getAuthUserFromRequest(request);
      if (!user) throw unauthorized("Missing auth token");
      const insights = service.listActiveInsights(user.id);
      return success(insights);
    }),
  );

  app.post(
    "/microapps/evolving-knowledge/insights/:id/dismiss",
    routeHandler("Failed to dismiss insight", async (request) => {
      const { id } = (request as any).params as { id: string };
      const user = getAuthUserFromRequest(request);
      if (!user) throw unauthorized("Missing auth token");
      service.dismissInsight(id, user.id);
      return success(null, "Insight dismissed");
    }),
  );

  app.get(
    "/microapps/evolving-knowledge/tags",
    routeHandler("Failed to list tags", async (request) => {
      const user = getAuthUserFromRequest(request);
      if (!user) throw unauthorized("Missing auth token");
      const tags = service.listPopularTags(user.id);
      return success(tags);
    }),
  );

  app.get(
    "/microapps/evolving-knowledge/stats",
    routeHandler("Failed to get stats", async (request) => {
      const user = getAuthUserFromRequest(request);
      if (!user) throw unauthorized("Missing auth token");
      const captures = service.listCaptures(user.id, { limit: 1000 });
      const insights = service.listActiveInsights(user.id, { limit: 1000 });
      const tags = service.listPopularTags(user.id, 100);

      return success({
        totalCaptures: captures.length,
        totalInsights: insights.length,
        totalTags: tags.length,
        byContentType: captures.reduce(
          (acc, c) => {
            acc[c.contentType] = (acc[c.contentType] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
        topTags: tags.slice(0, 10),
      });
    }),
  );

  app.post(
    "/microapps/evolving-knowledge/rebuild",
    routeHandler("Failed to rebuild evolving knowledge", async (request) => {
      const user = getAuthUserFromRequest(request);
      if (!user) throw unauthorized("Missing auth token");
      return success(await service.rebuildKnowledge(user.id), "Knowledge rebuild completed");
    }),
  );
};

export default evolvingKnowledgeRoutes;
