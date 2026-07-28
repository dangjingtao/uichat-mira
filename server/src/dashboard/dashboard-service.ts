import type { createNewsHubService } from "@/microapps/news-hub/index.js";
import { collectTaskModelText } from "@/services/task-model.service.js";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import type { DashboardOverview, DashboardWidget, NewsData } from "./dashboard-types.js";
import { getClockWeatherLoadingData, clockWeatherProvider } from "./providers/clock-weather-provider.js";
import { countdownProvider } from "./providers/countdown-provider.js";
import { mailProvider } from "./providers/mail-provider.js";
import { projectStatusProvider } from "./providers/project-status-provider.js";
import { recentArtifactsProvider } from "./providers/recent-artifacts-provider.js";

const NEWS_SUMMARY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const newsSummaryCache = new Map<string, { data: NewsData; expiresAt: number }>();
const newsSummaryRequests = new Map<string, Promise<NewsData>>();
const containsChinese = (value: string) => /[\u3400-\u9fff]/.test(value);

const parseNewsSummaryOutput = (output: string) => {
  const withoutReasoning = output
    .trim()
    .replace(/^<think>[\s\S]*?<\/think>\s*/i, "");
  const fencedJson = withoutReasoning.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] ?? withoutReasoning;
  const start = fencedJson.indexOf("{");
  const end = fencedJson.lastIndexOf("}");

  if (start < 0 || end < start) {
    throw new Error("The news summary model did not return a JSON object");
  }

  return JSON.parse(fencedJson.slice(start, end + 1)) as {
    items?: Array<{ summary?: unknown; category?: unknown }>;
  };
};

const ensureSummaryLanguage = async (
  items: Array<{ summary: string; category: string }>,
  language: string,
) => {
  if (!language.toLowerCase().startsWith("zh") || items.every((item) => containsChinese(item.summary))) {
    return items;
  }

  const translationOutput = await collectTaskModelText([
    {
      role: "system",
      content: "将输入 JSON 中每一项的 summary 翻译成简体中文。每一条 summary 都必须包含汉字。保持 items 的顺序和数量，category 原样保留。只能输出 JSON，格式为 {\"items\":[{\"summary\":\"...\",\"category\":\"...\"}]}。",
      parts: [],
    },
    {
      role: "user",
      content: JSON.stringify({ items }),
      parts: [],
    },
  ], {
    maxTokens: 768,
    temperature: 0,
    purpose: "dashboard-news-translation",
  });
  const translated = parseNewsSummaryOutput(translationOutput).items ?? [];

  if (translated.length !== items.length) {
    throw new Error("The news summary translation did not preserve all items");
  }

  return items.map((item, index) => {
    const summary = translated[index]?.summary;
    if (typeof summary !== "string" || !containsChinese(summary)) {
      throw new Error("The news summary translation did not produce Chinese text");
    }
    return { ...item, summary: summary.trim() };
  });
};

export async function getDashboardOverview(now = new Date()): Promise<DashboardOverview> {
  const [mail, projectStatus, countdown, recentArtifacts] = await Promise.all([
    mailProvider.getData(now),
    projectStatusProvider.getData(now),
    countdownProvider.getData(now),
    recentArtifactsProvider.getData(now),
  ]);

  const widgets: DashboardWidget[] = [
    { id: "clock-weather", type: "clock-weather", title: "时间与天气", size: "small", data: getClockWeatherLoadingData(now), updatedAt: now.toISOString() },
    { id: "news", type: "news", title: "新闻", size: "medium", data: getDashboardNewsLoadingData(), updatedAt: now.toISOString() },
    { id: "mail", type: "mail", title: "邮件", size: "small", data: mail, updatedAt: now.toISOString() },
    { id: "project-status", type: "project-status", title: "Mira 开发状态", size: "medium", data: projectStatus, updatedAt: now.toISOString() },
    { id: "countdown", type: "countdown", title: "倒计时", size: "small", data: countdown, updatedAt: now.toISOString() },
    { id: "recent-artifacts", type: "recent-artifacts", title: "近期交付", size: "medium", data: recentArtifacts, updatedAt: now.toISOString() },
  ];

  return { generatedAt: now.toISOString(), widgets };
}

