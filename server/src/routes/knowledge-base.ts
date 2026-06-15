import type { FastifyPluginAsync } from "fastify";
import path from "node:path";
import { knowledgeBaseService } from "@/services/knowledge-base.service.js";
import { knowledgeBasePreviewService } from "@/services/knowledge-base.preview.service.js";
import {
  DEFAULT_UPLOAD_SOURCE_LABEL,
  MAX_UPLOAD_FILE_BYTES,
  SUPPORTED_UPLOAD_FILE_EXTENSIONS,
} from "@/constants/knowledge-base.js";
import {
  DOCUMENT_NOT_FOUND_MESSAGE,
  error,
  ErrorCodes,
  success,
} from "@/utils/index.js";
import {
  deletedResponseSchema,
  errorEnvelope,
  idParamsSchema,
  successEnvelope,
} from "@/routes/schema-helpers.js";

const supportedUploadExtensions = new Set(SUPPORTED_UPLOAD_FILE_EXTENSIONS);

const parseOptionalString = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseOptionalBoolean = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
};

const parseOptionalNumber = (value: unknown) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseChunkingConfig = (value: unknown) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parsed = JSON.parse(value) as unknown;
  return parsed && typeof parsed === "object"
    ? (parsed as {
        separator?: string;
        maxLength?: number;
        overlap?: number;
        replaceWhitespace?: boolean;
        removeUrls?: boolean;
        useQaSplit?: boolean;
      })
    : undefined;
};

const multipartChunkingConfigSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    splitterType: {
      type: "string",
      enum: ["character", "recursive", "markdown", "token"],
    },
    chunkSize: { type: "number" },
    chunkOverlap: { type: "number" },
    keepSeparator: { type: "boolean" },
    separator: { type: "string" },
    separators: {
      type: "array",
      items: { type: "string" },
    },
    presetLanguage: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    encodingName: { type: "string" },
    allowedSpecial: {
      anyOf: [
        { type: "string", enum: ["all"] },
        { type: "array", items: { type: "string" } },
      ],
    },
    disallowedSpecial: {
      anyOf: [
        { type: "string", enum: ["all"] },
        { type: "array", items: { type: "string" } },
      ],
    },
    lengthMetric: { type: "string", enum: ["characters", "utf8Bytes"] },
    replaceWhitespace: { type: "boolean" },
    removeUrls: { type: "boolean" },
    useQaSplit: { type: "boolean" },
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

const chunkPreviewSampleSchema = {
  type: "object",
  required: ["id", "index", "text", "charCount"],
  properties: {
    id: { type: "string" },
    index: { type: "number" },
    text: { type: "string" },
    charCount: { type: "number" },
  },
} as const;

const chunkPreviewStatsSchema = {
  type: "object",
  required: [
    "totalChunks",
    "minChunkLength",
    "maxChunkLength",
    "averageChunkLength",
    "normalizedTextLength",
  ],
  properties: {
    totalChunks: { type: "number" },
    minChunkLength: { type: "number" },
    maxChunkLength: { type: "number" },
    averageChunkLength: { type: "number" },
    normalizedTextLength: { type: "number" },
  },
} as const;

