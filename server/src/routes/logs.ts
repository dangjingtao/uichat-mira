import type { FastifyPluginAsync } from "fastify";
import { success } from "@/utils/index.js";
import { logFilesService } from "@/services/log-files.service.js";
import { errorEnvelope, successEnvelope } from "@/routes/schema-helpers.js";
import { createRouteError, routeHandler } from "@/utils/route-errors.js";

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
