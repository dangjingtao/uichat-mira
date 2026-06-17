import type { FastifyPluginAsync } from "fastify";
import { success } from "@/utils/index.js";
import {
  badRequest,
  createRouteError,
  notFound,
  routeHandler,
} from "@/utils/route-errors.js";
import { evaluationService } from "@/services/evaluation.service.js";
import { evaluationPackageGeneratorService } from "@/services/evaluation-package-generator.service.js";
import {
  EvaluationMultipartValidationError,
  isMultipartTooLargeError,
  readSingleZipUpload,
} from "./multipart.js";
import { evaluationRouteSchemas } from "./schemas.js";
import type {
  CreateEvaluationRunBody,
  GenerateEvaluationPackageBody,
  EvaluationRunListQuery,
} from "./types.js";

const evaluationRoute: FastifyPluginAsync = async (app) => {
  app.post<{ Body: GenerateEvaluationPackageBody }>(
    "/evaluation/packages/generate",
    { schema: evaluationRouteSchemas.generatePackage },
    routeHandler(
      "Failed to generate evaluation package",
      async (request, reply) => {
        const archive = await evaluationPackageGeneratorService.generateArchive(
          request.body,
        );
        return reply
          .header("Content-Type", "application/zip")
          .header(
            "Content-Disposition",
            `attachment; filename="${archive.fileName}"`,
          )
          .send(archive.buffer);
      },
    ),
  );

  app.post(
    "/evaluation/datasets/parse",
    { schema: evaluationRouteSchemas.parseDataset },
    routeHandler("Failed to parse evaluation dataset", async (request) => {
      try {
        const upload = await readSingleZipUpload(request);
        const dataset = evaluationService.parseDataset(upload);
        return success(dataset, "Evaluation dataset parsed");
      } catch (err) {
        if (err instanceof EvaluationMultipartValidationError) {
          throw badRequest(err.message, { cause: err });
        }

        if (isMultipartTooLargeError(err)) {
          throw createRouteError({
            statusCode: 413,
            code: "UPLOAD_TOO_LARGE",
            message: "Uploaded evaluation package exceeds the size limit",
            cause: err,
            logMessage: "Evaluation upload exceeds size limit",
          });
        }

        if (err instanceof SyntaxError) {
          throw badRequest("Invalid JSON found in the evaluation package", {
            cause: err,
          });
        }

        if (err instanceof Error) {
          throw badRequest(err.message, { cause: err });
        }

        throw err;
      }
    }),
  );

  app.get<{ Querystring: EvaluationRunListQuery }>(
    "/evaluation/runs",
    { schema: evaluationRouteSchemas.listRuns },
    routeHandler("Failed to list evaluation runs", async (request) =>
      success(evaluationService.listRuns(request.query)),
    ),
  );

  app.get<{ Params: { runId: string } }>(
    "/evaluation/runs/:runId",
    { schema: evaluationRouteSchemas.getRun },
    routeHandler("Failed to get evaluation run", async (request) => {
      const run = evaluationService.getRun(request.params.runId);
      if (!run) {
        throw notFound(
          `Evaluation run "${request.params.runId}" was not found`,
        );
      }
      return success(run);
    }),
  );

  app.delete<{ Params: { runId: string } }>(
    "/evaluation/runs/:runId",
    { schema: evaluationRouteSchemas.deleteRun },
    routeHandler("Failed to delete evaluation run", async (request) =>
      success(
        evaluationService.deleteRun(request.params.runId),
        "Evaluation run deleted",
      ),
    ),
  );

  app.post<{ Body: CreateEvaluationRunBody }>(
    "/evaluation/runs",
    { schema: evaluationRouteSchemas.createRun },
    routeHandler("Failed to create evaluation run", async (request) =>
      success(
        evaluationService.createRun(request.body),
        "Evaluation run created",
      ),
    ),
  );
};

export default evaluationRoute;
