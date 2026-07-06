import { newsItemsRepository, type NewsItemUpsertInput } from "@/db/repositories/index.js";
import { DEFAULT_FETCH_TIMEOUT_MS } from "@/utils/http.js";
import { nowIso } from "@/utils/time.js";

export type NewsHubSourceDefinition = {
  key: string;
  name: string;
  sourceType: "api" | "rss" | "atom";
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

const defaultGithubRepos = [
  "openai/openai-node",
  "openai/openai-python",
  "vercel/next.js",
  "microsoft/typescript",
];

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

const stripHtml = (value: string) =>
  decodeHtmlEntities(value)
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
  return matched ? decodeHtmlEntities(matched[1]).trim() : "";
};

const readLinkHref = (xml: string) => {
  const atomLink = xml.match(/<link\b[^>]*href="([^"]+)"[^>]*\/?>/i);
  if (atomLink?.[1]) {
    return decodeHtmlEntities(atomLink[1]).trim();
  }

  return readTag(xml, "link");
};

const parseAtomFeed = (xml: string): FeedEntry[] => {
  const entries = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];

  return entries
    .map((entryXml) => {
      const title = stripHtml(readTag(entryXml, "title"));
      const summary = stripHtml(readTag(entryXml, "summary"));
      const contentText = stripHtml(readTag(entryXml, "content"));
      const url = readLinkHref(entryXml);
      const externalId = readTag(entryXml, "id") || url || title;
      const publishedAt =
        readTag(entryXml, "published") || readTag(entryXml, "updated") || null;

      if (!title || !url || !externalId) {
        return null;
      }

      return {
        externalId,
        title,
        summary,
        contentText,
        url,
        author: stripHtml(readTag(entryXml, "name")) || null,
        publishedAt,
        rawPayload: {
          id: externalId,
          title,
          summary,
          url,
          publishedAt,
        },
      } satisfies FeedEntry;
    })
    .filter((item): item is FeedEntry => Boolean(item));
};

const parseRssFeed = (xml: string): FeedEntry[] => {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];

  return items
    .map((itemXml) => {
      const title = stripHtml(readTag(itemXml, "title"));
      const summary = stripHtml(readTag(itemXml, "description"));
      const contentText =
        stripHtml(readTag(itemXml, "content:encoded")) || summary;
      const url = readTag(itemXml, "link");
      const externalId = readTag(itemXml, "guid") || url || title;
      const publishedAt = readTag(itemXml, "pubDate") || null;

      if (!title || !url || !externalId) {
        return null;
      }

      return {
        externalId,
        title,
        summary,
        contentText,
        url,
        author:
          stripHtml(readTag(itemXml, "dc:creator")) ||
          stripHtml(readTag(itemXml, "author")) ||
          null,
        publishedAt,
        rawPayload: {
          guid: externalId,
          title,
          summary,
          url,
          publishedAt,
        },
      } satisfies FeedEntry;
    })
    .filter((item): item is FeedEntry => Boolean(item));
};

const parseFeedXml = (xml: string) =>
  /<feed\b/i.test(xml) ? parseAtomFeed(xml) : parseRssFeed(xml);

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
  const repos = (
    process.env.UI_CHAT_NEWS_GITHUB_RELEASE_REPOS?.split(",") ?? defaultGithubRepos
  )
    .map((item) => item.trim())
    .filter(Boolean);

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
    ...repos.map((repo) => ({
      key: `github-release:${repo}`,
      name: `${repo} Releases`,
      sourceType: "atom" as const,
      fetchUrl: `https://github.com/${repo}/releases.atom`,
      siteUrl: `https://github.com/${repo}/releases`,
      topic: "open-source",
      lang: "en",
      tags: ["github", "release", repo],
    })),
  ];
};

const normalizeFeedItem = (
  source: NewsHubSourceDefinition,
  item: FeedEntry,
): NewsItemUpsertInput => ({
  sourceType: source.sourceType,
  sourceName: source.name,
  sourceKey: source.key,
  externalId: item.externalId,
  title: item.title,
  summary: item.summary,
  contentText: item.contentText || item.summary,
  url: item.url,
  author: item.author,
  publishedAt: item.publishedAt,
  lang: source.lang,
  topic: source.topic,
  tags: source.tags,
  rawPayload: item.rawPayload,
});

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

      return {
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
      } satisfies NewsItemUpsertInput;
    })
    .filter((item): item is NewsItemUpsertInput => Boolean(item));
};

const fetchFeedItems = async (
  source: NewsHubSourceDefinition,
): Promise<NewsItemUpsertInput[]> => {
  const text = await fetchTextWithTimeout(source.fetchUrl);
  return parseFeedXml(text).map((item) => normalizeFeedItem(source, item));
};

const fetchSourceItems = async (source: NewsHubSourceDefinition) => {
  if (source.key === "hn-frontpage") {
    return fetchHackerNewsItems(source);
  }

  return fetchFeedItems(source);
};

export const createNewsHubService = (input?: {
  sources?: NewsHubSourceDefinition[];
}) => {
  const sources = input?.sources ?? createSourceDefinitions();

  return {
    getOverview(filters: NewsHubOverviewFilters = {}): NewsHubOverview {
      const list = newsItemsRepository.listRecent({
        limit: filters.limit,
        query: filters.query ?? undefined,
        sourceKey: filters.sourceKey ?? undefined,
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
