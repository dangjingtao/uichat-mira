import { afterEach, describe, expect, it, vi } from "vitest";
import { generateService } from "./generate.service.js";
import { providerProxyService } from "@/services/provider-proxy.service/index.js";
import type { RetrievedChunk } from "./retrieve.service.js";

describe("generateService LLM delegation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const chunks: RetrievedChunk[] = [
    {
      chunkId: "chunk-1",
      documentId: "doc-1",
      documentName: "README",
      content: "The answer is in the document.",
      score: 0.9,
    },
  ];

  it("builds RAG prompt messages for streamGenerateText", async () => {
    const streamSpy = vi
      .spyOn(providerProxyService, "streamChatText")
      .mockReturnValue(
        (async function* () {
          yield "ok";
        })(),
      );

    const deltas: string[] = [];
    for await (const delta of generateService.streamGenerateText({
      query: "where is the answer",
      chunks,
      conversationHistory: [{ role: "assistant", content: "previous" }],
    })) {
      deltas.push(delta);
    }

    expect(deltas).toEqual(["ok"]);
    expect(streamSpy).toHaveBeenCalledOnce();
    expect(streamSpy).toHaveBeenCalledWith(
      "default",
      expect.any(Array),
    );
    const messages = streamSpy.mock.calls[0]?.[1] ?? [];
    expect(messages).toHaveLength(4);
    expect(messages[0]).toMatchObject({
      role: "system",
      content: expect.stringContaining("参考文档"),
    });
    expect(messages[1]).toMatchObject({
      role: "system",
      content: expect.stringContaining("[1] README"),
    });
    expect(messages[2]).toMatchObject({
      role: "assistant",
      content: "previous",
    });
    expect(messages[3]).toMatchObject({
      role: "user",
      content: "where is the answer",
      parts: [{ type: "text", text: "where is the answer" }],
    });
  });

  it("prepends thread request context before the RAG guardrail prompt", async () => {
    const streamSpy = vi
      .spyOn(providerProxyService, "streamChatText")
      .mockReturnValue(
        (async function* () {
          yield "rag-answer";
        })(),
      );

    await generateService.generate({
      query: "what happened",
      chunks,
      requestContextMessages: [
        {
          role: "system",
          content: "角色名：Programmer\n\n约束：不要假装运行过代码。",
        },
      ],
    });

    const messages = streamSpy.mock.calls[0]?.[1] ?? [];
    const roleMessage = messages[0];
    const ragMessage = messages[1];
    expect(roleMessage).toMatchObject({
      role: "system",
    });
    expect(roleMessage?.content).toContain("角色名：Programmer");
    expect(ragMessage?.content).toContain("参考文档");
    expect(messages.indexOf(roleMessage!)).toBeLessThan(messages.indexOf(ragMessage!));
  });

  it("keeps role, summary, and RAG guardrail ordering stable", async () => {
    const streamSpy = vi
      .spyOn(providerProxyService, "streamChatText")
      .mockReturnValue(
        (async function* () {
          yield "rag-answer";
        })(),
      );

    await generateService.generate({
      query: "what happened",
      chunks,
      requestContextMessages: [
        {
          role: "system",
          content: "角色名：Programmer\n\n约束：不要假装运行过代码。",
        },
        {
          role: "system",
          content: "线程摘要：\n用户当前正在排查 RAG 接入顺序。",
        },
      ],
    });

    const messages = streamSpy.mock.calls[0]?.[1] ?? [];
    expect(messages[0]?.content).toContain("角色名：Programmer");
    expect(messages[1]?.content).toContain("线程摘要：");
    expect(messages[2]?.content).toContain("你是一个专业的知识库问答助手。");
  });

  it("keeps generate and simpleChat behavior after shared-LLM refactor", async () => {
    const streamSpy = vi
      .spyOn(providerProxyService, "streamChatText")
      .mockReturnValueOnce(
        (async function* () {
          yield "rag-answer";
        })(),
      )
      .mockReturnValueOnce(
        (async function* () {
          yield "chat-answer";
        })(),
      );

    const ragResult = await generateService.generate({
      query: "what happened",
      chunks,
    });
    const chatResult = await generateService.simpleChat("ping", [
      { role: "assistant", content: "pong?" },
    ]);

    expect(ragResult).toEqual({
      answer: "rag-answer",
      sources: chunks,
    });
    expect(chatResult).toBe("chat-answer");
    const ragMessages = streamSpy.mock.calls[0]?.[1] ?? [];
    expect(ragMessages).toHaveLength(3);
    expect(ragMessages[0]).toMatchObject({
      role: "system",
      content: expect.stringContaining("参考文档"),
    });
    expect(ragMessages[1]).toMatchObject({
      role: "system",
      content: expect.stringContaining("[1] README"),
    });
    expect(ragMessages[2]).toMatchObject({
      role: "user",
      content: "what happened",
      parts: [{ type: "text", text: "what happened" }],
    });
    expect(streamSpy.mock.calls[1]).toEqual([
      "default",
      [
        { role: "assistant", content: "pong?" },
        { role: "user", content: "ping" },
      ],
    ]);
  });

  it("records context budget audit in generate node observation", () => {
    vi.spyOn(providerProxyService, "describeChatInvocation").mockReturnValue({
      providerCode: "ollama",
      providerLabel: "Ollama",
      protocol: "ollama",
      operation: "chat",
      endpoint: "http://localhost:11434/api/chat",
      model: "qwen2.5:latest",
      modelConfigId: "cfg-1",
      params: {},
      request: {
        method: "POST",
        url: "http://localhost:11434/api/chat",
        body: {},
      },
    });
    const result = generateService.toNodeResult(
      {
        answer: "rag-answer",
        sources: chunks,
      },
      {
        input: {
          query: "what happened",
          chunks,
          conversationHistory: [
            { role: "assistant", content: "previous answer" },
          ],
        },
      },
    );

    expect(result.observation.details?.contextBudget).toMatchObject({
      policy: "rag-chat",
    });
    expect(result.observation.environment?.context?.contextBudget).toMatchObject({
      policy: "rag-chat",
    });
  });
});
