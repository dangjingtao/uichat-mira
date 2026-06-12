import type { FastifyPluginAsync } from "fastify";
import { threadService } from "@/services/thread.service";
import {
  error,
  ErrorCodes,
  success,
  isErrorMessage,
  THREAD_ACCESS_ERROR_MESSAGE,
  THREAD_NOT_FOUND_MESSAGE,
} from "@/utils/index.js";
import { requireAuth } from "@/db/auth.db.js";
import {
  MAX_MESSAGE_CONTENT_LENGTH,
  MESSAGE_ROLE_VALUES,
  THREAD_STATUS_VALUES,
} from "@/constants/domain.js";
import {
  deletedResponseSchema,
  errorEnvelope,
  idParamsSchema,
  successEnvelope,
} from "@/routes/schema-helpers.js";

const threadSchema = {
  type: "object",
    required: [
      "id",
      "title",
      "modelName",
      "ragEnabled",
      "status",
      "createdAt",
      "updatedAt",
    "messageCount",
  ],
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    modelName: { anyOf: [{ type: "string" }, { type: "null" }] },
    ragEnabled: { type: "boolean" },
    status: { type: "string", enum: THREAD_STATUS_VALUES },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    messageCount: { type: "number" },
    lastMessage: { type: "string" },
  },
} as const;

const messageSchema = {
  type: "object",
  required: ["id", "threadId", "role", "content", "createdAt"],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    threadId: { type: "string" },
    role: { type: "string", enum: MESSAGE_ROLE_VALUES },
    content: { type: "string" },
    metadata: {
      type: "object",
      additionalProperties: true,
    },
    createdAt: { type: "string", format: "date-time" },
  },
} as const;

const threadWithMessagesSchema = {
  type: "object",
  required: [...threadSchema.required, "messages"],
  properties: {
    ...threadSchema.properties,
    messages: {
      type: "array",
      items: messageSchema,
    },
  },
} as const;

const isThreadAccessError = (error: unknown) =>
  isErrorMessage(error, THREAD_ACCESS_ERROR_MESSAGE);

