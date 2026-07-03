import type { FastifyInstance } from "fastify";
import { knowledgeBaseService } from "@/services/knowledge-base.service.js";
import {
  DOCUMENT_NOT_FOUND_MESSAGE,
  KNOWLEDGE_BASE_NOT_FOUND_MESSAGE,
  success,
} from "@/utils/index.js";
import { notFound, routeHandler } from "@/utils/route-errors.js";
import { knowledgeBaseRouteSchemas } from "./schemas.js";
import type {
  CreateKnowledgeBaseBody,
  CreateDocumentBody,
  DocumentListQuery,
  KnowledgeBaseIdParams,
  UpdateKnowledgeBaseBody,
  UpdateDocumentBody,
} from "./types.js";

const toDocumentFilters = (query: DocumentListQuery) => ({
  search: query.search,
  enabled:
    query.enabled === "true"
      ? true
      : query.enabled === "false"
        ? false
        : undefined,
  indexStatus: query.indexStatus,
  sortBy: query.sortBy,
  sortOrder: query.sortOrder ?? "desc",
});

export const registerKnowledgeBaseDocumentRoutes = async (
  app: FastifyInstance,
) => {
  app.get(
    "/knowledge-bases",
    { schema: knowledgeBaseRouteSchemas.listKnowledgeBases },
    routeHandler("Failed to list knowledge bases", async () =>
      success(knowledgeBaseService.listKnowledgeBases()),
    ),
  );

  app.get<{ Params: KnowledgeBaseIdParams }>(
    "/knowledge-bases/:knowledgeBaseId",
    { schema: knowledgeBaseRouteSchemas.getKnowledgeBaseById },
    routeHandler<{ Params: KnowledgeBaseIdParams }>(
      "Failed to get knowledge base",
      async (request) => {
        const result = knowledgeBaseService.getKnowledgeBaseById(
          request.params.knowledgeBaseId,
        );
        if (!result) {
          throw notFound(KNOWLEDGE_BASE_NOT_FOUND_MESSAGE);
        }

        return success(result);
      },
    ),
  );

  app.post<{ Body: CreateKnowledgeBaseBody }>(
    "/knowledge-bases",
    { schema: knowledgeBaseRouteSchemas.createKnowledgeBase },
    routeHandler<{ Body: CreateKnowledgeBaseBody }>(
      "Failed to create knowledge base",
      async (request) =>
        success(
          knowledgeBaseService.createKnowledgeBase(request.body),
          "Knowledge base created",
        ),
    ),
  );

  app.patch<{ Params: KnowledgeBaseIdParams; Body: UpdateKnowledgeBaseBody }>(
    "/knowledge-bases/:knowledgeBaseId",
    { schema: knowledgeBaseRouteSchemas.updateKnowledgeBase },
    routeHandler<{ Params: KnowledgeBaseIdParams; Body: UpdateKnowledgeBaseBody }>(
      "Failed to update knowledge base",
      async (request) => {
        const result = knowledgeBaseService.updateKnowledgeBase(
          request.params.knowledgeBaseId,
          request.body,
        );
        if (!result) {
          throw notFound(KNOWLEDGE_BASE_NOT_FOUND_MESSAGE);
        }

        return success(result, "Knowledge base updated");
      },
    ),
  );

  app.delete<{ Params: KnowledgeBaseIdParams }>(
    "/knowledge-bases/:knowledgeBaseId",
    { schema: knowledgeBaseRouteSchemas.deleteKnowledgeBase },
    routeHandler<{ Params: KnowledgeBaseIdParams }>(
      "Failed to delete knowledge base",
      async (request) => {
        const deleted = knowledgeBaseService.deleteKnowledgeBase(
          request.params.knowledgeBaseId,
        );
        if (!deleted) {
          throw notFound(KNOWLEDGE_BASE_NOT_FOUND_MESSAGE);
        }

        return success({ deleted: true }, "Knowledge base deleted");
      },
    ),
  );

  app.get(
    "/knowledge-base",
    { schema: knowledgeBaseRouteSchemas.getKnowledgeBase },
    routeHandler("Failed to get knowledge base", async () =>
      success(knowledgeBaseService.getDefaultKnowledgeBase()),
    ),
  );

  app.get<{ Querystring: DocumentListQuery }>(
    "/knowledge-base/documents",
    { schema: knowledgeBaseRouteSchemas.listDocuments },
    routeHandler<{ Querystring: DocumentListQuery }>(
      "Failed to list documents",
      async (request) =>
        success(knowledgeBaseService.listDocuments(undefined, toDocumentFilters(request.query))),
    ),
  );

  app.get<{ Params: KnowledgeBaseIdParams; Querystring: DocumentListQuery }>(
    "/knowledge-bases/:knowledgeBaseId/documents",
    { schema: knowledgeBaseRouteSchemas.listKnowledgeBaseDocuments },
    routeHandler<{ Params: KnowledgeBaseIdParams; Querystring: DocumentListQuery }>(
      "Failed to list knowledge base documents",
      async (request) => {
        const knowledgeBase = knowledgeBaseService.getKnowledgeBaseById(
          request.params.knowledgeBaseId,
        );
        if (!knowledgeBase) {
          throw notFound(KNOWLEDGE_BASE_NOT_FOUND_MESSAGE);
        }

        return success(
          knowledgeBaseService.listDocuments(
            request.params.knowledgeBaseId,
            toDocumentFilters(request.query),
          ),
        );
      },
    ),
  );

  app.get<{ Params: { id: string } }>(
    "/knowledge-base/documents/:id/status",
    { schema: knowledgeBaseRouteSchemas.getDocumentStatus },
    routeHandler<{ Params: { id: string } }>(
      "Failed to get document status",
      async (request) => {
        const result = knowledgeBaseService.getDocumentSummaryById(
          request.params.id,
        );
        if (!result) {
          throw notFound(DOCUMENT_NOT_FOUND_MESSAGE);
        }

        return success(result);
      },
    ),
  );

  app.get<{ Params: KnowledgeBaseIdParams & { id: string } }>(
    "/knowledge-bases/:knowledgeBaseId/documents/:id/status",
    { schema: knowledgeBaseRouteSchemas.getDocumentStatus },
    routeHandler<{ Params: KnowledgeBaseIdParams & { id: string } }>(
      "Failed to get knowledge base document status",
      async (request) => {
        const result = knowledgeBaseService.getDocumentSummaryByKnowledgeBaseId(
          request.params.knowledgeBaseId,
          request.params.id,
        );
        if (!result) {
          throw notFound(DOCUMENT_NOT_FOUND_MESSAGE);
        }

        return success(result);
      },
    ),
  );

  app.get<{ Params: { id: string } }>(
    "/knowledge-base/documents/:id",
    { schema: knowledgeBaseRouteSchemas.getDocument },
    routeHandler<{ Params: { id: string } }>(
      "Failed to get document",
      async (request) => {
        const result = knowledgeBaseService.getDocumentById(request.params.id);
        if (!result) {
          throw notFound(DOCUMENT_NOT_FOUND_MESSAGE);
        }

        return success(result);
      },
    ),
  );

  app.get<{ Params: KnowledgeBaseIdParams & { id: string } }>(
    "/knowledge-bases/:knowledgeBaseId/documents/:id",
    { schema: knowledgeBaseRouteSchemas.getDocument },
    routeHandler<{ Params: KnowledgeBaseIdParams & { id: string } }>(
      "Failed to get knowledge base document",
      async (request) => {
        const result = knowledgeBaseService.getDocumentByKnowledgeBaseId(
          request.params.knowledgeBaseId,
          request.params.id,
        );
        if (!result) {
          throw notFound(DOCUMENT_NOT_FOUND_MESSAGE);
        }

        return success(result);
      },
    ),
  );

  app.post<{ Body: CreateDocumentBody }>(
    "/knowledge-base/documents",
    { schema: knowledgeBaseRouteSchemas.createDocument },
    routeHandler<{ Body: CreateDocumentBody }>(
      "Failed to create document",
      async (request) => {
        const result = await knowledgeBaseService.createDocument(
          undefined,
          request.body,
        );
        return success(result, "Document created");
      },
    ),
  );

  app.post<{ Params: KnowledgeBaseIdParams; Body: CreateDocumentBody }>(
    "/knowledge-bases/:knowledgeBaseId/documents",
    { schema: knowledgeBaseRouteSchemas.createDocument },
    routeHandler<{ Params: KnowledgeBaseIdParams; Body: CreateDocumentBody }>(
      "Failed to create knowledge base document",
      async (request) => {
        const result = await knowledgeBaseService.createDocument(
          request.params.knowledgeBaseId,
          request.body,
        );
        return success(result, "Document created");
      },
    ),
  );

  app.patch<{ Params: { id: string }; Body: UpdateDocumentBody }>(
    "/knowledge-base/documents/:id",
    { schema: knowledgeBaseRouteSchemas.updateDocument },
    routeHandler<{ Params: { id: string }; Body: UpdateDocumentBody }>(
      "Failed to update document",
      async (request) => {
        const result = await knowledgeBaseService.updateDocument(
          undefined,
          request.params.id,
          request.body,
        );
        if (!result) {
          throw notFound(DOCUMENT_NOT_FOUND_MESSAGE);
        }

        return success(result, "Document updated");
      },
    ),
  );

  app.patch<{ Params: KnowledgeBaseIdParams & { id: string }; Body: UpdateDocumentBody }>(
    "/knowledge-bases/:knowledgeBaseId/documents/:id",
    { schema: knowledgeBaseRouteSchemas.updateDocument },
    routeHandler<{
      Params: KnowledgeBaseIdParams & { id: string };
      Body: UpdateDocumentBody;
    }>(
      "Failed to update knowledge base document",
      async (request) => {
        const result = await knowledgeBaseService.updateDocument(
          request.params.knowledgeBaseId,
          request.params.id,
          request.body,
        );
        if (!result) {
          throw notFound(DOCUMENT_NOT_FOUND_MESSAGE);
        }

        return success(result, "Document updated");
      },
    ),
  );

  app.delete<{ Params: { id: string } }>(
    "/knowledge-base/documents/:id",
    { schema: knowledgeBaseRouteSchemas.deleteDocument },
    routeHandler<{ Params: { id: string } }>(
      "Failed to delete document",
      async (request) => {
        const deleted = knowledgeBaseService.deleteDocument(request.params.id);
        if (!deleted) {
          throw notFound(DOCUMENT_NOT_FOUND_MESSAGE);
        }

        return success({ deleted: true }, "Document deleted");
      },
    ),
  );

  app.delete<{ Params: KnowledgeBaseIdParams & { id: string } }>(
    "/knowledge-bases/:knowledgeBaseId/documents/:id",
    { schema: knowledgeBaseRouteSchemas.deleteDocument },
    routeHandler<{ Params: KnowledgeBaseIdParams & { id: string } }>(
      "Failed to delete knowledge base document",
      async (request) => {
        const deleted = knowledgeBaseService.deleteDocument(
          request.params.knowledgeBaseId,
          request.params.id,
        );
        if (!deleted) {
          throw notFound(DOCUMENT_NOT_FOUND_MESSAGE);
        }

        return success({ deleted: true }, "Document deleted");
      },
    ),
  );
};
