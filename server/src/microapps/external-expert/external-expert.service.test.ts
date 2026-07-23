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
  it("creates one provider expert, opens a new conversation, and returns high-level advice", async () => {
    const { repository } = createRepository();
    const invokeWebBridge = vi.fn(async (input: { tool: string }) =>
      input.tool === "expert.connect"
        ? { tabId: 42, accountLabel: "ChatGPT" }
        : {
            provider: "chatgpt",
            reply: "先验证关键假设。",
            sessionRef: { kind: "conversation_id" as const, value: "conversation-1" },
          },
    );
    const service = createExternalExpertService({ repository, invokeWebBridge });

    const result = await service.ask({
      userId: 7,
      provider: "chatgpt",
      action: "ask",
      conversation: "new",
      question: "请给出一个风险判断。",
    });

    expect(result).toEqual({
      answer: "先验证关键假设。",
      provider: "chatgpt",
      conversationId: "conversation-1",
      status: "completed",
      latencyMs: expect.any(Number),
    });
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
          message: "请给出一个风险判断。",
        }),
      }),
    );
  });

  it("continues only the currently bound conversation", async () => {
    const { repository } = createRepository({
      externalSessionRef: { kind: "conversation_id", value: "conversation-1" },
      status: "ready",
    });
    const invokeWebBridge = vi.fn(async (input: { tool: string }) =>
      input.tool === "expert.send_message"
        ? { reply: "继续建议。", sessionRef: { kind: "conversation_id" as const, value: "conversation-1" } }
        : { tabId: 42 },
    );
    const service = createExternalExpertService({ repository, invokeWebBridge });

    await expect(service.ask({
      userId: 7,
      provider: "chatgpt",
      action: "continue",
      conversation: { conversationId: "conversation-1" },
      question: "继续分析。",
    })).rejects.toMatchObject({ code: "EXPERT_CONNECTION_UNAVAILABLE" });
    expect(invokeWebBridge).not.toHaveBeenCalled();
  });

  it("rejects a mismatched conversation before touching WebBridge", async () => {
    const { repository } = createRepository({
      externalSessionRef: { kind: "conversation_id", value: "conversation-1" },
      status: "ready",
    });
    const invokeWebBridge = vi.fn();
    const service = createExternalExpertService({ repository, invokeWebBridge });

    await expect(service.ask({
      userId: 7,
      provider: "chatgpt",
      action: "continue",
      conversation: { conversationId: "conversation-other" },
      question: "不要发送。",
    })).rejects.toMatchObject({ code: "CONVERSATION_MISMATCH" });
    expect(invokeWebBridge).not.toHaveBeenCalled();
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

    await expect(service.ask({
      userId: 7,
      provider: "chatgpt",
      action: "new_conversation",
      question: "只允许一次发送。",
    })).rejects.toMatchObject({ code: "SEND_NOT_CONFIRMED" });
    expect(invokeWebBridge.mock.calls.filter(([call]) => call.tool === "expert.send_message")).toHaveLength(1);
  });
});
