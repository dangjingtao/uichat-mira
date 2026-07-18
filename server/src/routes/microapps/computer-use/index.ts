import type { FastifyPluginAsync } from "fastify";
import {
  ComputerUseApprovalRequiredError,
  ComputerUseRequestValidationError,
  ComputerUseRuntimeUnavailableError,
  ComputerUseTaskNotFoundError,
  type ComputerUseGoalInput,
  type ComputerUseRuntimeState,
  type ComputerUseTask,
} from "@/microapps/computer-use/index.js";
import { success } from "@/utils/index.js";
import {
  badRequest,
  createRouteError,
  notFound,
  routeHandler,
} from "@/utils/route-errors.js";
import { computerUseRouteSchemas } from "./schemas.js";
import type { ComputerUseDebuggerService } from "./debugger-service.js";

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
  installRuntime(request?: { force?: boolean }): Promise<ComputerUseRuntimeState>;
};

export type ComputerUseRouteOptions = {
  computerUseService: ComputerUseRouteService;
  computerUseRuntimeService: ComputerUseRuntimeRouteService;
  computerUseDebuggerService?: ComputerUseDebuggerService;
};

const toTaskResponse = (task: ComputerUseTask) => ({
  taskId: task.id,
  goal: task.goal,
  siteScope: task.siteScope,
  requestedBy: task.requestedBy,
  status: task.status,
  runtime: task.runtime,
  plan: task.plan,
  pendingApproval: task.pendingApproval,
  approvals: task.approvals,
  evidence: task.evidence,
  result: task.result,
  currentStepId: task.currentStepId,
  meta: task.meta,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
  startedAt: task.startedAt,
  completedAt: task.completedAt,
});

