import { afterEach, describe, expect, it, vi } from "vitest";
import * as harnessInvocations from "@/mcp/harness/invocations.js";
import { resolveThreadWebSearchContext } from "./thread-request-context-web-search.resolver.js";

const createLogger = () =>
  ({
    warn: vi.fn(),
  }) as any;

describe("resolveThreadWebSearchContext", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the original context unchanged for non-realtime questions", async () => {
    const initialMessages = [
      {
        role: "system" as const,
        content: "role scaffold",
        parts: [{ type: "text" as const, text: "role scaffold" }],
      },
    ];

    const result = await resolveThreadWebSearchContext({
      question: "帮我总结这段代码风格",
      threadId: "thread-1",
      requestContextMessages: initialMessages,
      log: createLogger(),
    });

    expect(result.requestContextMessages).toBe(initialMessages);
    expect(result.preludeChunks).toEqual([]);
  });

  it("appends request-only search context and emits start/done chunks on success", async () => {
    vi.spyOn(harnessInvocations, "executeHarnessInvocation").mockResolvedValue({
      id: "inv-1",
      toolId: "web_search",
      status: "completed",
      args: { query: "今天是什么时候？" },
      artifacts: [],
      result: {
        query: "今天是什么时候？",
        provider: "tavily",
        results: [
          {
            title: "Today",
            link: "https://example.com/today",
            snippet: "Today is 2026-06-27.",
          },
        ],
      },
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    });

    const result = await resolveThreadWebSearchContext({
      question: "今天是什么时候？",
      threadId: "thread-1",
      requestContextMessages: [],
      log: createLogger(),
    });

    expect(result.preludeChunks).toHaveLength(2);
    expect(result.preludeChunks[0]).toContain('"phase":"start"');
    expect(result.preludeChunks[1]).toContain('"phase":"done"');
    expect(result.requestContextMessages).toHaveLength(1);
    expect(result.requestContextMessages?.[0]?.content).toContain("实时参考信息");
    expect(result.requestContextMessages?.[0]?.content).toContain(
      "Today is 2026-06-27.",
    );
  });

  it("keeps the original request context and emits an error chunk when the tool fails", async () => {
    const initialMessages = [
      {
        role: "system" as const,
        content: "role scaffold",
        parts: [{ type: "text" as const, text: "role scaffold" }],
      },
    ];

    vi.spyOn(harnessInvocations, "executeHarnessInvocation").mockResolvedValue({
      id: "inv-2",
      toolId: "web_search",
      status: "failed",
      args: { query: "今天是什么时候？" },
      artifacts: [],
      error: { message: "provider unavailable" },
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    } as any);

    const result = await resolveThreadWebSearchContext({
      question: "今天是什么时候？",
      threadId: "thread-1",
      requestContextMessages: initialMessages,
      log: createLogger(),
    });

    expect(result.requestContextMessages).toBe(initialMessages);
    expect(result.preludeChunks).toHaveLength(2);
    expect(result.preludeChunks[1]).toContain('"phase":"error"');
    expect(result.preludeChunks[1]).toContain("provider unavailable");
  });

  it("can be forced for shared default-chat prefetch", async () => {
    vi.spyOn(harnessInvocations, "executeHarnessInvocation").mockResolvedValue({
      id: "inv-3",
      toolId: "web_search",
      status: "completed",
      args: { query: "随便问一句" },
      artifacts: [],
      result: {
        query: "随便问一句",
        provider: "tavily",
        results: [],
      },
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    });

    const result = await resolveThreadWebSearchContext({
      question: "随便问一句",
      threadId: "thread-1",
      requestContextMessages: [],
      log: createLogger(),
      force: true,
    });

    expect(result.preludeChunks).toHaveLength(2);
    expect(result.requestContextMessages).toHaveLength(1);
    expect(result.requestContextMessages?.[0]?.content).toContain("实时参考信息");
  });
});
