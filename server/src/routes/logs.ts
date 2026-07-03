import type { FastifyPluginAsync } from "fastify";
import { Readable } from "node:stream";
import { success } from "@/utils/index.js";
import { logFilesService } from "@/services/log-files.service.js";
import {
  buildRuntimeLogSnapshotEvent,
  logStreamService,
} from "@/services/log-stream.service.js";
import { errorEnvelope, successEnvelope } from "@/routes/schema-helpers.js";
import { routeHandler } from "@/utils/route-errors.js";

const DEFAULT_LOG_STREAM_LIMIT = 100;

const logsRoute: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { limit?: number } }>(
    "/logs/stream",
    {
      schema: {
        tags: ["System"],
        summary: "Stream backend runtime logs",
        operationId: "streamBackendLogs",
        querystring: {
          type: "object",
          properties: {
            limit: {
              type: "integer",
              minimum: 1,
              maximum: DEFAULT_LOG_STREAM_LIMIT,
            },
          },
        },
      },
    },
    routeHandler("Failed to stream backend logs", async (request, reply) => {
      reply
        .header("Content-Type", "text/event-stream")
        .header("Cache-Control", "no-cache, no-transform")
        .header("Connection", "keep-alive");

      const stream = Readable.from(
        (async function* () {
          const queue: string[] = [];
          const preSnapshotQueue: string[] = [];
          let resolvePending: (() => void) | null = null;
          let snapshotSent = false;

          const unsubscribe = logStreamService.subscribe((event) => {
            const serialized = `data: ${JSON.stringify(event)}\n\n`;
            if (!snapshotSent) {
              preSnapshotQueue.push(serialized);
              return;
            }

            queue.push(serialized);
            resolvePending?.();
            resolvePending = null;
          });

          try {
            yield `data: ${JSON.stringify(
              await buildRuntimeLogSnapshotEvent(
                request.query.limit ?? DEFAULT_LOG_STREAM_LIMIT,
              ),
            )}\n\n`;
            snapshotSent = true;

            while (preSnapshotQueue.length > 0) {
              yield preSnapshotQueue.shift()!;
            }

            while (true) {
              while (queue.length > 0) {
                yield queue.shift()!;
              }

              await new Promise<void>((resolve) => {
                resolvePending = resolve;
              });
            }
          } finally {
            unsubscribe();
          }
        })(),
      );

      request.raw.on("close", () => {
        stream.destroy();
      });

      return reply.send(stream);
    }),
  );

  app.get(
    "/logs/export",
    {
      schema: {
        tags: ["System"],
        summary: "Export backend logs as a zip archive",
        operationId: "exportBackendLogs",
      },
    },
    routeHandler("Failed to export backend logs", async (_request, reply) => {
      const archive = await logFilesService.exportLogsArchive();
      return reply
        .header("Content-Type", "application/zip")
        .header(
          "Content-Disposition",
          `attachment; filename="${archive.fileName}"`,
        )
        .send(archive.buffer);
    }),
  );

  app.delete(
    "/logs",
    {
      schema: {
        tags: ["System"],
        summary: "Clear backend log files",
        operationId: "clearBackendLogs",
        response: {
          200: successEnvelope({
            type: "object",
            required: ["directory", "clearedFiles"],
            properties: {
              directory: { type: "string" },
              clearedFiles: {
                type: "array",
                items: {
                  type: "object",
                  required: ["name", "previousSize"],
                  properties: {
                    name: { type: "string" },
                    previousSize: { type: "number" },
                  },
                },
              },
            },
          }),
          500: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to clear backend logs", async () => {
      const result = await logFilesService.clearLogs();
      return success(result, "Backend logs cleared");
    }),
  );
};

export default logsRoute;
