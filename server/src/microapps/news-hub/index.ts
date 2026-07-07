import { newsItemsRepository, type NewsItemUpsertInput } from "@/db/repositories/index.js";
import { DEFAULT_FETCH_TIMEOUT_MS } from "@/utils/http.js";
import { nowIso } from "@/utils/time.js";

export type NewsHubSourceDefinition = {
  key: string;
  name: string;
  sourceType: "api" | "rss";
  fetchUrl: string;
  siteUrl: string;
  topic: string;
  lang: string;
  tags: string[];
};

export type NewsHubOverviewItem = ReturnType<
  typeof newsItemsRepository.listRecent
>["items"][number];

export type NewsHubOverview = {
  sources: Array<
    NewsHubSourceDefinition & {
      itemCount: number;
      lastPublishedAt: string | null;
      lastIngestedAt: string | null;
    }
  >;
  items: NewsHubOverviewItem[];
  total: number;
  generatedAt: string;
};

export type NewsHubRefreshSourceResult = {
  key: string;
  name: string;
  fetchedCount: number;
  insertedCount: number;
  updatedCount: number;
  status: "succeeded" | "failed";
  error: string | null;
};

export type NewsHubRefreshResult = {
  startedAt: string;
  finishedAt: string;
  fetchedCount: number;
  insertedCount: number;
  updatedCount: number;
  sources: NewsHubRefreshSourceResult[];
};

type NewsHubOverviewFilters = {
  limit?: number;
  sourceKey?: string | null;
  query?: string | null;
};

const isNonNullable = <T>(value: T | null | undefined): value is T =>
  value != null;

type FeedEntry = {
  externalId: string;
  title: string;
  summary: string;
  contentText: string;
  url: string;
  author: string | null;
  publishedAt: string | null;
  rawPayload: Record<string, unknown>;
};

type HnSearchResponse = {
  hits?: Array<{
    objectID?: string;
    title?: string;
    story_title?: string;
    url?: string;
    story_url?: string;
    author?: string;
    created_at?: string;
    story_text?: string | null;
    comment_text?: string | null;
    points?: number | null;
  }>;
};

const stripHtml = (value: string) =>
  value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const readTag = (xml: string, tagName: string) => {
  const pattern = new RegExp(
    `<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`,
    "i",
  );
  const matched = xml.match(pattern);
  return matched ? stripHtml(matched[1]) : "";
};

const fetchTextWithTimeout = async (
  url: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "UIChat-Mira-NewsHub/0.1",
        accept: "application/json, application/atom+xml, application/rss+xml, text/xml, application/xml;q=0.9, */*;q=0.8",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
};

const createSourceDefinitions = (): NewsHubSourceDefinition[] => {
  return [
    {
      key: "hn-frontpage",
      name: "Hacker News Front Page",
      sourceType: "api",
      fetchUrl: "https://hn.algolia.com/api/v1/search?tags=front_page",
      siteUrl: "https://news.ycombinator.com/",
      topic: "technology",
      lang: "en",
      tags: ["hacker-news", "community"],
    },
    {
      key: "github-changelog",
      name: "GitHub Changelog",
      sourceType: "rss",
      fetchUrl: "https://github.blog/changelog/feed/",
      siteUrl: "https://github.blog/changelog/",
      topic: "developer-platform",
      lang: "en",
      tags: ["github", "changelog"],
    },
  ];
};

const fetchHackerNewsItems = async (
  source: NewsHubSourceDefinition,
): Promise<NewsItemUpsertInput[]> => {
  const text = await fetchTextWithTimeout(source.fetchUrl);
  const payload = JSON.parse(text) as HnSearchResponse;

  return (payload.hits ?? [])
    .map((hit) => {
      const title = (hit.title || hit.story_title || "").trim();
      const url = (hit.url || hit.story_url || "").trim();
      const externalId = (hit.objectID || url || title).trim();

      if (!title || !url || !externalId) {
        return null;
      }

      const result: NewsItemUpsertInput = {
        sourceType: source.sourceType,
        sourceName: source.name,
        sourceKey: source.key,
        externalId,
        title,
        summary: stripHtml(hit.story_text || hit.comment_text || ""),
        contentText: stripHtml(hit.story_text || hit.comment_text || ""),
        url,
        author: hit.author?.trim() || null,
        publishedAt: hit.created_at || null,
        lang: source.lang,
        topic: source.topic,
        tags: [...source.tags, "front-page"],
        rawPayload: {
          objectID: hit.objectID,
          points: hit.points ?? null,
        },
      };

      return result;
    })
    .filter(isNonNullable);
};

