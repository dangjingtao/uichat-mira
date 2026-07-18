import type { FastifyPluginAsync } from "fastify";
import { getAuthUserFromRequest } from "@/db/auth.db.js";
import { success } from "@/utils/index.js";
import { badRequest, routeHandler, unauthorized } from "@/utils/route-errors.js";
import type { EvolvingKnowledgeService } from "@/microapps/evolving-knowledge/index.js";
import type { KnowledgeQueryMode } from "@/microapps/evolving-knowledge/index.js";
import type { KnowledgeWritebackInput } from "@/microapps/evolving-knowledge/index.js";

export type EvolvingKnowledgeRouteOptions = {
  service: EvolvingKnowledgeService;
};

const contentTypes = new Set(["webpage"]);
const captureModes = new Set(["page", "selection", "image"]);

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

  if (input.captureMode !== undefined && (typeof input.captureMode !== "string" || !captureModes.has(input.captureMode))) {
    throw badRequest("captureMode must be page, selection, or image");
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
      if (attachmentInput.sourceUrl !== undefined && typeof attachmentInput.sourceUrl !== "string") {
        throw badRequest("attachment sourceUrl must be a string");
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
    contentType: "webpage" as const,
    captureMode: (input.captureMode ?? "page") as "page" | "selection" | "image",
    rawContent: input.rawContent,
    rawHtml: typeof input.rawHtml === "string" ? input.rawHtml : undefined,
    captureMetadata: (input.metadata ?? {}) as Record<string, unknown>,
    attachments: input.attachments as Array<{ filePath: string; mimeType: string; sourceUrl?: string }> | undefined,
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
        processAi: body.processAi === true,
      });

      return success(
        capture,
        body.processAi === true
          ? "Capture created and processed"
          : "Capture created without AI processing",
      );
    }),
  );

  app.post(
    "/microapps/evolving-knowledge/writeback",
    routeHandler("Failed to write back evolving knowledge", async (request) => {
      const user = getAuthUserFromRequest(request);
      if (!user) throw unauthorized("Missing auth token");
      const body = (request.body ?? {}) as Record<string, unknown>;
      if (body.kind !== "topic" && body.kind !== "viewpoint") {
        throw badRequest("kind must be topic or viewpoint");
      }
      if (typeof body.title !== "string" || !body.title.trim()) {
        throw badRequest("title is required");
      }
      if (typeof body.content !== "string" || !body.content.trim()) {
        throw badRequest("content is required");
      }
      if (body.viewpointId !== undefined && typeof body.viewpointId !== "string") {
        throw badRequest("viewpointId must be a string");
      }
      for (const field of ["captureIds", "evidenceUnitIds"] as const) {
        if (body[field] !== undefined && (!Array.isArray(body[field]) || body[field].some((item) => typeof item !== "string"))) {
          throw badRequest(`${field} must be an array of strings`);
        }
      }
      if (body.stance !== undefined && !["supports", "opposes", "context"].includes(body.stance as string)) {
        throw badRequest("stance must be supports, opposes, or context");
      }

      return success(await service.writeBackKnowledge({
        kind: body.kind,
        title: body.title,
        content: body.content,
        captureIds: body.captureIds as string[] | undefined,
        evidenceUnitIds: body.evidenceUnitIds as string[] | undefined,
        topicId: body.topicId as string | undefined,
        viewpointId: body.viewpointId as string | undefined,
        stance: body.stance as KnowledgeWritebackInput["stance"],
      }, user.id), "Knowledge writeback saved");
    }),
  );

  app.get(
    "/microapps/evolving-knowledge/health",
    routeHandler("Failed to check evolving knowledge health", async (request) => {
      const user = getAuthUserFromRequest(request);
      if (!user) throw unauthorized("Missing auth token");
      return success(service.getKnowledgeHealth(user.id));
    }),
  );

  app.get(
    "/microapps/evolving-knowledge/query-logs",
    routeHandler("Failed to list evolving knowledge query logs", async (request) => {
      const user = getAuthUserFromRequest(request);
      if (!user) throw unauthorized("Missing auth token");
      const query = request.query as { limit?: string };
      return success(service.listQueryLogs(user.id, query.limit ? Number.parseInt(query.limit, 10) : undefined));
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

  app.post(
    "/microapps/evolving-knowledge/query",
    routeHandler("Failed to query evolving knowledge", async (request) => {
      const user = getAuthUserFromRequest(request);
      if (!user) throw unauthorized("Missing auth token");
      const body = (request.body ?? {}) as Record<string, unknown>;
      if (typeof body.query !== "string" || !body.query.trim()) {
        throw badRequest("query is required");
      }
      if (
        body.mode !== undefined &&
        body.mode !== "fact" &&
        body.mode !== "viewpoint" &&
        body.mode !== "mixed" &&
        body.mode !== "conflict"
      ) {
        throw badRequest("mode must be fact, viewpoint, mixed, or conflict");
      }
      if (
        body.limit !== undefined &&
        (typeof body.limit !== "number" || !Number.isInteger(body.limit) || body.limit < 1 || body.limit > 50)
      ) {
        throw badRequest("limit must be an integer between 1 and 50");
      }

      return success(
        service.queryKnowledge(body.query, user.id, {
          mode: body.mode as KnowledgeQueryMode | undefined,
          limit: body.limit as number | undefined,
        }),
      );
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

  app.get(
    "/microapps/evolving-knowledge/captures/:id/evidence",
    routeHandler("Failed to get evidence units", async (request) => {
      const { id } = (request as any).params as { id: string };
      const user = getAuthUserFromRequest(request);
      if (!user) throw unauthorized("Missing auth token");
      const capture = service.getCaptureById(id, user.id);
      if (!capture) {
        throw { statusCode: 404, message: "Capture not found" };
      }
      return success(service.listEvidenceUnits(id, user.id));
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
    "/microapps/evolving-knowledge/concepts",
    routeHandler("Failed to list concepts", async (request) => {
      const user = getAuthUserFromRequest(request);
      if (!user) throw unauthorized("Missing auth token");
      const query = request.query as { status?: string; limit?: string };
      return success(
        service.listConcepts(user.id, {
          status: query.status,
          limit: query.limit ? parseInt(query.limit, 10) : undefined,
        }),
      );
    }),
  );

  app.post(
    "/microapps/evolving-knowledge/concepts/:id/merge",
    routeHandler("Failed to merge concepts", async (request) => {
      const { id } = (request as any).params as { id: string };
      const user = getAuthUserFromRequest(request);
      if (!user) throw unauthorized("Missing auth token");
      const body = (request.body ?? {}) as Record<string, unknown>;
      if (typeof body.targetConceptId !== "string" || !body.targetConceptId) {
        throw badRequest("targetConceptId is required");
      }
      const concept = service.mergeConcepts(id, body.targetConceptId, user.id);
      if (!concept) throw { statusCode: 404, message: "Concept not found" };
      return success(concept, "Concept merged");
    }),
  );

  app.get(
    "/microapps/evolving-knowledge/topics",
    routeHandler("Failed to list knowledge topics", async (request) => {
      const user = getAuthUserFromRequest(request);
      if (!user) throw unauthorized("Missing auth token");
      const query = request.query as { limit?: string };
      return success(service.listTopics(user.id, query.limit ? parseInt(query.limit, 10) : undefined));
    }),
  );

  app.post(
    "/microapps/evolving-knowledge/topics/compile",
    routeHandler("Failed to compile knowledge topic", async (request) => {
      const user = getAuthUserFromRequest(request);
      if (!user) throw unauthorized("Missing auth token");
      const body = (request.body ?? {}) as Record<string, unknown>;
      if (typeof body.conceptId !== "string" || !body.conceptId) {
        throw badRequest("conceptId is required");
      }
      return success(await service.compileTopicForConcept(body.conceptId, user.id));
    }),
  );

  app.get(
    "/microapps/evolving-knowledge/topics/:id",
    routeHandler("Failed to get knowledge topic", async (request) => {
      const { id } = (request as any).params as { id: string };
      const user = getAuthUserFromRequest(request);
      if (!user) throw unauthorized("Missing auth token");
      const topic = service.getTopic(id, user.id);
      if (!topic) throw { statusCode: 404, message: "Knowledge topic not found" };
      return success(topic);
    }),
  );

  app.get(
    "/microapps/evolving-knowledge/topics/:id/evidence",
    routeHandler("Failed to get knowledge topic evidence", async (request) => {
      const { id } = (request as any).params as { id: string };
      const user = getAuthUserFromRequest(request);
      if (!user) throw unauthorized("Missing auth token");
      const topic = service.getTopic(id, user.id);
      if (!topic) throw { statusCode: 404, message: "Knowledge topic not found" };
      return success(service.listTopicEvidence(id, user.id));
    }),
  );

  app.get(
    "/microapps/evolving-knowledge/viewpoints",
    routeHandler("Failed to list viewpoints", async (request) => {
      const user = getAuthUserFromRequest(request);
      if (!user) throw unauthorized("Missing auth token");
      const query = request.query as { topicId?: string };
      return success(service.listViewpoints(user.id, query.topicId));
    }),
  );

  app.get(
    "/microapps/evolving-knowledge/viewpoints/:id",
    routeHandler("Failed to get viewpoint", async (request) => {
      const { id } = (request as any).params as { id: string };
      const user = getAuthUserFromRequest(request);
      if (!user) throw unauthorized("Missing auth token");
      const viewpoint = service.getViewpoint(id, user.id);
      if (!viewpoint) throw { statusCode: 404, message: "Viewpoint not found" };
      return success(viewpoint);
    }),
  );

  app.get(
    "/microapps/evolving-knowledge/viewpoints/:id/versions",
    routeHandler("Failed to list viewpoint versions", async (request) => {
      const { id } = (request as any).params as { id: string };
      const user = getAuthUserFromRequest(request);
      if (!user) throw unauthorized("Missing auth token");
      const viewpoint = service.getViewpoint(id, user.id);
      if (!viewpoint) throw { statusCode: 404, message: "Viewpoint not found" };
      return success(service.listViewpointVersions(id, user.id));
    }),
  );

  app.get(
    "/microapps/evolving-knowledge/viewpoints/:id/versions/:versionId/evidence",
    routeHandler("Failed to get viewpoint evidence", async (request) => {
      const { id, versionId } = (request as any).params as { id: string; versionId: string };
      const user = getAuthUserFromRequest(request);
      if (!user) throw unauthorized("Missing auth token");
      const viewpoint = service.getViewpoint(id, user.id);
      if (!viewpoint) throw { statusCode: 404, message: "Viewpoint not found" };
      return success(service.listViewpointEvidence(versionId, user.id));
    }),
  );

  app.post(
    "/microapps/evolving-knowledge/viewpoints/:id/review",
    routeHandler("Failed to review viewpoint", async (request) => {
      const { id } = (request as any).params as { id: string };
      const user = getAuthUserFromRequest(request);
      if (!user) throw unauthorized("Missing auth token");
      const body = (request.body ?? {}) as Record<string, unknown>;
      if (body.decision !== "confirm" && body.decision !== "reject") {
        throw badRequest("decision must be confirm or reject");
      }
      const result = await service.reviewViewpoint(id, user.id, {
        decision: body.decision,
        statement: typeof body.statement === "string" ? body.statement : undefined,
      });
      if (!result) throw { statusCode: 404, message: "Viewpoint not found" };
      return success(result, "Viewpoint review saved");
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
      const body = (request.body ?? {}) as Record<string, unknown>;
      const parseNonNegativeInteger = (value: unknown, field: string) => {
        if (value === undefined) return undefined;
        if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
          throw badRequest(`${field} must be a non-negative integer`);
        }
        return value;
      };

      return success(
        await service.rebuildKnowledge(user.id, {
          limit: parseNonNegativeInteger(body.limit, "limit"),
          offset: parseNonNegativeInteger(body.offset, "offset"),
        }),
        "Knowledge rebuild batch completed",
      );
    }),
  );
};

export default evolvingKnowledgeRoutes;
