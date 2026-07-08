import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "@/db/auth.db.js";
import type { createMailCenterService } from "@/microapps/mail-center/index.js";
import type { createNewsHubService } from "@/microapps/news-hub/index.js";
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
  ComfyUiStudioNotFoundError,
  ComfyUiStudioValidationError,
  type ComfyUiConnection,
  type ComfyUiFlow,
  type ImageGenerationCreateRequest,
  type ImageGenerationJob,
} from "@/microapps/image-generation/index.js";
import { success } from "@/utils/index.js";
import { badRequest, notFound, routeHandler } from "@/utils/route-errors.js";
import computerUseRoutes from "./computer-use/index.js";
import mailCenterRoutes from "./mail-center/index.js";
import newsHubRoutes from "./news-hub/index.js";
import { imageGenerationRouteSchemas } from "./schemas.js";

export type ImageGenerationRouteService = {
  createGeneration(request: ImageGenerationCreateRequest): Promise<ImageGenerationJob>;
  getGeneration(jobId: string): Promise<ImageGenerationJob | null>;
  refreshGeneration?(jobId: string): Promise<ImageGenerationJob>;
};

export type ComfyUiStudioRouteService = {
  listConnections(): ComfyUiConnection[];
  createConnection(input: { baseUrl: string; clientId?: string }): ComfyUiConnection;
  updateConnection(
    id: string,
    input: { baseUrl: string; clientId?: string },
  ): ComfyUiConnection;
  testConnection(id: string): Promise<ComfyUiConnection>;
  listFlows(): ComfyUiFlow[];
  createFlow(input: {
    connectionId?: string | null;
    name: string;
    note?: string;
    source?: "template" | "upload" | "manual";
    workflowApiJson: string;
    mapping?: {
      promptPath?: string;
      seedPath?: string;
      widthPath?: string;
      heightPath?: string;
      outputNodeId?: string;
      previewNodeId?: string;
    };
  }): ComfyUiFlow;
  updateFlow(
    id: string,
    input: {
      connectionId?: string | null;
      name: string;
      note?: string;
      source?: "template" | "upload" | "manual";
      workflowApiJson: string;
      mapping?: {
        promptPath?: string;
        seedPath?: string;
        widthPath?: string;
        heightPath?: string;
        outputNodeId?: string;
        previewNodeId?: string;
      };
    },
  ): ComfyUiFlow;
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
export type NewsHubRouteService = ReturnType<typeof createNewsHubService>;

type MicroappsRouteOptions = {
  imageGenerationService?: ImageGenerationRouteService;
  comfyUiStudioService?: ComfyUiStudioRouteService;
  computerUseService?: ComputerUseRouteService;
  computerUseRuntimeService?: ComputerUseRuntimeRouteService;
  mailCenterService?: MailCenterRouteService;
  newsHubService?: NewsHubRouteService;
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

const toComfyUiConnectionResponse = (connection: ComfyUiConnection) => ({
  id: connection.id,
  baseUrl: connection.baseUrl,
  clientId: connection.clientId,
  status: connection.status,
  lastError: connection.lastError,
  lastCheckedAt: connection.lastCheckedAt,
  createdAt: connection.createdAt,
  updatedAt: connection.updatedAt,
});

const toComfyUiFlowResponse = (flow: ComfyUiFlow) => ({
  id: flow.id,
  connectionId: flow.connectionId,
  name: flow.name,
  note: flow.note,
  source: flow.source,
  workflowApiJson: flow.workflowApiJson,
  mapping: flow.mapping,
  createdAt: flow.createdAt,
  updatedAt: flow.updatedAt,
});

const mapImageGenerationError = (error: unknown): never => {
  if (
    error instanceof ImageGenerationProviderNotFoundError ||
    error instanceof ImageGenerationRequestValidationError ||
    error instanceof ComfyUiStudioValidationError
  ) {
    throw badRequest(error.message, { cause: error });
  }

  if (
    error instanceof ImageGenerationJobNotFoundError ||
    error instanceof ComfyUiStudioNotFoundError
  ) {
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
  const comfyUiStudioService = options.comfyUiStudioService;
  const computerUseService = options.computerUseService;
  const computerUseRuntimeService = options.computerUseRuntimeService;
  const mailCenterService = options.mailCenterService;
  const newsHubService = options.newsHubService;
  if (!imageGenerationService) {
    throw new Error(
      "microappsRoute requires imageGenerationService to be injected from the server composition root.",
    );
  }
  if (!comfyUiStudioService) {
    throw new Error(
      "microappsRoute requires comfyUiStudioService to be injected from the server composition root.",
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
  if (!newsHubService) {
    throw new Error(
      "microappsRoute requires newsHubService to be injected from the server composition root.",
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

  app.get(
    "/microapps/image-generation/comfyui/connections",
    { schema: imageGenerationRouteSchemas.listComfyUiConnections },
    routeHandler("Failed to list ComfyUI connections", async () =>
      success(
        comfyUiStudioService.listConnections().map(toComfyUiConnectionResponse),
      )),
  );

  app.post<{ Body: { baseUrl: string; clientId?: string } }>(
    "/microapps/image-generation/comfyui/connections",
    { schema: imageGenerationRouteSchemas.createComfyUiConnection },
    routeHandler("Failed to create ComfyUI connection", async (request) =>
      success(
        toComfyUiConnectionResponse(
          comfyUiStudioService.createConnection(request.body),
        ),
        "ComfyUI connection created",
      )),
  );

  app.patch<{
    Params: { id: string };
    Body: { baseUrl: string; clientId?: string };
  }>(
    "/microapps/image-generation/comfyui/connections/:id",
    { schema: imageGenerationRouteSchemas.updateComfyUiConnection },
    routeHandler("Failed to update ComfyUI connection", async (request) =>
      success(
        toComfyUiConnectionResponse(
          comfyUiStudioService.updateConnection(request.params.id, request.body),
        ),
        "ComfyUI connection updated",
      )),
  );

  app.post<{ Params: { id: string } }>(
    "/microapps/image-generation/comfyui/connections/:id/test",
    { schema: imageGenerationRouteSchemas.testComfyUiConnection },
    routeHandler("Failed to test ComfyUI connection", async (request) =>
      success(
        toComfyUiConnectionResponse(
          await comfyUiStudioService.testConnection(request.params.id),
        ),
        "ComfyUI connection tested",
      )),
  );

  app.get(
    "/microapps/image-generation/comfyui/flows",
    { schema: imageGenerationRouteSchemas.listComfyUiFlows },
    routeHandler("Failed to list ComfyUI flows", async () =>
      success(comfyUiStudioService.listFlows().map(toComfyUiFlowResponse))),
  );

  app.post<{
    Body: {
      connectionId?: string | null;
      name: string;
      note?: string;
      source?: "template" | "upload" | "manual";
      workflowApiJson: string;
      mapping?: {
        promptPath?: string;
        seedPath?: string;
        widthPath?: string;
        heightPath?: string;
        outputNodeId?: string;
        previewNodeId?: string;
      };
    };
  }>(
    "/microapps/image-generation/comfyui/flows",
    { schema: imageGenerationRouteSchemas.createComfyUiFlow },
    routeHandler("Failed to create ComfyUI flow", async (request) =>
      success(
        toComfyUiFlowResponse(comfyUiStudioService.createFlow(request.body)),
        "ComfyUI flow created",
      )),
  );

  app.patch<{
    Params: { id: string };
    Body: {
      connectionId?: string | null;
      name: string;
      note?: string;
      source?: "template" | "upload" | "manual";
      workflowApiJson: string;
      mapping?: {
        promptPath?: string;
        seedPath?: string;
        widthPath?: string;
        heightPath?: string;
        outputNodeId?: string;
        previewNodeId?: string;
      };
    };
  }>(
    "/microapps/image-generation/comfyui/flows/:id",
    { schema: imageGenerationRouteSchemas.updateComfyUiFlow },
    routeHandler("Failed to update ComfyUI flow", async (request) =>
      success(
        toComfyUiFlowResponse(
          comfyUiStudioService.updateFlow(request.params.id, request.body),
        ),
        "ComfyUI flow updated",
      )),
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
  await app.register(newsHubRoutes, {
    newsHubService,
  });
};

export default microappsRoute;