const fetchRssItems = async (
  source: NewsHubSourceDefinition,
): Promise<NewsItemUpsertInput[]> => {
  const text = await fetchTextWithTimeout(source.fetchUrl);
  const items = text.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];

  return items
    .map((itemXml) => {
      const title = readTag(itemXml, "title");
      const summary = readTag(itemXml, "description");
      const contentText =
        readTag(itemXml, "content:encoded") || summary;
      const url = readTag(itemXml, "link");
      const externalId = readTag(itemXml, "guid") || url || title;
      const author =
        readTag(itemXml, "dc:creator") || readTag(itemXml, "author") || null;
      const publishedAt = readTag(itemXml, "pubDate") || null;

      if (!title || !url || !externalId) {
        return null;
      }

      const result: NewsItemUpsertInput = {
        sourceType: source.sourceType,
        sourceName: source.name,
        sourceKey: source.key,
        externalId,
        title,
        summary,
        contentText,
        url,
        author,
        publishedAt,
        lang: source.lang,
        topic: source.topic,
        tags: source.tags,
        rawPayload: {
          guid: externalId,
          title,
          summary,
          url,
          author,
          publishedAt,
        },
      };

      return result;
    })
    .filter(isNonNullable);
};

const fetchSourceItems = async (source: NewsHubSourceDefinition) => {
  if (source.key === "github-changelog") {
    return fetchRssItems(source);
  }

  return fetchHackerNewsItems(source);
};

export const createNewsHubService = (input?: {
  sources?: NewsHubSourceDefinition[];
}) => {
  const sources = input?.sources ?? createSourceDefinitions();
  const allowedSourceKeys = sources.map((source) => source.key);

  return {
    getOverview(filters: NewsHubOverviewFilters = {}): NewsHubOverview {
      newsItemsRepository.deleteBySourceKeysExcluding(allowedSourceKeys);

      const list = newsItemsRepository.listRecent({
        limit: filters.limit,
        query: filters.query ?? undefined,
        sourceKey: filters.sourceKey ?? undefined,
        sourceKeys: allowedSourceKeys,
      });
      const stats = new Map(
        newsItemsRepository
          .listSourceStats()
          .map((row) => [row.sourceKey, row] as const),
      );

      return {
        sources: sources.map((source) => {
          const row = stats.get(source.key);
          return {
            ...source,
            itemCount: row?.itemCount ?? 0,
            lastPublishedAt: row?.lastPublishedAt ?? null,
            lastIngestedAt: row?.lastIngestedAt ?? null,
          };
        }),
        items: list.items,
        total: list.total,
        generatedAt: nowIso(),
      };
    },

    async refresh(): Promise<NewsHubRefreshResult> {
      const startedAt = nowIso();
      const results: NewsHubRefreshSourceResult[] = [];
      let fetchedCount = 0;
      let insertedCount = 0;
      let updatedCount = 0;

      newsItemsRepository.deleteBySourceKeysExcluding(allowedSourceKeys);

      for (const source of sources) {
        try {
          const items = await fetchSourceItems(source);
          const upserted = newsItemsRepository.upsertMany(items);

          fetchedCount += items.length;
          insertedCount += upserted.insertedCount;
          updatedCount += upserted.updatedCount;

          results.push({
            key: source.key,
            name: source.name,
            fetchedCount: items.length,
            insertedCount: upserted.insertedCount,
            updatedCount: upserted.updatedCount,
            status: "succeeded",
            error: null,
          });
        } catch (error) {
          results.push({
            key: source.key,
            name: source.name,
            fetchedCount: 0,
            insertedCount: 0,
            updatedCount: 0,
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      return {
        startedAt,
        finishedAt: nowIso(),
        fetchedCount,
        insertedCount,
        updatedCount,
        sources: results,
      };
    },
  };
};
