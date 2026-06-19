import type { FastifyInstance } from "fastify";
import { getAuthUserFromRequest } from "@/db/auth.db.js";
import { attachmentStorageService } from "@/services/attachment-storage.service.js";
import { success } from "@/utils/index.js";
import { badRequest, routeHandler, unauthorized } from "@/utils/route-errors.js";

const MAX_CHAT_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set([".webp", ".png", ".jpg", ".jpeg", ".gif"]);

const isImageUpload = (mimeType: string, fileName: string) =>
  mimeType.startsWith("image/") ||
  IMAGE_EXTENSIONS.has(fileName.slice(fileName.lastIndexOf(".")).toLowerCase());

export default async function attachmentRoute(app: FastifyInstance) {
  app.post(
    "/attachments",
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

      if (!isImageUpload(mimeType, upload.filename)) {
        throw badRequest("Only image attachments are supported currently");
      }

      const saved = await attachmentStorageService.save({
        buffer,
        mimeType,
        originalName: upload.filename,
      });

      return success(saved, "Attachment uploaded");
    }),
  );

}