const threadRoute: FastifyPluginAsync = async (app) => {
  // 全局认证：所有线程管理接口都需要登录
  app.addHook("preHandler", requireAuth);

  app.get<{
    Querystring: {
      status?: "active" | "archived";
      sortBy?: "createdAt" | "updatedAt";
      sortOrder?: "asc" | "desc";
    };
  }>(
    "/threads",
    {
      schema: {
        tags: ["Thread"],
        summary: "List threads",
        operationId: "listThreads",
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            status: { type: "string", enum: ["active", "archived"] },
            sortBy: { type: "string", enum: ["createdAt", "updatedAt"] },
            sortOrder: { type: "string", enum: ["asc", "desc"] },
          },
        },
        response: {
          200: successEnvelope({
            type: "array",
            items: threadSchema,
          }),
          500: errorEnvelope,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.authUser!.id;
        const filters = {
          userId,
          status: request.query.status,
          sortBy: request.query.sortBy,
          sortOrder: request.query.sortOrder,
        };
        return success(threadService.listThreads(filters));
      } catch (err) {
        if (isThreadAccessError(err)) {
          return reply
            .code(404)
            .send(error(THREAD_NOT_FOUND_MESSAGE, ErrorCodes.NOT_FOUND));
        }
        app.log.error(err);
        return reply
          .code(500)
          .send(error("Failed to list threads", ErrorCodes.INTERNAL_ERROR));
      }
    },
  );

  app.get<{
    Params: { id: string };
  }>(
    "/threads/:id",
    {
      schema: {
        tags: ["Thread"],
        summary: "Get thread detail with messages",
        operationId: "getThread",
        params: idParamsSchema,
        response: {
          200: successEnvelope(threadWithMessagesSchema),
          404: errorEnvelope,
          500: errorEnvelope,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.authUser!.id;
        const result = threadService.getThreadById(request.params.id, userId);
        if (!result) {
          return reply
            .code(404)
            .send(error(THREAD_NOT_FOUND_MESSAGE, ErrorCodes.NOT_FOUND));
        }
        return success(result);
      } catch (err) {
        app.log.error(err);
        return reply
          .code(500)
          .send(error("Failed to get thread", ErrorCodes.INTERNAL_ERROR));
      }
    },
  );

  app.post<{
    Body: {
        title?: string;
        modelName?: string;
        ragEnabled?: boolean;
      };
  }>(
    "/threads",
    {
      schema: {
        tags: ["Thread"],
        summary: "Create a new thread",
        operationId: "createThread",
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            modelName: { type: "string" },
            ragEnabled: { type: "boolean" },
          },
        },
        response: {
          200: successEnvelope(threadSchema),
          500: errorEnvelope,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.authUser!.id;
        const result = threadService.createThread({
          userId,
          ...request.body,
        });
        return success(result, "Thread created");
      } catch (err) {
        app.log.error(err);
        return reply
          .code(500)
          .send(error("Failed to create thread", ErrorCodes.INTERNAL_ERROR));
      }
    },
  );

  app.patch<{
    Params: { id: string };
    Body: {
        title?: string;
        modelName?: string;
        ragEnabled?: boolean;
      };
  }>(
    "/threads/:id",
    {
      schema: {
        tags: ["Thread"],
        summary: "Update thread",
        operationId: "updateThread",
        params: idParamsSchema,
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            modelName: { type: "string" },
            ragEnabled: { type: "boolean" },
          },
        },
        response: {
          200: successEnvelope(threadSchema),
          404: errorEnvelope,
          500: errorEnvelope,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.authUser!.id;
        const result = threadService.updateThread(
          request.params.id,
          userId,
          request.body,
        );
        if (!result) {
          return reply
            .code(404)
            .send(error(THREAD_NOT_FOUND_MESSAGE, ErrorCodes.NOT_FOUND));
        }
        return success(result, "Thread updated");
      } catch (err) {
        app.log.error(err);
        return reply
          .code(500)
          .send(error("Failed to update thread", ErrorCodes.INTERNAL_ERROR));
      }
    },
  );

  app.post<{
    Params: { id: string };
  }>(
    "/threads/:id/archive",
    {
      schema: {
        tags: ["Thread"],
        summary: "Archive thread",
        operationId: "archiveThread",
        params: idParamsSchema,
        response: {
          200: successEnvelope(threadSchema),
          404: errorEnvelope,
          500: errorEnvelope,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.authUser!.id;
        const result = threadService.archiveThread(request.params.id, userId);
        if (!result) {
          return reply
            .code(404)
            .send(error(THREAD_NOT_FOUND_MESSAGE, ErrorCodes.NOT_FOUND));
        }
        return success(result, "Thread archived");
      } catch (err) {
        app.log.error(err);
        return reply
          .code(500)
          .send(error("Failed to archive thread", ErrorCodes.INTERNAL_ERROR));
      }
    },
  );

  app.post<{
    Params: { id: string };
  }>(
    "/threads/:id/restore",
    {
      schema: {
        tags: ["Thread"],
        summary: "Restore thread",
        operationId: "restoreThread",
        params: idParamsSchema,
        response: {
          200: successEnvelope(threadSchema),
          404: errorEnvelope,
          500: errorEnvelope,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.authUser!.id;
        const result = threadService.restoreThread(request.params.id, userId);
        if (!result) {
          return reply
            .code(404)
            .send(error(THREAD_NOT_FOUND_MESSAGE, ErrorCodes.NOT_FOUND));
        }
        return success(result, "Thread restored");
      } catch (err) {
        app.log.error(err);
        return reply
          .code(500)
          .send(error("Failed to restore thread", ErrorCodes.INTERNAL_ERROR));
      }
    },
  );

  app.delete<{
    Params: { id: string };
  }>(
    "/threads/:id",
    {
      schema: {
        tags: ["Thread"],
        summary: "Delete thread permanently",
        operationId: "deleteThread",
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
        const userId = request.authUser!.id;
        const deleted = threadService.deleteThread(request.params.id, userId);
        if (!deleted) {
          return reply
            .code(404)
            .send(error(THREAD_NOT_FOUND_MESSAGE, ErrorCodes.NOT_FOUND));
        }
        return success({ deleted: true }, "Thread deleted");
      } catch (err) {
        if (isThreadAccessError(err)) {
          return reply
            .code(404)
            .send(error(THREAD_NOT_FOUND_MESSAGE, ErrorCodes.NOT_FOUND));
        }
        app.log.error(err);
        return reply
          .code(500)
          .send(error("Failed to delete thread", ErrorCodes.INTERNAL_ERROR));
      }
    },
  );

  app.get<{
    Params: { id: string };
  }>(
    "/threads/:id/messages",
    {
      schema: {
        tags: ["Thread"],
        summary: "Get thread messages",
        operationId: "getThreadMessages",
        params: idParamsSchema,
        response: {
          200: successEnvelope({
            type: "array",
            items: messageSchema,
          }),
          500: errorEnvelope,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.authUser!.id;
        return success(threadService.getMessages(request.params.id, userId));
      } catch (err) {
        if (isThreadAccessError(err)) {
          return reply
            .code(404)
            .send(error(THREAD_NOT_FOUND_MESSAGE, ErrorCodes.NOT_FOUND));
        }
        app.log.error(err);
        return reply
          .code(500)
          .send(error("Failed to get messages", ErrorCodes.INTERNAL_ERROR));
      }
    },
  );

  app.post<{
    Params: { id: string };
    Body: {
      role: "user" | "assistant" | "system";
      content: string;
      metadata?: Record<string, unknown>;
    };
  }>(
    "/threads/:id/messages",
    {
      schema: {
        tags: ["Thread"],
        summary: "Create a message in thread",
        operationId: "createMessage",
        params: idParamsSchema,
        body: {
          type: "object",
          required: ["role", "content"],
          additionalProperties: false,
          properties: {
            role: { type: "string", enum: MESSAGE_ROLE_VALUES },
            content: {
              type: "string",
              minLength: 1,
              maxLength: MAX_MESSAGE_CONTENT_LENGTH,
              description: `Maximum content length is ${MAX_MESSAGE_CONTENT_LENGTH} characters`,
            },
            metadata: {
              type: "object",
              additionalProperties: true,
            },
          },
        },
        response: {
          200: successEnvelope(messageSchema),
          400: errorEnvelope,
          500: errorEnvelope,
        },
      },
    },
    async (request, reply) => {
      try {
        // 验证消息内容长度
        if (request.body.content.length > MAX_MESSAGE_CONTENT_LENGTH) {
          return reply
            .code(400)
            .send(
              error(
                `Message content exceeds maximum length of ${MAX_MESSAGE_CONTENT_LENGTH} characters`,
                ErrorCodes.VALIDATION_ERROR,
              ),
            );
        }

        const userId = request.authUser!.id;
        const result = threadService.createMessage(
          request.params.id,
          userId,
          request.body,
        );
        return success(result, "Message created");
      } catch (err) {
        app.log.error(err);
        return reply
          .code(500)
          .send(error("Failed to create message", ErrorCodes.INTERNAL_ERROR));
      }
    },
  );

  app.delete<{
    Params: { id: string };
  }>(
    "/messages/:id",
    {
      schema: {
        tags: ["Thread"],
        summary: "Delete a message",
        operationId: "deleteMessage",
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
        const userId = request.authUser!.id;
        const deleted = threadService.deleteMessage(request.params.id, userId);
        if (!deleted) {
          return reply
            .code(404)
            .send(error("Message not found", ErrorCodes.NOT_FOUND));
        }
        return success({ deleted: true }, "Message deleted");
      } catch (err) {
        app.log.error(err);
        return reply
          .code(500)
          .send(error("Failed to delete message", ErrorCodes.INTERNAL_ERROR));
      }
    },
  );
};

export default threadRoute;
