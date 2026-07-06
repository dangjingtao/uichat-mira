// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/i18n", () => ({
  default: {
    t: (key: string) => (key === "chat.title.default" ? "新对话" : key),
  },
}));

vi.mock("@/shared/lib/sessionStorage", () => ({
  getSession: vi.fn(() => ({ token: "token-1", user: { username: "alice" } })),
}));

import { generateTitle } from "../chat";

function createSseResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  const data = chunks.map((c) => `data: ${c}`).join("\n\n");
  const bytes = encoder.encode(data);
  let offset = 0;

  return {
    ok: true,
    body: {
      getReader: () => ({
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: bytes })
          .mockResolvedValueOnce({ done: true }),
      }),
    },
  };
}

describe("chat api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("空消息返回默认标题", async () => {
    const result = await generateTitle("");
    expect(result).toBe("新对话");
  });

  it("从 text-delta SSE 中提取标题", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          createSseResponse([
            JSON.stringify({ type: "text-delta", delta: "会议总结" }),
          ]),
        ),
    );

    const result = await generateTitle("讨论项目进度");

    expect(result).toBe("会议总结");
    expect(fetch).toHaveBeenCalledWith(
      "/api/proxy/task/default",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-1",
        }),
      }),
    );
  });

  it("从 OpenAI 风格 SSE 中提取标题", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          createSseResponse([
            JSON.stringify({ choices: [{ delta: { content: "标题" } }] }),
          ]),
        ),
    );

    const result = await generateTitle("hello");

    expect(result).toBe("标题");
  });

  it("fetch 失败时返回默认标题", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );

    const result = await generateTitle("error test");

    expect(result).toBe("新对话");
  });

  it("无响应体时返回默认标题", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: null }));

    const result = await generateTitle("no body");

    expect(result).toBe("新对话");
  });
});
