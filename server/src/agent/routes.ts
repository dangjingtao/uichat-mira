import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { requireAuth } from "@/db/auth.db.js";
import { routeHandler } from "@/utils/route-errors.js";
import { success } from "@/utils/index.js";
import { successEnvelope, errorEnvelope } from "@/routes/schema-helpers.js";
import { agentRunStore } from "./run-store.js";
import { notFound } from "@/utils/route-errors.js";
import type { AgentRun } from "./types.js";
import { resumeApprovedAgentRun } from "./resume.js";
import { getAgentRunById } from "./run-read.js";
import { persistAgentAssistantState } from "./resume.js";

const agentApprovalRequestSchema = {
  type: "object",
  required: ["id", "runId", "stepId", "toolId", "reason", "createdAt"],
  properties: {
    id: { type: "string" },
    runId: { type: "string" },
    stepId: { type: "string" },
    toolId: { type: "string" },
    toolCallId: { type: "string" },
    reason: { type: "string" },
    input: {
      type: "object",
      additionalProperties: true,
    },
    inputHash: { type: "string" },
    createdAt: { type: "string" },
  },
} as const;

const agentRunSchema = {
  type: "object",
  required: [
    "id",
    "threadId",
    "userId",
    "goal",
    "plan",
    "status",
    "observations",
    "traceId",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string" },
    threadId: { type: "string" },
    userId: { type: "number" },
    goal: { type: "object", additionalProperties: true },
    plan: { type: "object", additionalProperties: true },
    status: {
      type: "string",
      enum: ["queued", "running", "waiting_approval", "waiting_user", "completed", "failed", "blocked", "cancelled"],
    },
    observations: {
      type: "array",
      items: { type: "object", additionalProperties: true },
    },
    traceId: { type: "string" },
    currentStepId: { type: "string" },
    blockedReason: { type: "string" },
    terminalReason: { type: "string" },
    pendingApproval: agentApprovalRequestSchema,
    pendingToolCall: {
      type: "object",
      additionalProperties: true,
    },
    selectedToolId: { type: "string" },
    contextBudget: {
      type: "object",
      additionalProperties: true,
    },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
} as const;

type AgentRouteParams = {
  runId: string;
};

const verifyRunOwnership = (run: AgentRun | undefined, userId: number) => {
  if (!run) {
    return null;
  }

  return run.userId === userId ? run : null;
};

const registerAgentRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook("preHandler", requireAuth);

  app.get<{ Params: AgentRouteParams }>(
    "/agent/runs/:runId",
    {
      schema: {
        tags: ["Agent"],
        summary: "Get an agent run",
        operationId: "getAgentRun",
        response: {
          200: successEnvelope(agentRunSchema),
          404: errorEnvelope,
        },
      },
    },
    routeHandler("获取 Agent Run 失败", async (request) => {
      const authUser = request.authUser;
      if (!authUser) {
        throw notFound("Agent run not found");
      }

      const run = getAgentRunById(request.params.runId);
      const visibleRun = verifyRunOwnership(run, authUser.id);
      if (!visibleRun) {
        throw notFound("Agent run not found");
      }

      return success(visibleRun);
    }),
  );

  app.post<{ Params: AgentRouteParams }>(
    "/agent/runs/:runId/approve",
    {
      schema: {
        tags: ["Agent"],
        summary: "Approve a pending agent run",
        operationId: "approveAgentRun",
        response: {
          200: successEnvelope(agentRunSchema),
          404: errorEnvelope,
        },
      },
    },
    routeHandler("审批 Agent Run 失败", async (request) => {
      const authUser = request.authUser;
      if (!authUser) {
        throw notFound("Agent run not found");
      }

      const run = getAgentRunById(request.params.runId);
      const visibleRun = verifyRunOwnership(run, authUser.id);
      if (!visibleRun) {
        throw notFound("Agent run not found");
      }

      if (!visibleRun.pendingApproval) {
        return success(visibleRun);
      }

      const result = await resumeApprovedAgentRun(visibleRun.id);
      return success(result.run ?? visibleRun);
    }),
  );

  app.post<{ Params: AgentRouteParams }>(
    "/agent/runs/:runId/reject",
    {
      schema: {
        tags: ["Agent"],
        summary: "Reject a pending agent run",
        operationId: "rejectAgentRun",
        response: {
          200: successEnvelope(agentRunSchema),
          404: errorEnvelope,
        },
      },
    },
    routeHandler("拒绝 Agent Run 失败", async (request) => {
      const authUser = request.authUser;
      if (!authUser) {
        throw notFound("Agent run not found");
      }

      const run = getAgentRunById(request.params.runId);
      const visibleRun = verifyRunOwnership(run, authUser.id);
      if (!visibleRun) {
        throw notFound("Agent run not found");
      }

      const next = agentRunStore.complete(visibleRun.id, {
        status: "blocked",
        currentStepId: undefined,
        pendingApproval: undefined,
        pendingToolCall: undefined,
        selectedToolId: undefined,
        blockedReason: "User rejected the pending approval request.",
        terminalReason: "approval_rejected",
      });
      persistAgentAssistantState({
        run: next,
        status: "blocked",
        content: "你已拒绝这次需要审批的工具调用，工具没有执行。",
        blockedReason: "User rejected the pending approval request.",
        terminalReason: "approval_rejected",
      });

      return success(next);
    }),
  );

  app.post<{ Params: AgentRouteParams }>(
    "/agent/runs/:runId/cancel",
    {
      schema: {
        tags: ["Agent"],
        summary: "Cancel an agent run",
        operationId: "cancelAgentRun",
        response: {
          200: successEnvelope(agentRunSchema),
          404: errorEnvelope,
        },
      },
    },
    routeHandler("取消 Agent Run 失败", async (request) => {
      const authUser = request.authUser;
      if (!authUser) {
        throw notFound("Agent run not found");
      }

      const run = getAgentRunById(request.params.runId);
      const visibleRun = verifyRunOwnership(run, authUser.id);
      if (!visibleRun) {
        throw notFound("Agent run not found");
      }

      const next = agentRunStore.complete(visibleRun.id, {
        status: "cancelled",
        currentStepId: undefined,
        pendingApproval: undefined,
        pendingToolCall: undefined,
        selectedToolId: undefined,
        terminalReason: "cancelled",
      });

      return success(next);
    }),
  );
};

export default registerAgentRoutes;
