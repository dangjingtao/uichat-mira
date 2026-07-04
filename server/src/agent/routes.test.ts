import assert from "node:assert/strict";
import Fastify from "fastify";
import { afterEach, describe, expect, test, vi } from "vitest";
import { getLoggerConfig } from "@/logger";
import { sendRouteError } from "@/utils/route-errors.js";
import agentRoute from "./routes.js";
import { agentRunStore } from "./run-store.js";
import { createAgentGoal, createAgentPlan } from "./nodes.js";
import * as resumeModule from "./resume.js";
import * as messagePersistenceModule from "@/routes/proxy-provider/message-persistence.js";
import { threadService } from "@/services/thread.service.js";

const requireAuthMock = vi.hoisted(() =>
  vi.fn(async (request: { authUser?: unknown }) => {
    request.authUser = {
      id: 1,
      username: "owner",
      role: "user",
    };
  }),
);

vi.mock("@/db/auth.db.js", () => ({
  requireAuth: requireAuthMock,
}));

const createRun = () => {
  const goal = createAgentGoal("answer the user");
  return agentRunStore.create({
    threadId: "thread-1",
    userId: 1,
    goal,
    plan: createAgentPlan(goal),
  });
};

describe("agent routes", () => {
  afterEach(() => {
    agentRunStore.clear();
    requireAuthMock.mockClear();
  });

  test("returns and updates runs", async () => {
    const resumeSpy = vi
      .spyOn(resumeModule, "resumeApprovedAgentRun")
      .mockResolvedValue({
        run: {
          ...createRun(),
          status: "completed",
        },
        output: {
          answer: "resumed answer",
          observations: [],
          evidence: {
            observations: [],
            toolExecutions: [],
            retrievals: [],
          },
          retrievedChunks: [],
          status: "completed",
        },
      } as never);

    const app = Fastify({
      logger: getLoggerConfig(),
      serializerOpts: { encoding: "utf8" },
    });
    app.setErrorHandler(sendRouteError);
    await app.register(agentRoute);

    const run = createRun();
    agentRunStore.update(run.id, {
      status: "waiting_approval",
      pendingApproval: {
        id: "approval-1",
        runId: run.id,
        stepId: "approval",
        toolId: "terminal_session",
        reason: "Needs approval",
        createdAt: new Date().toISOString(),
      },
    });

    const getResponse = await app.inject({
      method: "GET",
      url: `/agent/runs/${run.id}`,
    });
    expect(getResponse.statusCode).toBe(200);
    const getBody = getResponse.json() as { data: { id: string; selectedCapabilityId?: string } };
    expect(getBody.data.id).toBe(run.id);
    expect(getBody.data.selectedCapabilityId).toBeUndefined();

    const approveResponse = await app.inject({
      method: "POST",
      url: `/agent/runs/${run.id}/approve`,
      payload: {},
    });
    expect(approveResponse.statusCode).toBe(200);
    expect(resumeSpy).toHaveBeenCalledWith(run.id);

    const rejectResponse = await app.inject({
      method: "POST",
      url: `/agent/runs/${run.id}/reject`,
    });
    expect(rejectResponse.statusCode).toBe(200);
    expect(
      (rejectResponse.json() as { data: { status: string } }).data.status,
    ).toBe("blocked");
    expect(
      (rejectResponse.json() as { data: { currentStepId?: string } }).data.currentStepId,
    ).toBeUndefined();

    const cancelResponse = await app.inject({
      method: "POST",
      url: `/agent/runs/${run.id}/cancel`,
    });
    expect(cancelResponse.statusCode).toBe(200);
    expect(
      (cancelResponse.json() as { data: { status: string } }).data.status,
    ).toBe("cancelled");
    expect(
      (cancelResponse.json() as { data: { currentStepId?: string } }).data.currentStepId,
    ).toBeUndefined();

    await app.close();
    resumeSpy.mockRestore();
  });

  test("returns 404 for unknown runs", async () => {
    const app = Fastify({
      logger: getLoggerConfig(),
      serializerOpts: { encoding: "utf8" },
    });
    app.setErrorHandler(sendRouteError);
    await app.register(agentRoute);

    const response = await app.inject({
      method: "GET",
      url: "/agent/runs/missing",
    });

    assert.equal(response.statusCode, 404);

    await app.close();
  });

  test("approve is idempotent when run is not waiting approval", async () => {
    const resumeSpy = vi.spyOn(resumeModule, "resumeApprovedAgentRun");
    const app = Fastify({
      logger: getLoggerConfig(),
      serializerOpts: { encoding: "utf8" },
    });
    app.setErrorHandler(sendRouteError);
    await app.register(agentRoute);

    const run = createRun();
    agentRunStore.update(run.id, {
      status: "completed",
      pendingApproval: undefined,
      currentStepId: undefined,
    });

    const response = await app.inject({
      method: "POST",
      url: `/agent/runs/${run.id}/approve`,
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect((response.json() as { data: { status: string } }).data.status).toBe(
      "completed",
    );
    expect(resumeSpy).not.toHaveBeenCalled();

    await app.close();
    resumeSpy.mockRestore();
  });

  test("reject and cancel clear pending approval state", async () => {
    const app = Fastify({
      logger: getLoggerConfig(),
      serializerOpts: { encoding: "utf8" },
    });
    app.setErrorHandler(sendRouteError);
    await app.register(agentRoute);

    const rejectedRun = createRun();
    agentRunStore.update(rejectedRun.id, {
      status: "waiting_approval",
      currentStepId: "approval-step",
      assistantMessageId: "assistant-reject-1",
      assistantParentId: "user-1",
      pendingApproval: {
        id: "approval-reject",
        runId: rejectedRun.id,
        stepId: "approval-step",
        toolId: "terminal_session",
        reason: "Needs approval",
        createdAt: new Date().toISOString(),
      },
    });
    const persistAssistantMessageSpy = vi
      .spyOn(messagePersistenceModule, "persistAssistantMessage")
      .mockImplementation(() => {});
    const getMessageByIdSpy = vi
      .spyOn(threadService, "getMessageById")
      .mockReturnValue({
        id: "assistant-reject-1",
        threadId: "thread-1",
        role: "assistant",
        content: "等待审批",
        parts: [{ type: "text", text: "等待审批" }],
        metadata: {},
        createdAt: "2026-06-28T00:00:00.000Z",
      });

    const rejectResponse = await app.inject({
      method: "POST",
      url: `/agent/runs/${rejectedRun.id}/reject`,
    });
    expect(rejectResponse.statusCode).toBe(200);
    const rejectData = rejectResponse.json() as {
      data: {
        status: string;
        pendingApproval?: unknown;
        pendingToolCall?: unknown;
        currentStepId?: string;
        terminalReason?: string;
      };
    };
    expect(rejectData.data.status).toBe("blocked");
    expect(rejectData.data.pendingApproval).toBeUndefined();
    expect(rejectData.data.pendingToolCall).toBeUndefined();
    expect(rejectData.data.currentStepId).toBeUndefined();
    expect(rejectData.data.terminalReason).toBe("approval_rejected");
    expect(persistAssistantMessageSpy).toHaveBeenCalledWith({
      threadId: "thread-1",
      userId: 1,
      assistantMessageId: "assistant-reject-1",
      parentId: "user-1",
      content: "你已拒绝这次需要审批的工具调用，工具没有执行。",
      parts: [
        {
          type: "text",
          text: "你已拒绝这次需要审批的工具调用，工具没有执行。",
        },
      ],
      metadata: {
        agent: {
          status: "blocked",
          runId: rejectedRun.id,
          traceId: expect.any(String),
          blockedReason: "User rejected the pending approval request.",
          terminalReason: "approval_rejected",
        },
      },
    });

    const cancelledRun = createRun();
    agentRunStore.update(cancelledRun.id, {
      status: "waiting_approval",
      currentStepId: "approval-step",
      pendingApproval: {
        id: "approval-cancel",
        runId: cancelledRun.id,
        stepId: "approval-step",
        toolId: "terminal_session",
        reason: "Needs approval",
        createdAt: new Date().toISOString(),
      },
    });

    const cancelResponse = await app.inject({
      method: "POST",
      url: `/agent/runs/${cancelledRun.id}/cancel`,
    });
    expect(cancelResponse.statusCode).toBe(200);
    const cancelData = cancelResponse.json() as {
      data: {
        status: string;
        pendingApproval?: unknown;
        pendingToolCall?: unknown;
        currentStepId?: string;
        terminalReason?: string;
      };
    };
    expect(cancelData.data.status).toBe("cancelled");
    expect(cancelData.data.pendingApproval).toBeUndefined();
    expect(cancelData.data.pendingToolCall).toBeUndefined();
    expect(cancelData.data.currentStepId).toBeUndefined();
    expect(cancelData.data.terminalReason).toBe("cancelled");
    expect(persistAssistantMessageSpy).toHaveBeenCalledTimes(1);

    await app.close();
    persistAssistantMessageSpy.mockRestore();
    getMessageByIdSpy.mockRestore();
  });

  test("approve returns resumed run state from resume helper", async () => {
    const app = Fastify({
      logger: getLoggerConfig(),
      serializerOpts: { encoding: "utf8" },
    });
    app.setErrorHandler(sendRouteError);
    await app.register(agentRoute);

    const goal = createAgentGoal("answer the user");
    const run = agentRunStore.create({
      threadId: "thread-1",
      userId: 1,
      goal,
      plan: createAgentPlan(goal),
      runtimeInput: {
        messages: [
          {
            role: "user",
            content: "hello",
            parts: [{ type: "text", text: "hello" }],
          },
        ],
        params: {},
      },
    });
    agentRunStore.update(run.id, {
      status: "waiting_approval",
      pendingApproval: {
        id: "approval-route-1",
        runId: run.id,
        stepId: "approval-step",
        toolId: "web_search",
        reason: "Needs approval",
        createdAt: new Date().toISOString(),
      },
    });

    const resumeSpy = vi
      .spyOn(resumeModule, "resumeApprovedAgentRun")
      .mockImplementation(async (runId) => {
        agentRunStore.complete(runId, {
          status: "completed",
          pendingApproval: undefined,
          currentStepId: undefined,
        });
        return {
          run: agentRunStore.get(runId),
          output: {
            answer: "resumed answer",
            observations: [],
            evidence: {
              observations: [],
              toolExecutions: [],
              retrievals: [],
            },
            retrievedChunks: [],
            status: "completed",
          },
        } as never;
      });

    const approveResponse = await app.inject({
      method: "POST",
      url: `/agent/runs/${run.id}/approve`,
      payload: {},
    });

    expect(approveResponse.statusCode).toBe(200);
    expect(resumeSpy).toHaveBeenCalledWith(run.id);
    const approveData = approveResponse.json() as {
      data: { status: string; pendingApproval?: unknown };
    };
    expect(approveData.data.status).toBe("completed");
    expect(approveData.data.pendingApproval).toBeUndefined();

    await app.close();
    resumeSpy.mockRestore();
  });
});
