import { describe, expect, it, vi } from "vitest";
import {
  createExternalExpertService,
  type ExternalExpertRepository,
} from "./index.js";
import type { ExternalExpert } from "@/db/repositories/external-experts.repository.js";
import { WebBridgeInvocationError } from "@/routes/webbridge.js";

const createRepository = (initial?: Partial<ExternalExpert>) => {
  let expert: ExternalExpert = {
    id: "expert-chatgpt",
    userId: 7,
    name: "ChatGPT 专家",
    provider: "chatgpt",
    externalSessionRef: null,
    accountLabel: null,
    status: "unbound",
    createdAt: "2026-07-23T00:00:00.000Z",
    updatedAt: "2026-07-23T00:00:00.000Z",
    ...initial,
  };

  const repository: ExternalExpertRepository = {
    listByUser: vi.fn((userId) => expert.userId === userId ? [expert] : []),
    getById: vi.fn((id, userId) => expert.id === id && expert.userId === userId ? expert : null),
    create: vi.fn((input) => {
      expert = {
        ...expert,
        id: "expert-created",
        userId: input.userId,
        name: input.name,
        provider: input.provider,
      };
      return expert;
    }),
    updateConnection: vi.fn((input) => {
      expert = {
        ...expert,
        accountLabel: input.accountLabel ?? null,
        externalSessionRef: null,
        status: input.status,
      };
      return expert;
    }),
    updateBinding: vi.fn((input) => {
      expert = {
        ...expert,
        accountLabel: input.accountLabel ?? null,
        externalSessionRef: input.externalSessionRef,
        status: input.status,
      };
      return expert;
    }),
    updateStatus: vi.fn((_id, _userId, status) => {
      expert = { ...expert, status };
      return expert;
    }),
  };

  return { repository, getExpert: () => expert };
};

