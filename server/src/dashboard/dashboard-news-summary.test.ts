import { afterEach, describe, expect, it, vi } from "vitest";
import { collectTaskModelText } from "@/services/task-model.service.js";
import { getDashboardNews, resetDashboardNewsSummaryCache } from "./dashboard-service.js";

vi.mock("@/services/task-model.service.js", () => ({
  collectTaskModelText: vi.fn(),
}));

const newsHubService = {
  getOverview: vi.fn(async () => ({
    sources: [],
    total: 1,
    generatedAt: "2026-07-28T03:00:00.000Z",
    items: [{
      title: "Original title",
      summary: "Original summary",
      contentText: "Original content",
      topic: "AI",
      sourceName: "NewsHub",
      url: "https://example.com/news",
      publishedAt: "2026-07-28T02:00:00.000Z",
      ingestedAt: "2026-07-28T02:00:00.000Z",
    }],
  })),
} as never;

describe("dashboard news summaries", () => {
  afterEach(() => {
    vi.mocked(collectTaskModelText).mockReset();
    resetDashboardNewsSummaryCache();
  });

  it("summarizes NewsHub items and caches the result for six hours", async () => {
    vi.mocked(collectTaskModelText).mockResolvedValue("```json\n{" +
      "\"items\":[{\"summary\":\"AI 领域出现新的产品进展。\",\"category\":\"AI\"}]}\n```" );
    const firstRequest = new Date("2026-07-28T03:00:00.000Z");

    const first = await getDashboardNews(newsHubService, firstRequest, "zh-CN");
    const second = await getDashboardNews(newsHubService, new Date(firstRequest.getTime() + 5 * 60 * 60 * 1000), "zh-CN");

    expect(first.items).toEqual([{ summary: "AI 领域出现新的产品进展。", category: "AI", sourceName: "NewsHub", publishedAt: "2026-07-28T02:00:00.000Z", url: "https://example.com/news" }]);
    expect(second).toEqual(first);
    expect(collectTaskModelText).toHaveBeenCalledTimes(1);
  });

  it("keeps summary caches separate by language", async () => {
    vi.mocked(collectTaskModelText)
      .mockResolvedValueOnce(JSON.stringify({ items: [{ summary: "中文摘要", category: "AI" }] }))
      .mockResolvedValueOnce(JSON.stringify({ items: [{ summary: "English summary", category: "AI" }] }));
    const now = new Date("2026-07-28T03:00:00.000Z");

    const chinese = await getDashboardNews(newsHubService, now, "zh-CN");
    const english = await getDashboardNews(newsHubService, now, "en-US");

    expect(chinese.items[0]?.summary).toBe("中文摘要");
    expect(english.items[0]?.summary).toBe("English summary");
    expect(collectTaskModelText).toHaveBeenCalledTimes(2);
  });

  it("keeps summaries when the small model omits the optional category", async () => {
    vi.mocked(collectTaskModelText).mockResolvedValue(
      "```json\n{\"items\":[{\"summary\":\"AI 摘要\"}]}\n```",
    );

    const result = await getDashboardNews(newsHubService, new Date("2026-07-28T03:00:00.000Z"), "zh-CN");

    expect(result.status).toBe("ready");
    expect(result.items[0]).toMatchObject({ summary: "AI 摘要", category: "AI" });
  });

  it("requires Chinese summaries for the Chinese dashboard locale", async () => {
    vi.mocked(collectTaskModelText).mockResolvedValue(
      JSON.stringify({ items: [{ summary: "中文摘要", category: "AI" }] }),
    );

    await getDashboardNews(newsHubService, new Date("2026-07-28T03:00:00.000Z"), "zh-CN");

    const messages = vi.mocked(collectTaskModelText).mock.calls[0]?.[0];
    expect(messages?.[0]?.content).toContain("必须翻译并总结成简体中文");
  });

  it("retranslates English summaries for the Chinese dashboard locale", async () => {
    vi.mocked(collectTaskModelText)
      .mockResolvedValueOnce(JSON.stringify({ items: [{ summary: "English summary", category: "AI" }] }))
      .mockResolvedValueOnce(JSON.stringify({ items: [{ summary: "中文摘要", category: "AI" }] }));

    const result = await getDashboardNews(newsHubService, new Date("2026-07-28T03:00:00.000Z"), "zh-CN");

    expect(result.items[0]?.summary).toBe("中文摘要");
    expect(collectTaskModelText).toHaveBeenCalledTimes(2);
    expect(vi.mocked(collectTaskModelText).mock.calls[1]?.[1]).toMatchObject({ purpose: "dashboard-news-translation" });
  });

  it("parses JSON after model reasoning and formatting text", async () => {
    vi.mocked(collectTaskModelText).mockResolvedValue(
      "<think>Translate the source first.</think>\nHere is the result:\n```json\n{\"items\":[{\"summary\":\"中文摘要\",\"category\":\"AI\"}]}\n```",
    );

    const result = await getDashboardNews(newsHubService, new Date("2026-07-28T03:00:00.000Z"), "zh-CN");

    expect(result).toMatchObject({ status: "ready", items: [{ summary: "中文摘要", category: "AI" }] });
  });
});