export function getDashboardWeather(now = new Date()) {
  return clockWeatherProvider.getData(now);
}

export function getDashboardNewsLoadingData(): NewsData {
  return { demo: false, sourceLabel: "NewsHub", status: "loading", items: [] };
}

export async function getDashboardNews(
  newsHubService: ReturnType<typeof createNewsHubService>,
  now = new Date(),
  language = "zh-CN",
): Promise<NewsData> {
  const cacheKey = language.toLowerCase();
  const cached = newsSummaryCache.get(cacheKey);
  if (cached && cached.expiresAt > now.getTime()) {
    return cached.data;
  }
  const pending = newsSummaryRequests.get(cacheKey);
  if (pending) {
    return pending;
  }
  const request = summarizeDashboardNews(newsHubService, now, language).finally(() => {
    newsSummaryRequests.delete(cacheKey);
  });
  newsSummaryRequests.set(cacheKey, request);
  try {
    return await request;
  } catch {
    return { demo: false, sourceLabel: "NewsHub", status: "unavailable", items: [] };
  }
}

async function summarizeDashboardNews(
  newsHubService: ReturnType<typeof createNewsHubService>,
  now: Date,
  language: string,
): Promise<NewsData> {
  const overview = await newsHubService.getOverview({ limit: 10 });
  if (overview.items.length === 0) {
    const empty = getDashboardNewsLoadingData();
    newsSummaryCache.set(language.toLowerCase(), { data: empty, expiresAt: now.getTime() + NEWS_SUMMARY_CACHE_TTL_MS });
    return empty;
  }

  const isChinese = language.toLowerCase().startsWith("zh");
  const summaryLanguage = isChinese ? "简体中文" : "English";
  const languageRequirement = isChinese
    ? "summary 必须是简体中文。即使输入新闻是英文，也必须翻译并总结成简体中文；不得输出英文摘要。"
    : "summary must be in English, even when the input article is written in another language.";
  const messages: NormalizedChatMessage[] = [
    {
      role: "system",
      content: `You are Mira's news summarizer. Produce up to 10 concise ${summaryLanguage} summaries from the supplied articles. ${languageRequirement} Keep only facts and key developments. Do not copy the source verbatim or invent information. Output JSON only, in the format {"items":[{"summary":"...","category":"..."}]}, and preserve input order.`,
      parts: [],
    },
    {
      role: "user",
      content: JSON.stringify({
        items: overview.items.slice(0, 10).map((item) => ({
          title: item.title,
          source: item.sourceName,
          category: item.topic,
          sourceSummary: item.summary,
          contentPreview: item.contentText.slice(0, 280),
        })),
      }),
      parts: [],
    },
  ];
  const output = await collectTaskModelText(messages, {
    maxTokens: 768,
    temperature: 0,
    purpose: "dashboard-news-summary",
  });
  const parsed = parseNewsSummaryOutput(output);
  const items = (parsed.items ?? [])
    .slice(0, 10)
    .map((item, index) => ({
      summary: typeof item.summary === "string" ? item.summary.trim() : "",
      category:
        typeof item.category === "string" && item.category.trim().length > 0
          ? item.category.trim()
          : overview.items[index]?.topic?.trim() || "technology",
    }))
    .filter((item) => item.summary.length > 0);
  const localizedItems = await ensureSummaryLanguage(items, language);
  const data: NewsData = {
    demo: false,
    sourceLabel: "NewsHub",
    status: localizedItems.length > 0 ? "ready" : "unavailable",
    items: localizedItems.map((item, index) => ({
      summary: item.summary,
      category: item.category,
      sourceName: overview.items[index]?.sourceName ?? "NewsHub",
      publishedAt: overview.items[index]?.publishedAt ?? overview.items[index]?.ingestedAt ?? now.toISOString(),
      url: overview.items[index]?.url ?? "",
    })),
  };
  newsSummaryCache.set(language.toLowerCase(), { data, expiresAt: now.getTime() + NEWS_SUMMARY_CACHE_TTL_MS });
  return data;
}

export function resetDashboardNewsSummaryCache(): void {
  newsSummaryCache.clear();
  newsSummaryRequests.clear();
}
