import type { FastifyInstance } from "fastify";
import { getAuthUserFromRequest } from "@/db/auth.db.js";
import { attachmentStorageService } from "@/services/attachment-storage.service.js";
import { parseChatFilePart } from "@/services/chat-file-context.service.js";
import { success } from "@/utils/index.js";
import { badRequest, routeHandler, unauthorized } from "@/utils/route-errors.js";

const MAX_CHAT_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set([".webp", ".png", ".jpg", ".jpeg", ".gif"]);
const CHAT_FILE_EXTENSIONS = new Set([
  ".txt", ".md", ".markdown", ".csv", ".tsv", ".json", ".jsonl",
  ".yaml", ".yml", ".xml", ".ini", ".conf", ".cfg", ".env", ".html",
  ".css", ".scss", ".less", ".log", ".js", ".jsx", ".mjs", ".cjs", ".ts",
  ".tsx", ".py", ".java", ".kt", ".go", ".rs", ".sh", ".bash", ".zsh",
  ".ps1", ".bat", ".cmd", ".sql", ".toml", ".properties",
  ".gitignore", ".npmrc", ".editorconfig", ".pdf", ".docx", ".pptx", ".xlsx",
]);

const isImageUpload = (mimeType: string, fileName: string) =>
  mimeType.startsWith("image/") ||
  IMAGE_EXTENSIONS.has(fileName.slice(fileName.lastIndexOf(".")).toLowerCase());

const isChatFileUpload = (fileName: string) =>
  CHAT_FILE_EXTENSIONS.has(fileName.slice(fileName.lastIndexOf(".")).toLowerCase());

export default async function attachmentRoute(app: FastifyInstance) {
  app.post(
    "/attachments",
    {
      schema: {
        tags: ["Attachments"],
        summary: "Upload chat attachment",
        operationId: "uploadAttachment",
        consumes: ["multipart/form-data"],
        response: {
          200: {
            type: "object",
            required: ["success", "data", "timestamp"],
            properties: {
              success: { type: "boolean", const: true },
              data: {
                type: "object",
                required: ["id", "url", "fileName", "contentType", "size"],
                properties: {
                  id: { type: "string", description: "Attachment identifier." },
                  url: { type: "string", description: "Public attachment URL." },
                  fileName: { type: "string", description: "Stored file name." },
                  contentType: { type: "string", description: "Detected MIME type." },
                  size: { type: "number", description: "Attachment size in bytes." },
                },
              },
              timestamp: { type: "string", format: "date-time" },
            },
          },
          400: {
            type: "object",
            required: ["success", "message", "timestamp"],
            properties: {
              success: { type: "boolean", const: false },
              message: { type: "string" },
              code: { type: "string" },
              errors: { type: "array", items: {} },
              timestamp: { type: "string", format: "date-time" },
            },
          },
          401: {
            type: "object",
            required: ["success", "message", "timestamp"],
            properties: {
              success: { type: "boolean", const: false },
              message: { type: "string" },
              code: { type: "string" },
              errors: { type: "array", items: {} },
              timestamp: { type: "string", format: "date-time" },
            },
          },
          500: {
            type: "object",
            required: ["success", "message", "timestamp"],
            properties: {
              success: { type: "boolean", const: false },
              message: { type: "string" },
              code: { type: "string" },
              errors: { type: "array", items: {} },
              timestamp: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    routeHandler("Failed to upload attachment", async (request) => {
      const user = getAuthUserFromRequest(request);
      if (!user) {
        throw unauthorized("Missing auth token");
      }

      if (!request.isMultipart()) {
        throw badRequest("Expected multipart/form-data upload");
      }

      const upload = await request.file({
        limits: {
          files: 1,
          fileSize: MAX_CHAT_ATTACHMENT_BYTES,
        },
      });

      if (!upload) {
        throw badRequest("Please upload a file");
      }

      const buffer = await upload.toBuffer();
      const mimeType = upload.mimetype || "application/octet-stream";

      if (!isImageUpload(mimeType, upload.filename) && !isChatFileUpload(upload.filename)) {
        throw badRequest("This file type is not supported for chat upload");
      }

      const saved = await attachmentStorageService.save({
        buffer,
        mimeType,
        originalName: upload.filename,
      });

      if (!isImageUpload(mimeType, upload.filename)) {
        try {
          await parseChatFilePart({
            type: "file",
            filename: upload.filename,
            data: saved.url,
            fileId: saved.id,
            mimeType: saved.contentType,
          });
        } catch (error) {
          await attachmentStorageService.remove(saved.fileName);
          throw badRequest(
            error instanceof Error
              ? `Failed to parse file: ${error.message}`
              : "Failed to parse file",
          );
        }
      }

      return success(saved, "Attachment uploaded");
    }),
  );

}
