import type { FastifyPluginAsync } from "fastify";
import { error, success } from "@/utils/index.js";
import { logFilesService } from "@/services/log-files.service.js";
import { errorEnvelope, successEnvelope } from "@/routes/schema-helpers.js";

const logsRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/logs/export",
    {
      schema: {
        tags: ["System"],
        summary: "Export backend logs as a zip archive",
        operationId: "exportBackendLogs",
      },
    },
    async (_request, reply) => {
      try {
        const archive = await logFilesService.exportLogsArchive();
        return reply
          .header("Content-Type", "application/zip")
          .header(
            "Content-Disposition",
            `attachment; filename="${archive.fileName}"`,
          )
          .send(archive.buffer);
      } catch (routeError) {
        app.log.error({ err: routeError as Error }, "Failed to export logs");
        return reply
          .code(500)
          .send(error("Failed to export backend logs", "LOG_EXPORT_FAILED"));
      }
    },
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
    async (_request, reply) => {
      try {
        const result = await logFilesService.clearLogs();
        return reply.send(success(result, "Backend logs cleared"));
      } catch (routeError) {
        app.log.error({ err: routeError as Error }, "Failed to clear logs");
        return reply
          .code(500)
          .send(error("Failed to clear backend logs", "LOG_CLEAR_FAILED"));
      }
    },
  );
};

export default logsRoute;