const chunkPreviewResponseSchema = {
  type: "object",
  required: ["totalChunks", "stats", "effectiveConfig", "sampleChunks"],
  properties: {
    totalChunks: { type: "number" },
    stats: chunkPreviewStatsSchema,
    effectiveConfig: multipartChunkingConfigSchema,
    sampleChunks: {
      type: "array",
      items: chunkPreviewSampleSchema,
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
    "/knowledge-base/documents/:id/status",
    {
      schema: {
        tags: ["Knowledge Base"],
        summary: "Get document indexing status",
        operationId: "getKnowledgeBaseDocumentStatus",
        params: idParamsSchema,
        response: {
          200: successEnvelope(documentSchema),
          404: errorEnvelope,
          500: errorEnvelope,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = knowledgeBaseService.getDocumentSummaryById(request.params.id);
        if (!result) {
          return reply
            .code(404)
            .send(error(DOCUMENT_NOT_FOUND_MESSAGE, ErrorCodes.NOT_FOUND));
        }

        return success(result);
      } catch (err) {
        app.log.error(err);
        return reply
          .code(500)
          .send(error("Failed to get document status", ErrorCodes.INTERNAL_ERROR));
      }
    },
  );

  app.post(
    "/knowledge-base/chunk-preview",
    {
      schema: {
        tags: ["Knowledge Base"],
        summary: "Preview document chunks without persisting",
        operationId: "previewKnowledgeBaseChunks",
        consumes: ["multipart/form-data"],
        response: {
          200: successEnvelope(chunkPreviewResponseSchema),
          400: errorEnvelope,
          413: errorEnvelope,
          500: errorEnvelope,
        },
      },
    },
    async (request, reply) => {
      try {
        if (!request.isMultipart()) {
          return reply
            .code(400)
            .send(
              error(
                "Expected multipart/form-data upload",
                ErrorCodes.VALIDATION_ERROR,
              ),
            );
        }

        let fileName = "";
        let fileExt = "";
        let contentText = "";
        const fields: Record<string, string> = {};

        for await (const part of request.parts()) {
          if (part.type === "file") {
            if (fileName) {
              return reply
                .code(400)
                .send(
                  error("Only one file can be uploaded", ErrorCodes.VALIDATION_ERROR),
                );
            }

            const buffer = await part.toBuffer();
            fileName = part.filename;
            fileExt = path.extname(part.filename).replace(/^\./, "").toLowerCase();
            contentText = buffer.toString("utf8").replace(/^\uFEFF/, "");
            continue;
          }

          fields[part.fieldname] =
            typeof part.value === "string" ? part.value : String(part.value ?? "");
        }

        if (!fileName) {
          return reply
            .code(400)
            .send(error("Please upload a file", ErrorCodes.VALIDATION_ERROR));
        }

        if (!supportedUploadExtensions.has(fileExt as (typeof SUPPORTED_UPLOAD_FILE_EXTENSIONS)[number])) {
          return reply
            .code(400)
            .send(
              error(
                `Unsupported file type ".${fileExt}". Only Markdown and TXT files are supported.`,
                ErrorCodes.VALIDATION_ERROR,
              ),
            );
        }

        if (!contentText.trim()) {
          return reply
            .code(400)
            .send(
              error("Uploaded file is empty", ErrorCodes.VALIDATION_ERROR),
            );
        }

        const result = await knowledgeBasePreviewService.previewChunks({
          rawText: contentText,
          chunkingConfig: parseChunkingConfig(fields.chunkingConfig),
          sampleCount: 10,
        });

        return success(result, "Chunk preview generated");
      } catch (err) {
        app.log.error(err);

        if (err instanceof Error && "statusCode" in err && err.statusCode === 413) {
          return reply
            .code(413)
            .send(
              error(
                `Uploaded file exceeds the ${Math.floor(MAX_UPLOAD_FILE_BYTES / (1024 * 1024))} MB limit`,
                ErrorCodes.VALIDATION_ERROR,
              ),
            );
        }

        if (err instanceof SyntaxError) {
          return reply
            .code(400)
            .send(
              error(
                "Invalid chunking config payload",
                ErrorCodes.VALIDATION_ERROR,
              ),
            );
        }

        return reply
          .code(500)
          .send(error("Failed to preview chunks", ErrorCodes.INTERNAL_ERROR));
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
        params: idParamsSchema,
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
            .send(error(DOCUMENT_NOT_FOUND_MESSAGE, ErrorCodes.NOT_FOUND));
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

  app.post(
    "/knowledge-base/documents/upload",
    {
      schema: {
        tags: ["Knowledge Base"],
        summary: "Upload a document and index it asynchronously",
        operationId: "uploadKnowledgeBaseDocument",
        consumes: ["multipart/form-data"],
        response: {
          200: successEnvelope(documentSchema),
          400: errorEnvelope,
          413: errorEnvelope,
          500: errorEnvelope,
        },
      },
    },
    async (request, reply) => {
      try {
        if (!request.isMultipart()) {
          return reply
            .code(400)
            .send(
              error(
                "Expected multipart/form-data upload",
                ErrorCodes.VALIDATION_ERROR,
              ),
            );
        }

        let fileName = "";
        let fileExt = "";
        let mimeType: string | null = null;
        let fileSize = 0;
        let contentText = "";
        const fields: Record<string, string> = {};

        for await (const part of request.parts()) {
          if (part.type === "file") {
            if (fileName) {
              return reply
                .code(400)
                .send(
                  error("Only one file can be uploaded", ErrorCodes.VALIDATION_ERROR),
                );
            }

            const buffer = await part.toBuffer();
            fileName = part.filename;
            fileExt = path.extname(part.filename).replace(/^\./, "").toLowerCase();
            mimeType = part.mimetype || "text/plain";
            fileSize = buffer.byteLength;
            contentText = buffer.toString("utf8").replace(/^\uFEFF/, "");
            continue;
          }

          fields[part.fieldname] =
            typeof part.value === "string" ? part.value : String(part.value ?? "");
        }

        if (!fileName) {
          return reply
            .code(400)
            .send(error("Please upload a file", ErrorCodes.VALIDATION_ERROR));
        }

        if (!supportedUploadExtensions.has(fileExt as (typeof SUPPORTED_UPLOAD_FILE_EXTENSIONS)[number])) {
          return reply
            .code(400)
            .send(
              error(
                `Unsupported file type ".${fileExt}". Only Markdown and TXT files are supported.`,
                ErrorCodes.VALIDATION_ERROR,
              ),
            );
        }

        if (!contentText.trim()) {
          return reply
            .code(400)
            .send(
              error("Uploaded file is empty", ErrorCodes.VALIDATION_ERROR),
            );
        }

        const result = await knowledgeBaseService.createUploadDocument({
          name: parseOptionalString(fields.name) ?? fileName,
          fileExt:
            parseOptionalString(fields.fileExt)?.toLowerCase() ?? fileExt,
          contentText,
          mimeType,
          fileSize:
            parseOptionalNumber(fields.fileSize) ?? fileSize ?? MAX_UPLOAD_FILE_BYTES,
          sourceType:
            parseOptionalString(fields.sourceType) === "api" ||
            parseOptionalString(fields.sourceType) === "sync"
              ? (parseOptionalString(fields.sourceType) as "api" | "sync")
              : "upload",
          sourceLabel:
            parseOptionalString(fields.sourceLabel) ?? DEFAULT_UPLOAD_SOURCE_LABEL,
          enabled: parseOptionalBoolean(fields.enabled) ?? true,
          chunkingConfig: parseChunkingConfig(fields.chunkingConfig),
        });

        return success(result, "Document uploaded and indexing started");
      } catch (err) {
        app.log.error(err);

        if (err instanceof Error && "statusCode" in err && err.statusCode === 413) {
          return reply
            .code(413)
            .send(
              error(
                `Uploaded file exceeds the ${Math.floor(MAX_UPLOAD_FILE_BYTES / (1024 * 1024))} MB limit`,
                ErrorCodes.VALIDATION_ERROR,
              ),
            );
        }

        if (err instanceof SyntaxError) {
          return reply
            .code(400)
            .send(
              error(
                "Invalid chunking config payload",
                ErrorCodes.VALIDATION_ERROR,
              ),
            );
        }

        return reply
          .code(500)
          .send(error("Failed to upload document", ErrorCodes.INTERNAL_ERROR));
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
        params: idParamsSchema,
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
            .send(error(DOCUMENT_NOT_FOUND_MESSAGE, ErrorCodes.NOT_FOUND));
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
        params: idParamsSchema,
        response: {
          200: successEnvelope(deletedResponseSchema),
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
            .send(error(DOCUMENT_NOT_FOUND_MESSAGE, ErrorCodes.NOT_FOUND));
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
