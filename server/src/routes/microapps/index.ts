import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "@/db/auth.db.js";
import type { createMailCenterService } from "@/microapps/mail-center/index.js";
import type {
  ComputerUseGoalInput,
  ComputerUseRuntimeState,
  ComputerUseTask,
} from "@/microapps/computer-use/index.js";
import type { BrowserRuntimeDownloadRequest } from "@/microapps/computer-use/runtime/types.js";
import {
  ImageGenerationJobNotFoundError,
  ImageGenerationProviderNotFoundError,
  ImageGenerationRequestValidationError,
  type ImageGenerationCreateRequest,
  type ImageGenerationJob,
} from "@/microapps/image-generation/index.js";
import { success } from "@/utils/index.js";
import { badRequest, notFound, routeHandler } from "@/utils/route-errors.js";
import computerUseRoutes from "./computer-use/index.js";
import mailCenterRoutes from "./mail-center/index.js";
import { imageGenerationRouteSchemas } from "./schemas.js";

export type ImageGenerationRouteService = {
  createGeneration(request: ImageGenerationCreateRequest): Promise<ImageGenerationJob>;
  getGeneration(jobId: string): Promise<ImageGenerationJob | null>;
  refreshGeneration?(jobId: string): Promise<ImageGenerationJob>;
};

export type ComputerUseRouteService = {
  createPlan(input: ComputerUseGoalInput): Promise<ComputerUseTask>;
  getTask(taskId: string): Promise<ComputerUseTask | null>;
  startTask(taskId: string): Promise<ComputerUseTask>;
  resolveApproval(input: {
    taskId: string;
    approvalId: string;
    decision: "approved" | "rejected";
    resolvedBy?: string;
    resolutionNote?: string;
  }): Promise<ComputerUseTask>;
  cancelTask(taskId: string, reason?: string): Promise<ComputerUseTask>;
};

export type ComputerUseRuntimeRouteService = {
  getRuntimeState(): Promise<ComputerUseRuntimeState>;
  installRuntime(
    request: BrowserRuntimeDownloadRequest,
  ): Promise<ComputerUseRuntimeState>;
};

export type MailCenterRouteService = ReturnType<typeof createMailCenterService>;

type MicroappsRouteOptions = {
  imageGenerationService?: ImageGenerationRouteService;
  computerUseService?: ComputerUseRouteService;
  computerUseRuntimeService?: ComputerUseRuntimeRouteService;
  mailCenterService?: MailCenterRouteService;
};

const toGenerationResponse = (job: ImageGenerationJob) => ({
  generationId: job.id,
  status: job.status,
  executionKind: job.executionKind,
  artifacts: job.artifacts,
  requestSummary: job.requestSummary,
  providerJobId: job.providerJobId,
  error: job.error,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
  startedAt: job.startedAt,
  completedAt: job.completedAt,
  meta: job.meta,
});

const mapImageGenerationError = (error: unknown): never => {
  if (
    error instanceof ImageGenerationProviderNotFoundError ||
    error instanceof ImageGenerationRequestValidationError
  ) {
    throw badRequest(error.message, { cause: error });
  }

  if (error instanceof ImageGenerationJobNotFoundError) {
    throw notFound(error.message, { cause: error });
  }

  throw error;
};

const microappsRoute: FastifyPluginAsync<MicroappsRouteOptions> = async (
  app,
  options,
) => {
  app.addHook("preHandler", requireAuth);

  const imageGenerationService = options.imageGenerationService;
  const computerUseService = options.computerUseService;
  const computerUseRuntimeService = options.computerUseRuntimeService;
  const mailCenterService = options.mailCenterService;
  if (!imageGenerationService) {
    throw new Error(
      "microappsRoute requires imageGenerationService to be injected from the server composition root.",
    );
  }
  if (!computerUseService) {
    throw new Error(
      "microappsRoute requires computerUseService to be injected from the server composition root.",
    );
  }
  if (!computerUseRuntimeService) {
    throw new Error(
      "microappsRoute requires computerUseRuntimeService to be injected from the server composition root.",
    );
  }
  if (!mailCenterService) {
    throw new Error(
      "microappsRoute requires mailCenterService to be injected from the server composition root.",
    );
  }

  app.post<{ Body: ImageGenerationCreateRequest }>(
    "/microapps/image-generation/generations",
    { schema: imageGenerationRouteSchemas.createGeneration },
    routeHandler("Failed to create image generation job", async (request) => {
      try {
        const job = await imageGenerationService.createGeneration(request.body);
        return success(toGenerationResponse(job), "Image generation job created");
      } catch (error) {
        return mapImageGenerationError(error);
      }
    }),
  );

  app.get<{
    Params: { id: string };
    Querystring: { refresh?: "true" | "false" };
  }>(
    "/microapps/image-generation/generations/:id",
    { schema: imageGenerationRouteSchemas.getGeneration },
    routeHandler("Failed to get image generation job", async (request) => {
      try {
        const job =
          request.query.refresh === "true" &&
          imageGenerationService.refreshGeneration
            ? await imageGenerationService.refreshGeneration(request.params.id)
            : await imageGenerationService.getGeneration(request.params.id);

        if (!job) {
          throw new ImageGenerationJobNotFoundError(request.params.id);
        }

        return success(toGenerationResponse(job));
      } catch (error) {
        return mapImageGenerationError(error);
      }
    }),
  );

  await app.register(computerUseRoutes, {
    computerUseService,
    computerUseRuntimeService,
  });
  await app.register(mailCenterRoutes, {
    mailCenterService,
  });
};

export default microappsRoute;
