import type { FastifyPluginAsync } from "fastify";
import { success } from "@/utils/index.js";
import { errorEnvelope, successEnvelope } from "@/routes/schema-helpers.js";
import { notFound, routeHandler } from "@/utils/route-errors.js";
import { ragRuntimeObserver } from "@/services/rag-runtime-observer.js";
import { ragRunRecordSchema } from "./schemas.js";

const ragRuntimeRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/rag/runs",
    {
      schema: {
        tags: ["Chat"],
        summary: "List recent RAG runtime runs",
        operationId: "listRagRuntimeRuns",
        response: {
          200: successEnvelope({
            type: "array",
            items: ragRunRecordSchema,
          }),
        },
      },
    },
    routeHandler("Failed to list RAG runtime runs", async () =>
      success(ragRuntimeObserver.getRuns()),
    ),
  );

  app.get<{
    Params: {
      runId: string;
    };
  }>(
    "/rag/runs/:runId",
    {
      schema: {
        tags: ["Chat"],
        summary: "Get one RAG runtime run",
        operationId: "getRagRuntimeRun",
        params: {
          type: "object",
          required: ["runId"],
          properties: {
            runId: { type: "string" },
          },
        },
        response: {
          200: successEnvelope(ragRunRecordSchema),
          404: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to get RAG runtime run", async (request) => {
      const run = ragRuntimeObserver.getRun(request.params.runId);
      if (!run) {
        throw notFound(`RAG runtime run "${request.params.runId}" was not found`);
      }
      return success(run);
    }),
  );
};

export default ragRuntimeRoute;
