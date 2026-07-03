import type { FastifyInstance } from "fastify";
import { knowledgeBasePreviewService } from "@/services/knowledge-base.preview.service.js";
import { knowledgeBaseService } from "@/services/knowledge-base.service.js";
import { success } from "@/utils/index.js";
import {
  badRequest,
  createRouteError,
  routeHandler,
} from "@/utils/route-errors.js";
import { knowledgeBaseRouteSchemas } from "./schemas.js";
import type { KnowledgeBaseIdParams } from "./types.js";
import {
  isMultipartTooLargeError,
  MultipartValidationError,
  parseChunkingConfig,
  readSingleTextUpload,
  toUploadDocumentInput,
  uploadLimitMessage,
} from "./multipart.js";

export const registerKnowledgeBaseUploadRoutes = async (
  app: FastifyInstance,
) => {
  app.post(
    "/knowledge-base/chunk-preview",
    { schema: knowledgeBaseRouteSchemas.previewChunks },
    routeHandler("Failed to preview chunks", async (request) => {
      try {
        const upload = await readSingleTextUpload(request);
        const result = await knowledgeBasePreviewService.previewChunks({
          rawText: upload.contentText,
          chunkingConfig: parseChunkingConfig(upload.fields.chunkingConfig),
          sampleCount: 10,
        });

        return success(result, "Chunk preview generated");
      } catch (err) {
        if (err instanceof MultipartValidationError) {
          throw badRequest(err.message, { cause: err });
        }

        if (isMultipartTooLargeError(err)) {
          throw createRouteError({
            statusCode: 413,
            code: "UPLOAD_TOO_LARGE",
            message: uploadLimitMessage(),
            cause: err,
            logMessage: "Upload exceeds size limit",
          });
        }

        if (err instanceof SyntaxError) {
          throw badRequest("Invalid chunking config payload", { cause: err });
        }

        throw err;
      }
    }),
  );

  app.post(
    "/knowledge-base/documents/upload",
    { schema: knowledgeBaseRouteSchemas.uploadDocument },
    routeHandler("Failed to upload document", async (request) => {
      try {
        const upload = await readSingleTextUpload(request);
        const result = await knowledgeBaseService.createUploadDocument(
          undefined,
          toUploadDocumentInput(upload),
        );

        return success(result, "Document uploaded and indexing started");
      } catch (err) {
        if (err instanceof MultipartValidationError) {
          throw badRequest(err.message, { cause: err });
        }

        if (isMultipartTooLargeError(err)) {
          throw createRouteError({
            statusCode: 413,
            code: "UPLOAD_TOO_LARGE",
            message: uploadLimitMessage(),
            cause: err,
            logMessage: "Upload exceeds size limit",
          });
        }

        if (err instanceof SyntaxError) {
          throw badRequest("Invalid chunking config payload", { cause: err });
        }

        throw err;
      }
    }),
  );

  app.post<{ Params: KnowledgeBaseIdParams }>(
    "/knowledge-bases/:knowledgeBaseId/documents/upload",
    { schema: knowledgeBaseRouteSchemas.uploadDocument },
    routeHandler<{ Params: KnowledgeBaseIdParams }>(
      "Failed to upload knowledge base document",
      async (request) => {
        try {
          const upload = await readSingleTextUpload(request);
          const result = await knowledgeBaseService.createUploadDocument(
            request.params.knowledgeBaseId,
            toUploadDocumentInput(upload),
          );

          return success(result, "Document uploaded and indexing started");
        } catch (err) {
          if (err instanceof MultipartValidationError) {
            throw badRequest(err.message, { cause: err });
          }

          if (isMultipartTooLargeError(err)) {
            throw createRouteError({
              statusCode: 413,
              code: "UPLOAD_TOO_LARGE",
              message: uploadLimitMessage(),
              cause: err,
              logMessage: "Upload exceeds size limit",
            });
          }

          if (err instanceof SyntaxError) {
            throw badRequest("Invalid chunking config payload", { cause: err });
          }

          throw err;
        }
      },
    ),
  );
};
