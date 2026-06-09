import type { FastifyPluginAsync } from "fastify";
import { knowledgeBaseService } from "@/services/knowledge-base.service.js";
import { error, ErrorCodes, success } from "@/utils/index.js";

const successEnvelope = (dataSchema: Record<string, unknown>) => ({
  type: "object",
  required: ["success", "data", "timestamp"],
  properties: {
    success: { type: "boolean", const: true },
    data: dataSchema,
    message: { type: "string" },
    timestamp: { type: "string", format: "date-time" },
  },
});

const errorEnvelope = {
  type: "object",
  required: ["success", "message", "timestamp"],
  properties: {
    success: { type: "boolean", const: false },
    message: { type: "string" },
    code: { type: "string" },
    errors: {
      type: "array",
      items: {},
    },
    timestamp: { type: "string", format: "date-time" },
  },
} as const;

const chunkingConfigSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    separator: { type: "string" },
    maxLength: { type: "number" },
    overlap: { type: "number" },
    replaceWhitespace: { type: "boolean" },
    removeUrls: { type: "boolean" },
    useQaSplit: { type: "boolean" },
  },
} as const;

const knowledgeBaseSummarySchema = {
  type: "object",
  required: [
    "id",
    "name",
    "description",
    "status",
    "documentCount",
    "enabledDocumentCount",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    description: { anyOf: [{ type: "string" }, { type: "null" }] },
    status: { type: "string", enum: ["active", "archived"] },
    documentCount: { type: "number" },
    enabledDocumentCount: { type: "number" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
} as const;

const documentSchema = {
  type: "object",
  required: [
    "id",
    "knowledgeBaseId",
    "name",
    "sourceType",
    "sourceLabel",
    "fileExt",
    "mimeType",
    "fileSize",
    "indexStatus",
    "enabled",
    "chunkCount",
    "charCount",
    "tokenCount",
    "errorMessage",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string" },
    knowledgeBaseId: { type: "string" },
    name: { type: "string" },
    sourceType: { type: "string", enum: ["upload", "sync", "api"] },
    sourceLabel: { anyOf: [{ type: "string" }, { type: "null" }] },
    fileExt: { type: "string" },
    mimeType: { anyOf: [{ type: "string" }, { type: "null" }] },
    fileSize: { anyOf: [{ type: "number" }, { type: "null" }] },
    indexStatus: { type: "string", enum: ["processing", "ready", "failed"] },
    enabled: { type: "boolean" },
    chunkCount: { type: "number" },
    charCount: { type: "number" },
    tokenCount: { anyOf: [{ type: "number" }, { type: "null" }] },
    errorMessage: { anyOf: [{ type: "string" }, { type: "null" }] },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
} as const;

const documentDetailSchema = {
  type: "object",
  required: [...documentSchema.required, "contentText", "chunks"],
  properties: {
    ...documentSchema.properties,
    contentText: { type: "string" },
    chunks: {
      type: "array",
      items: {
        type: "object",
        required: [
          "id",
          "chunkIndex",
          "content",
          "charCount",
          "tokenCount",
          "startOffset",
          "endOffset",
          "createdAt",
        ],
        properties: {
          id: { type: "number" },
          chunkIndex: { type: "number" },
          content: { type: "string" },
          charCount: { type: "number" },
          tokenCount: { anyOf: [{ type: "number" }, { type: "null" }] },
          startOffset: { anyOf: [{ type: "number" }, { type: "null" }] },
          endOffset: { anyOf: [{ type: "number" }, { type: "null" }] },
          createdAt: { type: "string" },
        },
      },
    },
  },
} as const;

const knowledgeBaseRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/knowledge-base",
    {
      schema: {
        tags: ["Knowledge Base"],
        summary: "Get default knowledge base",
        operationId: "getKnowledgeBase",
        response: {
          200: successEnvelope(knowledgeBaseSummarySchema),
          500: errorEnvelope,
        },
      },
    },
    async (_request, reply) => {
      try {
        return success(knowledgeBaseService.getDefaultKnowledgeBase());
      } catch (err) {
        app.log.error(err);
        return reply
          .code(500)
          .send(
            error("Failed to get knowledge base", ErrorCodes.INTERNAL_ERROR),
          );
      }
    },
  );

  app.get<{
    Querystring: {
      search?: string;
      enabled?: string;
      indexStatus?: "processing" | "ready" | "failed";
      sortBy?: "createdAt" | "updatedAt" | "charCount" | "chunkCount";
      sortOrder?: "asc" | "desc";
    };
  }>(
    "/knowledge-base/documents",
    {
      schema: {
        tags: ["Knowledge Base"],
        summary: "List documents in the default knowledge base",
        operationId: "listKnowledgeBaseDocuments",
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            search: { type: "string" },
            enabled: { type: "string", enum: ["true", "false"] },
            indexStatus: {
              type: "string",
              enum: ["processing", "ready", "failed"],
            },
            sortBy: {
              type: "string",
              enum: ["createdAt", "updatedAt", "charCount", "chunkCount"],
            },
            sortOrder: { type: "string", enum: ["asc", "desc"] },
          },
        },
        response: {
          200: successEnvelope({
            type: "array",
            items: documentSchema,
          }),
          500: errorEnvelope,
        },
      },
    },
    async (request, reply) => {
      try {
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
      } catch (err) {
        app.log.error(err);
        return reply
          .code(500)
          .send(error("Failed to list documents", ErrorCodes.INTERNAL_ERROR));
      }
    },
  );

  app.get<{
    Params: { id: string };
  }>(
    "/knowledge-base/documents/:id",
    {
      schema: {
        tags: ["Knowledge Base"],
        summary: "Get document detail",
        operationId: "getKnowledgeBaseDocument",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        response: {
          200: successEnvelope(documentDetailSchema),
          404: errorEnvelope,
          500: errorEnvelope,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = knowledgeBaseService.getDocumentById(request.params.id);
        if (!result) {
          return reply
            .code(404)
            .send(error("Document not found", ErrorCodes.NOT_FOUND));
        }

        return success(result);
      } catch (err) {
        app.log.error(err);
        return reply
          .code(500)
          .send(error("Failed to get document", ErrorCodes.INTERNAL_ERROR));
      }
    },
  );

  app.post<{
    Body: {
      name: string;
      fileExt: string;
      contentText: string;
      mimeType?: string | null;
      fileSize?: number | null;
      sourceType?: "upload" | "sync" | "api";
      sourceLabel?: string | null;
      enabled?: boolean;
      chunkingConfig?: {
        separator?: string;
        maxLength?: number;
        overlap?: number;
        replaceWhitespace?: boolean;
        removeUrls?: boolean;
        useQaSplit?: boolean;
      };
    };
  }>(
    "/knowledge-base/documents",
    {
      schema: {
        tags: ["Knowledge Base"],
        summary: "Create document and chunk it",
        operationId: "createKnowledgeBaseDocument",
        body: {
          type: "object",
          required: ["name", "fileExt", "contentText"],
          additionalProperties: false,
          properties: {
            name: { type: "string", minLength: 1 },
            fileExt: { type: "string", minLength: 1 },
            contentText: { type: "string", minLength: 1 },
            mimeType: { anyOf: [{ type: "string" }, { type: "null" }] },
            fileSize: { anyOf: [{ type: "number" }, { type: "null" }] },
            sourceType: { type: "string", enum: ["upload", "sync", "api"] },
            sourceLabel: { anyOf: [{ type: "string" }, { type: "null" }] },
            enabled: { type: "boolean" },
            chunkingConfig: chunkingConfigSchema,
          },
        },
        response: {
          200: successEnvelope(documentDetailSchema),
          500: errorEnvelope,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await knowledgeBaseService.createDocument(request.body);
        return success(result, "Document created");
      } catch (err) {
        app.log.error(err);
        return reply
          .code(500)
          .send(error("Failed to create document", ErrorCodes.INTERNAL_ERROR));
      }
    },
  );

  app.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      sourceLabel?: string | null;
      enabled?: boolean;
      contentText?: string;
      chunkingConfig?: {
        separator?: string;
        maxLength?: number;
        overlap?: number;
        replaceWhitespace?: boolean;
        removeUrls?: boolean;
        useQaSplit?: boolean;
      };
    };
  }>(
    "/knowledge-base/documents/:id",
    {
      schema: {
        tags: ["Knowledge Base"],
        summary: "Update document metadata or re-chunk content",
        operationId: "updateKnowledgeBaseDocument",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            sourceLabel: { anyOf: [{ type: "string" }, { type: "null" }] },
            enabled: { type: "boolean" },
            contentText: { type: "string" },
            chunkingConfig: chunkingConfigSchema,
          },
        },
        response: {
          200: successEnvelope(documentDetailSchema),
          404: errorEnvelope,
          500: errorEnvelope,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await knowledgeBaseService.updateDocument(
          request.params.id,
          request.body,
        );
        if (!result) {
          return reply
            .code(404)
            .send(error("Document not found", ErrorCodes.NOT_FOUND));
        }

        return success(result, "Document updated");
      } catch (err) {
        app.log.error(err);
        return reply
          .code(500)
          .send(error("Failed to update document", ErrorCodes.INTERNAL_ERROR));
      }
    },
  );

  app.delete<{
    Params: { id: string };
  }>(
    "/knowledge-base/documents/:id",
    {
      schema: {
        tags: ["Knowledge Base"],
        summary: "Delete document",
        operationId: "deleteKnowledgeBaseDocument",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        response: {
          200: successEnvelope({
            type: "object",
            required: ["deleted"],
            properties: {
              deleted: { type: "boolean" },
            },
          }),
          404: errorEnvelope,
          500: errorEnvelope,
        },
      },
    },
    async (request, reply) => {
      try {
        const deleted = knowledgeBaseService.deleteDocument(request.params.id);
        if (!deleted) {
          return reply
            .code(404)
            .send(error("Document not found", ErrorCodes.NOT_FOUND));
        }

        return success({ deleted: true }, "Document deleted");
      } catch (err) {
        app.log.error(err);
        return reply
          .code(500)
          .send(error("Failed to delete document", ErrorCodes.INTERNAL_ERROR));
      }
    },
  );
};

export default knowledgeBaseRoute;