describe("ExternalExpertService.ask", () => {
  it("is unavailable until the user creates a connection in 问策", async () => {
    const { repository } = createRepository();
    const invokeWebBridge = vi.fn();
    const service = createExternalExpertService({ repository, invokeWebBridge });

    expect(service.isAgentAvailable(7)).toBe(false);
    await expect(service.ask({
      userId: 7,
      question: "请给建议。",
    })).rejects.toMatchObject({
      code: "EXPERT_CONNECTION_UNAVAILABLE",
      retryable: true,
      suggestedAction: "打开问策界面并点击创建连接",
    });
    expect(invokeWebBridge).not.toHaveBeenCalled();
  });

  it("uses the internally configured expert and appends bounded Mira context", async () => {
    const { repository } = createRepository();
    const invokeWebBridge = vi.fn(async (input: { tool: string; params: { message?: string } }) =>
      input.tool === "expert.connect"
        ? { tabId: 42, accountLabel: "ChatGPT" }
        : {
            provider: "chatgpt",
            reply: "先验证关键假设。",
            sessionRef: { kind: "conversation_id" as const, value: "conversation-1" },
          },
    );
    const resolveThreadContext = vi.fn(() => "当前任务：评估方案风险。");
    const service = createExternalExpertService({
      repository,
      invokeWebBridge,
      resolveThreadContext,
    });
    await service.connect({ userId: 7, expertId: "expert-chatgpt" });
    expect(service.isAgentAvailable(7)).toBe(true);
    expect(service.isAgentAvailable(8)).toBe(false);

    const result = await service.ask({
      userId: 7,
      question: "请给出一个风险判断。",
      threadId: "thread-1",
    });

    expect(result).toEqual({
      answer: "先验证关键假设。",
      status: "completed",
      latencyMs: expect.any(Number),
    });
    expect(resolveThreadContext).toHaveBeenCalledWith({ userId: 7, threadId: "thread-1" });
    expect(repository.create).not.toHaveBeenCalled();
    expect(invokeWebBridge.mock.calls.map(([call]) => call.tool)).toEqual([
      "expert.connect",
      "expert.send_message",
    ]);
    expect(invokeWebBridge.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        params: expect.objectContaining({
          provider: "chatgpt",
          tabId: 42,
          message: [
            "[Mira consultation context]",
            "当前任务：评估方案风险。",
            "[End Mira consultation context]",
            "",
            "Question:",
            "请给出一个风险判断。",
          ].join("\n"),
        }),
      }),
    );
  });

  it("reuses the current runtime connection without exposing its conversation", async () => {
    const { repository } = createRepository();
    const invokeWebBridge = vi.fn(async (input: { tool: string; params: { message?: string } }) =>
      input.tool === "expert.connect"
        ? { tabId: 42 }
        : {
            reply: "继续建议。",
            sessionRef: { kind: "conversation_id" as const, value: "conversation-1" },
          },
    );
    const service = createExternalExpertService({
      repository,
      invokeWebBridge,
      resolveThreadContext: () => "当前任务背景。",
    });
    await service.connect({ userId: 7, expertId: "expert-chatgpt" });

    await service.ask({
      userId: 7,
      question: "第一问。",
      threadId: "thread-1",
    });
    await service.ask({
      userId: 7,
      question: "第二问。",
      threadId: "thread-1",
    });

    expect(invokeWebBridge.mock.calls.filter(([call]) => call.tool === "expert.connect")).toHaveLength(1);
    expect(invokeWebBridge.mock.calls.filter(([call]) => call.tool === "expert.send_message")).toHaveLength(2);
    expect(invokeWebBridge.mock.calls[1]?.[0].params.message).toContain(
      "[Mira consultation context]",
    );
    expect(invokeWebBridge.mock.calls[2]?.[0].params.message).toBe("第二问。");
  });

  it("does not retry an uncertain send", async () => {
    const { repository } = createRepository();
    const sendError = new WebBridgeInvocationError({
      code: "SEND_NOT_CONFIRMED",
      message: "消息发送状态无法确认",
      retryable: false,
      suggestedAction: "不要自动重发",
    });
    const invokeWebBridge = vi.fn(async (input: { tool: string }) => {
      if (input.tool === "expert.connect") return { tabId: 42 };
      throw sendError;
    });
    const service = createExternalExpertService({ repository, invokeWebBridge });
    await service.connect({ userId: 7, expertId: "expert-chatgpt" });

    await expect(service.ask({
      userId: 7,
      question: "只允许一次发送。",
    })).rejects.toMatchObject({ code: "SEND_NOT_CONFIRMED" });
    expect(invokeWebBridge.mock.calls.filter(([call]) => call.tool === "expert.send_message")).toHaveLength(1);
  });

  it("removes Agent availability when the runtime connection becomes stale", async () => {
    const { repository, getExpert } = createRepository();
    const staleError = new WebBridgeInvocationError({
      code: "CHATGPT_TAB_UNAVAILABLE",
      message: "ChatGPT 标签页已关闭",
      retryable: true,
      suggestedAction: "重新创建连接",
    });
    const invokeWebBridge = vi.fn(async (input: { tool: string }) => {
      if (input.tool === "expert.connect") return { tabId: 42 };
      throw staleError;
    });
    const service = createExternalExpertService({ repository, invokeWebBridge });
    await service.connect({ userId: 7, expertId: "expert-chatgpt" });

    expect(service.isAgentAvailable(7)).toBe(true);
    await expect(service.ask({
      userId: 7,
      question: "检查连接。",
    })).rejects.toBe(staleError);
    expect(service.isAgentAvailable(7)).toBe(false);
    expect(getExpert().status).toBe("expired");

    await expect(service.ask({
      userId: 7,
      question: "不要自动重连。",
    })).rejects.toMatchObject({ code: "EXPERT_CONNECTION_UNAVAILABLE" });
    expect(invokeWebBridge.mock.calls.filter(([call]) => call.tool === "expert.connect")).toHaveLength(1);
    expect(invokeWebBridge.mock.calls.filter(([call]) => call.tool === "expert.send_message")).toHaveLength(1);
  });
});