const mapComputerUseError = (error: unknown): never => {
  if (error instanceof ComputerUseRequestValidationError) {
    throw badRequest(error.message, { cause: error });
  }

  if (error instanceof ComputerUseTaskNotFoundError) {
    throw notFound(error.message, { cause: error });
  }

  if (error instanceof ComputerUseRuntimeUnavailableError) {
    throw createRouteError({
      statusCode: 409,
      code: "CONFLICT",
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof ComputerUseApprovalRequiredError) {
    throw createRouteError({
      statusCode: 409,
      code: "CONFLICT",
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("http/https") ||
      message.includes("sha-256") ||
      message.includes("managed runtime directory") ||
      message.includes("absolute entry path") ||
      message.includes("executablerelativepath")
    ) {
      throw badRequest(error.message, { cause: error });
    }
  }

  throw error;
};

const computerUseRoutes: FastifyPluginAsync<ComputerUseRouteOptions> = async (
  app,
  options,
) => {
  const { computerUseService, computerUseRuntimeService } = options;
  const { computerUseDebuggerService } = options;

  if (computerUseDebuggerService) {
  app.get(
    "/microapps/computer-use/debugger/status",
    routeHandler("Failed to get Computer Use debugger status", async () =>
      success(computerUseDebuggerService.getStatus()),
    ),
  );

  app.post<{ Body: Parameters<ComputerUseDebuggerService["create"]>[0] }>(
    "/microapps/computer-use/sessions",
    { schema: computerUseRouteSchemas.debuggerCreateSession },
    routeHandler<{ Body: Parameters<ComputerUseDebuggerService["create"]>[0] }>("Failed to create Computer Use browser session", async (request) =>
      success(await computerUseDebuggerService.create(request.body)),
    ),
  );

  app.get<{ Params: { id: string } }>(
    "/microapps/computer-use/sessions/:id",
    { schema: computerUseRouteSchemas.debuggerSession },
    routeHandler<{ Params: { id: string } }>("Failed to get Computer Use browser session", async (request) => {
      const session = computerUseDebuggerService.get(request.params.id);
      if (!session) throw notFound(`Computer Use browser session was not found: ${request.params.id}`);
      return success(session);
    }),
  );

  app.post<{ Params: { id: string } }>(
    "/microapps/computer-use/sessions/:id/observe",
    { schema: computerUseRouteSchemas.debuggerSession },
    routeHandler<{ Params: { id: string } }>("Failed to observe Computer Use browser session", async (request) =>
      success(await computerUseDebuggerService.observe(request.params.id)),
    ),
  );

  app.post<{ Params: { id: string }; Body: Parameters<ComputerUseDebuggerService["act"]>[1] }>(
    "/microapps/computer-use/sessions/:id/action",
    { schema: computerUseRouteSchemas.debuggerAction },
    routeHandler<{ Params: { id: string }; Body: Parameters<ComputerUseDebuggerService["act"]>[1] }>("Failed to act on Computer Use browser session", async (request) =>
      success(await computerUseDebuggerService.act(request.params.id, request.body)),
    ),
  );

  app.post<{ Params: { id: string }; Body: Parameters<ComputerUseDebuggerService["assert"]>[1] }>(
    "/microapps/computer-use/sessions/:id/assert",
    { schema: computerUseRouteSchemas.debuggerAssertion },
    routeHandler<{ Params: { id: string }; Body: Parameters<ComputerUseDebuggerService["assert"]>[1] }>("Failed to assert Computer Use browser session", async (request) =>
      success(await computerUseDebuggerService.assert(request.params.id, request.body)),
    ),
  );

  app.post<{ Params: { id: string } }>(
    "/microapps/computer-use/sessions/:id/stop",
    { schema: computerUseRouteSchemas.debuggerSession },
    routeHandler<{ Params: { id: string } }>("Failed to stop Computer Use browser session", async (request) =>
      success(await computerUseDebuggerService.stop(request.params.id)),
    ),
  );

  app.post<{ Params: { id: string }; Body: { invocationId: string } }>(
    "/microapps/computer-use/sessions/:id/approval",
    { schema: computerUseRouteSchemas.debuggerApproval },
    routeHandler<{ Params: { id: string }; Body: { invocationId: string } }>("Failed to approve Computer Use browser action", async (request) =>
      success(await computerUseDebuggerService!.approve(request.params.id, request.body.invocationId)),
    ),
  );

  app.post<{ Params: { id: string }; Body: { invocationId: string; reason?: string } }>(
    "/microapps/computer-use/sessions/:id/approval/reject",
    { schema: computerUseRouteSchemas.debuggerRejectApproval },
    routeHandler<{ Params: { id: string }; Body: { invocationId: string; reason?: string } }>("Failed to reject Computer Use browser action", async (request) =>
      success(await computerUseDebuggerService!.reject(request.params.id, request.body.invocationId, request.body.reason)),
    ),
  );

  app.get<{ Params: { id: string; artifactId: string } }>(
    "/microapps/computer-use/sessions/:id/artifacts/:artifactId/content",
    { schema: computerUseRouteSchemas.debuggerArtifact },
    routeHandler<{ Params: { id: string; artifactId: string } }>("Failed to read Computer Use browser artifact", async (request, reply) => {
      const artifact = await computerUseDebuggerService.readArtifact(request.params.id, request.params.artifactId);
      reply.header("Cache-Control", "no-store");
      reply.type(artifact.contentType);
      return reply.send(artifact.bytes);
    }),
  );
  }

  app.get(
    "/microapps/computer-use/runtime",
    { schema: computerUseRouteSchemas.getRuntime },
    routeHandler("Failed to get computer use runtime state", async () => {
      try {
        const runtime = await computerUseRuntimeService.getRuntimeState();
        return success(runtime);
      } catch (error) {
        return mapComputerUseError(error);
      }
    }),
  );

  app.post<{ Body: { force?: boolean } }>(
    "/microapps/computer-use/runtime/install",
    { schema: computerUseRouteSchemas.installRuntime },
    routeHandler<{ Body: { force?: boolean } }>("Failed to install computer use runtime", async (request) => {
      try {
        const runtime = await computerUseRuntimeService.installRuntime(
          request.body,
        );
        return success(runtime, "Computer use runtime installed");
      } catch (error) {
        return mapComputerUseError(error);
      }
    }),
  );

  app.post<{
    Body: ComputerUseGoalInput & { autoStart?: boolean };
  }>(
    "/microapps/computer-use/tasks",
    { schema: computerUseRouteSchemas.createTask },
    routeHandler("Failed to create computer use task", async (request) => {
      try {
        const task = await computerUseService.createPlan(request.body);
        const nextTask = request.body.autoStart
          ? await computerUseService.startTask(task.id)
          : task;
        return success(
          toTaskResponse(nextTask),
          request.body.autoStart
            ? "Computer use task created and started"
            : "Computer use task created",
        );
      } catch (error) {
        return mapComputerUseError(error);
      }
    }),
  );

  app.get<{ Params: { id: string } }>(
    "/microapps/computer-use/tasks/:id",
    { schema: computerUseRouteSchemas.getTask },
    routeHandler("Failed to get computer use task", async (request) => {
      try {
        const task = await computerUseService.getTask(request.params.id);
        if (!task) {
          throw new ComputerUseTaskNotFoundError(request.params.id);
        }
        return success(toTaskResponse(task));
      } catch (error) {
        return mapComputerUseError(error);
      }
    }),
  );

  app.post<{ Params: { id: string } }>(
    "/microapps/computer-use/tasks/:id/start",
    { schema: computerUseRouteSchemas.startTask },
    routeHandler("Failed to start computer use task", async (request) => {
      try {
        const task = await computerUseService.startTask(request.params.id);
        return success(toTaskResponse(task), "Computer use task started");
      } catch (error) {
        return mapComputerUseError(error);
      }
    }),
  );

  app.post<{
    Params: { id: string };
    Body: {
      approvalId: string;
      decision: "approved" | "rejected";
      resolvedBy?: string;
      resolutionNote?: string;
    };
  }>(
    "/microapps/computer-use/tasks/:id/approval",
    { schema: computerUseRouteSchemas.resolveApproval },
    routeHandler("Failed to resolve computer use approval", async (request) => {
      try {
        const task = await computerUseService.resolveApproval({
          taskId: request.params.id,
          approvalId: request.body.approvalId,
          decision: request.body.decision,
          resolvedBy: request.body.resolvedBy,
          resolutionNote: request.body.resolutionNote,
        });
        return success(toTaskResponse(task), "Computer use approval resolved");
      } catch (error) {
        return mapComputerUseError(error);
      }
    }),
  );

  app.post<{
    Params: { id: string };
    Body: { reason?: string };
  }>(
    "/microapps/computer-use/tasks/:id/cancel",
    { schema: computerUseRouteSchemas.cancelTask },
    routeHandler("Failed to cancel computer use task", async (request) => {
      try {
        const task = await computerUseService.cancelTask(
          request.params.id,
          request.body?.reason,
        );
        return success(toTaskResponse(task), "Computer use task cancelled");
      } catch (error) {
        return mapComputerUseError(error);
      }
    }),
  );
};

export default computerUseRoutes;
