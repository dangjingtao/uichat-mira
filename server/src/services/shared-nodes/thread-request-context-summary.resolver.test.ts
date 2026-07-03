import { describe, expect, it } from "vitest";
import { resolveSummaryContext } from "./thread-request-context-summary.resolver.js";

describe("resolveSummaryContext", () => {
  it("returns null when summary is missing or blank", () => {
    expect(
      resolveSummaryContext({
        thread: {
          roleId: null,
          contextSummary: null,
        },
        userId: 1,
      }),
    ).toBeNull();

    expect(
      resolveSummaryContext({
        thread: {
          roleId: null,
          contextSummary: "   ",
        },
        userId: 1,
      }),
    ).toBeNull();
  });

  it("builds one system message from normalized summary content", () => {
    const context = resolveSummaryContext({
      thread: {
        roleId: null,
        contextSummary: "  用户偏好简洁回答，并保持当前调试上下文。  ",
        contextSummaryUpdatedAt: "2026-06-26T00:00:00.000Z",
      },
      userId: 1,
    });

    expect(context?.message).toEqual({
      role: "system",
      content: expect.stringContaining("线程摘要"),
    });
    expect(context?.message?.content).toContain("用户偏好简洁回答，并保持当前调试上下文。");
    expect(context?.executionNode).toEqual({
      nodeId: "request-context-summary-2026-06-26T00:00:00.000Z",
      nodeType: "context",
      phase: "done",
      label: "上下文摘要",
      summary: "已注入线程上下文摘要",
      details: {
        updatedAt: "2026-06-26T00:00:00.000Z",
      },
    });
  });
});
