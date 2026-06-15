import type { FastifyInstance } from "fastify";
import { threadService } from "@/services/thread.service";
import {
  success,
  THREAD_NOT_FOUND_MESSAGE,
} from "@/utils/index.js";
import { notFound, routeHandler } from "@/utils/route-errors.js";
import { isThreadAccessError } from "./access.js";
import { threadRouteSchemas } from "./schemas.js";
import type { ThreadListQuery, ThreadMutationBody } from "./types.js";

export const registerThreadRoutes = async (app: FastifyInstance) => {
  app.get<{ Querystring: ThreadListQuery }>(
    "/threads",
    { schema: threadRouteSchemas.listThreads },
    routeHandler("Failed to list threads", async (request) => {
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
          throw notFound(THREAD_NOT_FOUND_MESSAGE, { cause: err });
        }
        throw err;
      }
    }),
  );

  app.get<{ Params: { id: string } }>(
    "/threads/:id",
    { schema: threadRouteSchemas.getThread },
    routeHandler("Failed to get thread", async (request) => {
      const userId = request.authUser!.id;
      const result = threadService.getThreadById(request.params.id, userId);
      if (!result) {
        throw notFound(THREAD_NOT_FOUND_MESSAGE);
      }
      return success(result);
    }),
  );

  app.post<{ Body: ThreadMutationBody }>(
    "/threads",
    { schema: threadRouteSchemas.createThread },
    routeHandler("Failed to create thread", async (request) => {
      const userId = request.authUser!.id;
      const result = threadService.createThread({
        userId,
        ...request.body,
      });
      return success(result, "Thread created");
    }),
  );

  app.patch<{ Params: { id: string }; Body: ThreadMutationBody }>(
    "/threads/:id",
    { schema: threadRouteSchemas.updateThread },
    routeHandler("Failed to update thread", async (request) => {
      const userId = request.authUser!.id;
      const result = threadService.updateThread(
        request.params.id,
        userId,
        request.body,
      );
      if (!result) {
        throw notFound(THREAD_NOT_FOUND_MESSAGE);
      }
      return success(result, "Thread updated");
    }),
  );

  app.post<{ Params: { id: string } }>(
    "/threads/:id/archive",
    { schema: threadRouteSchemas.archiveThread },
    routeHandler("Failed to archive thread", async (request) => {
      const userId = request.authUser!.id;
      const result = threadService.archiveThread(request.params.id, userId);
      if (!result) {
        throw notFound(THREAD_NOT_FOUND_MESSAGE);
      }
      return success(result, "Thread archived");
    }),
  );

  app.post<{ Params: { id: string } }>(
    "/threads/:id/restore",
    { schema: threadRouteSchemas.restoreThread },
    routeHandler("Failed to restore thread", async (request) => {
      const userId = request.authUser!.id;
      const result = threadService.restoreThread(request.params.id, userId);
      if (!result) {
        throw notFound(THREAD_NOT_FOUND_MESSAGE);
      }
      return success(result, "Thread restored");
    }),
  );

  app.delete<{ Params: { id: string } }>(
    "/threads/:id",
    { schema: threadRouteSchemas.deleteThread },
    routeHandler("Failed to delete thread", async (request) => {
      try {
        const userId = request.authUser!.id;
        const deleted = threadService.deleteThread(request.params.id, userId);
        if (!deleted) {
          throw notFound(THREAD_NOT_FOUND_MESSAGE);
        }
        return success({ deleted: true }, "Thread deleted");
      } catch (err) {
        if (isThreadAccessError(err)) {
          throw notFound(THREAD_NOT_FOUND_MESSAGE, { cause: err });
        }
        throw err;
      }
    }),
  );
};
