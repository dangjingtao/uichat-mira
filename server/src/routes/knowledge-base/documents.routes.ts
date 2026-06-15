import type { FastifyInstance } from "fastify";
import { knowledgeBaseService } from "@/services/knowledge-base.service.js";
import { DOCUMENT_NOT_FOUND_MESSAGE, success } from "@/utils/index.js";
import { notFound, routeHandler } from "@/utils/route-errors.js";
import { knowledgeBaseRouteSchemas } from "./schemas.js";
import type {
  CreateDocumentBody,
  DocumentListQuery,
  UpdateDocumentBody,
} from "./types.js";

export const registerKnowledgeBaseDocumentRoutes = async (
  app: FastifyInstance,
) => {
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
      async (request) => {
        const filters = {
          search: request.query.search,
          enabled:
            request.query.enabled === "true"
              ? true
              : request.query.enabled === "false"
                ? false
                : undefined,
          indexStatus: request.query.indexStatus,
          sortBy: request.query.sortBy,
          sortOrder: request.query.sortOrder ?? "desc",
        };

        return success(knowledgeBaseService.listDocuments(filters));
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

  app.post<{ Body: CreateDocumentBody }>(
    "/knowledge-base/documents",
    { schema: knowledgeBaseRouteSchemas.createDocument },
    routeHandler<{ Body: CreateDocumentBody }>(
      "Failed to create document",
      async (request) => {
        const result = await knowledgeBaseService.createDocument(request.body);
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
};
