import type { FastifyInstance } from "fastify";
import { MAX_MESSAGE_CONTENT_LENGTH } from "@/constants/domain.js";
import { threadService } from "@/services/thread.service";
import {
  success,
  THREAD_NOT_FOUND_MESSAGE,
} from "@/utils/index.js";
import { badRequest, notFound, routeHandler } from "@/utils/route-errors.js";
import { isThreadAccessError } from "./access.js";
import { threadRouteSchemas } from "./schemas.js";
import type { CreateMessageBody } from "./types.js";

export const registerThreadMessageRoutes = async (app: FastifyInstance) => {
  app.get<{ Params: { id: string } }>(
    "/threads/:id/messages",
    { schema: threadRouteSchemas.getMessages },
    routeHandler("Failed to get messages", async (request) => {
      try {
        const userId = request.authUser!.id;
        return success(threadService.getMessages(request.params.id, userId));
      } catch (err) {
        if (isThreadAccessError(err)) {
          throw notFound(THREAD_NOT_FOUND_MESSAGE, { cause: err });
        }
        throw err;
      }
    }),
  );

  app.post<{ Params: { id: string }; Body: CreateMessageBody }>(
    "/threads/:id/messages",
    { schema: threadRouteSchemas.createMessage },
    routeHandler("Failed to create message", async (request) => {
      if (request.body.content.length > MAX_MESSAGE_CONTENT_LENGTH) {
        throw badRequest(
          `Message content exceeds maximum length of ${MAX_MESSAGE_CONTENT_LENGTH} characters`,
        );
      }

      const userId = request.authUser!.id;
      const result = threadService.createMessage(
        request.params.id,
        userId,
        request.body,
      );
      return success(result, "Message created");
    }),
  );

  app.delete<{ Params: { id: string } }>(
    "/messages/:id",
    { schema: threadRouteSchemas.deleteMessage },
    routeHandler("Failed to delete message", async (request) => {
      const userId = request.authUser!.id;
      const deleted = threadService.deleteMessage(request.params.id, userId);
      if (!deleted) {
        throw notFound("Message not found");
      }
      return success({ deleted: true }, "Message deleted");
    }),
  );

  app.patch<{
    Params: { id: string; messageId: string };
    Body: { metadata: Record<string, unknown> };
  }>(
    "/threads/:id/messages/:messageId/metadata",
    { schema: threadRouteSchemas.updateMessageMetadata },
    routeHandler("Failed to update message metadata", async (request) => {
      const result = threadService.updateMessageMetadata(
        request.params.id,
        request.params.messageId,
        request.authUser!.id,
        request.body.metadata,
      );
      if (!result) throw notFound("Message not found");
      return success(result, "Message metadata updated");
    }),
  );
};
