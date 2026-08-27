import {
  newsHubSettingsRepository,
  newsItemsRepository,
  newsFeedSubscriptionsRepository,
  type NewsFeedSubscriptionRecord,
  type NewsItemUpsertInput,
} from "@/db/repositories/index.js";
import { DEFAULT_FETCH_TIMEOUT_MS } from "@/utils/http.js";
import { nowIso } from "@/utils/time.js";
import { indexNewsHubCache } from "./news-search.adapter.js";
import { discoverFeedUrls, parseFeedDocument, type ParsedFeed } from "./feed-parser.js";
import { fetchSafeFeedText } from "./safe-feed-fetch.js";

export type NewsHubSourceKey =
  | "hn-frontpage"
  | "github-changelog"
  | "newsdata"
  | "currents"
  | "reddit"
  | `rss:${string}`;

export type NewsHubSourceDefinition = {
  key: NewsHubSourceKey;
  name: string;
  sourceType: "api" | "rss";
  fetchUrl: string;
  siteUrl: string;
  topic: string;
  lang: string;
  tags: string[];
  enabledByDefault?: boolean;
  isEnabled: (settings: ReturnType<typeof newsHubSettingsRepository.get>) => boolean;
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
      lastFetchedAt: string | null;
      lastFetchStatus: "idle" | "succeeded" | "failed";
      lastFetchError: string | null;
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
  status: "succeeded" | "failed" | "skipped";
  error: string | null;
  usedCache: boolean;
  lastFetchedAt: string | null;
};

export type NewsHubRefreshResult = {
  startedAt: string;
  finishedAt: string;
  fetchedCount: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  ttlMinutes: number;
  sources: NewsHubRefreshSourceResult[];
};

export type NewsHubConfig = ReturnType<typeof newsHubSettingsRepository.get>;

export type NewsFeedCandidate = {
  feedUrl: string;
  siteUrl: string;
  name: string;
  format: "rss" | "atom";
  previewItems: Array<{ title: string; url: string; publishedAt: string | null }>;
};

export type NewsFeedSubscriptionView = NewsFeedSubscriptionRecord & {
  itemCount: number;
  lastFetchedAt: string | null;
  lastFetchStatus: "idle" | "succeeded" | "failed";
  lastFetchError: string | null;
};

type NewsHubOverviewFilters = {
  limit?: number;
  sourceKey?: string | null;
  query?: string | null;
};

const isNonNullable = <T>(value: T | null | undefined): value is T =>
  value != null;

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

type NewsDataResponse = {
  results?: Array<{
    article_id?: string;
    title?: string;
    link?: string;
    creator?: string[] | string | null;
    description?: string | null;
    content?: string | null;
    pubDate?: string | null;
    source_id?: string | null;
    category?: string[] | null;
  }>;
};

type CurrentsResponse = {
  news?: Array<{
    id?: string;
    title?: string;
    description?: string | null;
    url?: string;
    author?: string | null;
    published?: string | null;
    category?: string[] | null;
  }>;
};

type RedditAccessTokenResponse = {
  access_token?: string;
  token_type?: string;
};

type RedditListingResponse = {
  data?: {
    children?: Array<{
      data?: {
        id?: string;
        title?: string;
        selftext?: string;
        url?: string;
        permalink?: string;
        author?: string;
        created_utc?: number;
        subreddit?: string;
        num_comments?: number;
        score?: number;
      };
    }>;
  };
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

const fetchTextWithTimeout = async (
  url: string,
  init?: RequestInit,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "UIChat-Mira-NewsHub/0.1",
        accept:
          "application/json, application/atom+xml, application/rss+xml, text/xml, application/xml;q=0.9, */*;q=0.8",
        ...(init?.headers ?? {}),
      },
      ...init,
      signal: controller.signal,
    });

    if (!response.ok) {
      const responseText = await response.text();
      let detail = `Request failed with status ${response.status}`;

      try {
        const payload = JSON.parse(responseText) as {
          message?: string;
          error?: string;
          results?: { message?: string; code?: string };
        };
        detail =
          payload.results?.message?.trim() ||
          payload.message?.trim() ||
          payload.error?.trim() ||
          detail;
      } catch {
        const compact = responseText.trim();
        if (compact) {
          detail = compact;
        }
      }

      throw new Error(detail);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
};

export const createSourceDefinitions = (): NewsHubSourceDefinition[] => [
  {
    key: "hn-frontpage",
    name: "Hacker News Front Page",
    sourceType: "api",
    fetchUrl: "https://hn.algolia.com/api/v1/search?tags=front_page",
    siteUrl: "https://news.ycombinator.com/",
    topic: "technology",
    lang: "en",
    tags: ["hacker-news", "community"],
    enabledByDefault: true,
    isEnabled: () => true,
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
    enabledByDefault: true,
    isEnabled: () => true,
  },
  {
    key: "newsdata",
    name: "NewsData.io",
    sourceType: "api",
    fetchUrl:
      "https://newsdata.io/api/1/latest?language=en&category=technology&size=10",
    siteUrl: "https://newsdata.io/",
    topic: "technology",
    lang: "en",
    tags: ["newsdata", "tech-media"],
    isEnabled: (settings) => settings.newsDataEnabled && Boolean(settings.newsDataApiKey),
  },
  {
    key: "currents",
    name: "Currents API",
    sourceType: "api",
    fetchUrl:
      "https://api.currentsapi.services/v1/latest-news?language=en&category=technology",
    siteUrl: "https://currentsapi.services/",
    topic: "technology",
    lang: "en",
    tags: ["currents", "tech-media"],
    isEnabled: (settings) => settings.currentsEnabled && Boolean(settings.currentsApiKey),
  },
  {
    key: "reddit",
    name: "Reddit Technology",
    sourceType: "api",
    fetchUrl: "https://oauth.reddit.com",
    siteUrl: "https://www.reddit.com/",
    topic: "technology-community",
    lang: "en",
    tags: ["reddit", "community", "technology"],
    isEnabled: (settings) =>
      settings.redditEnabled &&
      Boolean(settings.redditClientId) &&
      Boolean(settings.redditClientSecret),
  },
];

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
    .filter(isNonNullable);
};

const fetchRssItems = async (
  source: NewsHubSourceDefinition,
): Promise<NewsItemUpsertInput[]> => {
  const response = source.key.startsWith("rss:")
    ? await fetchSafeFeedText(source.fetchUrl)
    : { text: await fetchTextWithTimeout(source.fetchUrl), finalUrl: source.fetchUrl };
  const parsed = parseFeedDocument(response.text, response.finalUrl);
  return parsed.items.map((item) => ({
    ...item,
    sourceType: "rss",
    sourceName: source.name,
    sourceKey: source.key,
    lang: source.lang,
    topic: source.topic,
    tags: source.tags,
  }));
};

const fetchNewsDataItems = async (
  source: NewsHubSourceDefinition,
  settings: NewsHubConfig,
) => {
  const separator = source.fetchUrl.includes("?") ? "&" : "?";
  const text = await fetchTextWithTimeout(
    `${source.fetchUrl}${separator}apikey=${encodeURIComponent(settings.newsDataApiKey)}`,
  );
  const payload = JSON.parse(text) as NewsDataResponse;

  return (payload.results ?? [])
    .map((item) => {
      const title = item.title?.trim() || "";
      const url = item.link?.trim() || "";
      const externalId = (item.article_id || url || title).trim();
      const author = Array.isArray(item.creator)
        ? item.creator.find((value) => typeof value === "string" && value.trim())?.trim() || null
        : typeof item.creator === "string"
          ? item.creator.trim() || null
          : null;

      if (!title || !url || !externalId) {
        return null;
      }

      return {
        sourceType: source.sourceType,
        sourceName: source.name,
        sourceKey: source.key,
        externalId,
        title,
        summary: stripHtml(item.description || ""),
        contentText: stripHtml(item.content || item.description || ""),
        url,
        author,
        publishedAt: item.pubDate || null,
        lang: source.lang,
        topic: source.topic,
        tags: [
          ...source.tags,
          ...(item.category?.filter((value): value is string => Boolean(value)) ?? []),
          ...(item.source_id ? [item.source_id] : []),
        ],
        rawPayload: item as Record<string, unknown>,
      } satisfies NewsItemUpsertInput;
    })
    .filter(isNonNullable);
};

const fetchCurrentsItems = async (
  source: NewsHubSourceDefinition,
  settings: NewsHubConfig,
) => {
  const separator = source.fetchUrl.includes("?") ? "&" : "?";
  const text = await fetchTextWithTimeout(
    `${source.fetchUrl}${separator}apiKey=${encodeURIComponent(settings.currentsApiKey)}`,
  );
  const payload = JSON.parse(text) as CurrentsResponse;

  return (payload.news ?? [])
    .map((item) => {
      const title = item.title?.trim() || "";
      const url = item.url?.trim() || "";
      const externalId = (item.id || url || title).trim();

      if (!title || !url || !externalId) {
        return null;
      }

      return {
        sourceType: source.sourceType,
        sourceName: source.name,
        sourceKey: source.key,
        externalId,
        title,
        summary: stripHtml(item.description || ""),
        contentText: stripHtml(item.description || ""),
        url,
        author: item.author?.trim() || null,
        publishedAt: item.published || null,
        lang: source.lang,
        topic: source.topic,
        tags: [
          ...source.tags,
          ...(item.category?.filter((value): value is string => Boolean(value)) ?? []),
        ],
        rawPayload: item as Record<string, unknown>,
      } satisfies NewsItemUpsertInput;
    })
    .filter(isNonNullable);
};

const fetchRedditAccessToken = async (settings: NewsHubConfig) => {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
  });

  const text = await fetchTextWithTimeout(
    "https://www.reddit.com/api/v1/access_token",
    {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(
          `${settings.redditClientId}:${settings.redditClientSecret}`,
        ).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": settings.redditUserAgent,
      },
      body: body.toString(),
    },
  );

  const payload = JSON.parse(text) as RedditAccessTokenResponse;
  if (!payload.access_token) {
    throw new Error("Reddit access token is missing in the response");
  }

  return payload.access_token;
};

const fetchRedditItems = async (
  source: NewsHubSourceDefinition,
  settings: NewsHubConfig,
) => {
  const token = await fetchRedditAccessToken(settings);
  const subreddits =
    settings.redditSubreddits
      .trim()
      .replace(/\s+/g, "")
      .replace(/^\/+|\/+$/g, "") || "technology";
  const text = await fetchTextWithTimeout(
    `${source.fetchUrl}/r/${subreddits}/hot?limit=25`,
    {
      headers: {
        authorization: `Bearer ${token}`,
        "user-agent": settings.redditUserAgent,
        accept: "application/json",
      },
    },
  );

  const payload = JSON.parse(text) as RedditListingResponse;
  return (payload.data?.children ?? [])
    .map((entry) => {
      const item = entry.data;
      const title = item?.title?.trim() || "";
      const permalink = item?.permalink?.trim() || "";
      const url = permalink ? `https://www.reddit.com${permalink}` : item?.url?.trim() || "";
      const externalId = (item?.id || permalink || url || title).trim();

      if (!title || !url || !externalId) {
        return null;
      }

      return {
        sourceType: source.sourceType,
        sourceName: source.name,
        sourceKey: source.key,
        externalId,
        title,
        summary: stripHtml(item?.selftext || ""),
        contentText: stripHtml(item?.selftext || ""),
        url,
        author: item?.author?.trim() || null,
        publishedAt:
          typeof item?.created_utc === "number"
            ? new Date(item.created_utc * 1000).toISOString()
            : null,
        lang: source.lang,
        topic: source.topic,
        tags: [
          ...source.tags,
          ...(item?.subreddit ? [item.subreddit] : []),
        ],
        rawPayload: {
          id: item?.id,
          permalink,
          targetUrl: item?.url,
          subreddit: item?.subreddit,
          numComments: item?.num_comments,
          score: item?.score,
        },
      } satisfies NewsItemUpsertInput;
    })
    .filter(isNonNullable);
};

export const resolveSourceFetchKind = (source: NewsHubSourceDefinition) => {
  if (source.sourceType === "rss" || source.key.startsWith("rss:")) return "rss" as const;
  if (source.key === "newsdata") return "newsdata" as const;
  if (source.key === "currents") return "currents" as const;
  if (source.key === "reddit") return "reddit" as const;
  return "hacker-news" as const;
};

const fetchSourceItems = async (
  source: NewsHubSourceDefinition,
  settings: NewsHubConfig,
) => {
  switch (resolveSourceFetchKind(source)) {
    case "rss":
      return fetchRssItems(source);
    case "newsdata":
      return fetchNewsDataItems(source, settings);
    case "currents":
      return fetchCurrentsItems(source, settings);
    case "reddit":
      return fetchRedditItems(source, settings);
    default:
      return fetchHackerNewsItems(source);
  }
};

const shouldUseCache = (lastFetchedAt: string | null, ttlMinutes: number) => {
  if (!lastFetchedAt) {
    return false;
  }

  const lastFetched = new Date(lastFetchedAt).getTime();
  if (!Number.isFinite(lastFetched)) {
    return false;
  }

  return Date.now() - lastFetched < ttlMinutes * 60 * 1000;
};

const subscriptionToSource = (subscription: NewsFeedSubscriptionRecord): NewsHubSourceDefinition => ({
  key: subscription.sourceKey as `rss:${string}`,
  name: subscription.name,
  sourceType: "rss",
  fetchUrl: subscription.feedUrl,
  siteUrl: subscription.siteUrl,
  topic: subscription.topic,
  lang: subscription.lang,
  tags: ["subscription", subscription.format],
  isEnabled: () => subscription.enabled,
});

const candidateFromParsed = (parsed: ParsedFeed, feedUrl: string): NewsFeedCandidate => ({
  feedUrl,
  siteUrl: parsed.siteUrl,
  name: parsed.title,
  format: parsed.format,
  previewItems: parsed.items.slice(0, 3).map((item) => ({
    title: item.title,
    url: item.url,
    publishedAt: item.publishedAt ?? null,
  })),
});

const detectFeedCandidates = async (inputUrl: string): Promise<NewsFeedCandidate[]> => {
  const response = await fetchSafeFeedText(inputUrl);
  try {
    const parsed = parseFeedDocument(response.text, response.finalUrl);
    return [candidateFromParsed(parsed, response.finalUrl)];
  } catch (directError) {
    if (!response.contentType.includes("html") && !/<html\b/i.test(response.text)) throw directError;
  }

  const discovered = discoverFeedUrls(response.text, response.finalUrl);
  if (discovered.length === 0) throw new Error("该网页没有声明 RSS 或 Atom 订阅源");
  const candidates: NewsFeedCandidate[] = [];
  for (const feedUrl of discovered) {
    try {
      const feedResponse = await fetchSafeFeedText(feedUrl);
      candidates.push(candidateFromParsed(parseFeedDocument(feedResponse.text, feedResponse.finalUrl), feedResponse.finalUrl));
      if (new URL(feedUrl).hostname === new URL(response.finalUrl).hostname) return candidates;
    } catch {
      // One invalid candidate must not hide other valid feeds declared by the page.
    }
  }
  if (candidates.length === 0) throw new Error("网页声明的订阅源暂时无法读取");
  return candidates;
};

export const createNewsHubService = (input?: {
  sources?: NewsHubSourceDefinition[];
  onContentChanged?: () => void;
}) => {
  const fixedSources = input?.sources ?? createSourceDefinitions();
  const resolveSources = () => input?.sources
    ? fixedSources
    : [...fixedSources, ...newsFeedSubscriptionsRepository.list().map(subscriptionToSource)];

  const refreshInternal = async (force = false, onlySourceKey?: string): Promise<NewsHubRefreshResult> => {
    const settings = newsHubSettingsRepository.get();
    const sources = resolveSources();
    const allowedSourceKeys = sources.map((source) => source.key);
    const selectedSources = onlySourceKey
      ? sources.filter((source) => source.key === onlySourceKey)
      : sources;
    if (onlySourceKey && selectedSources.length === 0) throw new Error("订阅源不存在");
    const startedAt = nowIso();
    const results: NewsHubRefreshSourceResult[] = [];
    let fetchedCount = 0;
    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    newsItemsRepository.deleteBySourceKeysExcluding(allowedSourceKeys);

    for (const source of selectedSources) {
      if (!source.isEnabled(settings) && !source.enabledByDefault) {
        continue;
      }

      const sourceState = newsHubSettingsRepository.getSourceState(source.key);
      if (!force && shouldUseCache(sourceState?.lastFetchedAt ?? null, settings.refreshTtlMinutes)) {
        skippedCount += 1;
        results.push({
          key: source.key,
          name: source.name,
          fetchedCount: 0,
          insertedCount: 0,
          updatedCount: 0,
          status: "skipped",
          error: null,
          usedCache: true,
          lastFetchedAt: sourceState?.lastFetchedAt ?? null,
        });
        continue;
      }

      try {
        const items = await fetchSourceItems(source, settings);
        const upserted = newsItemsRepository.upsertMany(items);
        const fetchedAt = nowIso();

        fetchedCount += items.length;
        insertedCount += upserted.insertedCount;
        updatedCount += upserted.updatedCount;

        newsHubSettingsRepository.upsertSourceState({
          sourceKey: source.key,
          lastFetchedAt: fetchedAt,
          lastStatus: "succeeded",
          lastError: null,
        });

        results.push({
          key: source.key,
          name: source.name,
          fetchedCount: items.length,
          insertedCount: upserted.insertedCount,
          updatedCount: upserted.updatedCount,
          status: "succeeded",
          error: null,
          usedCache: false,
          lastFetchedAt: fetchedAt,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        newsHubSettingsRepository.upsertSourceState({
          sourceKey: source.key,
          lastStatus: "failed",
          lastError: errorMessage,
        });

        results.push({
          key: source.key,
          name: source.name,
          fetchedCount: 0,
          insertedCount: 0,
          updatedCount: 0,
          status: "failed",
          error: errorMessage,
          usedCache: false,
          lastFetchedAt: sourceState?.lastFetchedAt ?? null,
        });
      }
    }

    await indexNewsHubCache();

    if (insertedCount > 0 || updatedCount > 0) {
      input?.onContentChanged?.();
    }

    return {
      startedAt,
      finishedAt: nowIso(),
      fetchedCount,
      insertedCount,
      updatedCount,
      skippedCount,
      ttlMinutes: settings.refreshTtlMinutes,
      sources: results,
    };
  };

  return {
    getConfig(): NewsHubConfig {
      return newsHubSettingsRepository.get();
    },

    updateConfig(input: Partial<NewsHubConfig>): NewsHubConfig {
      return newsHubSettingsRepository.update(input);
    },

    async getOverview(filters: NewsHubOverviewFilters = {}): Promise<NewsHubOverview> {
      await refreshInternal(false);
      return this.getCachedOverview(filters);
    },

    async getCachedOverview(filters: NewsHubOverviewFilters = {}): Promise<NewsHubOverview> {
      const sources = resolveSources();
      const allowedSourceKeys = sources.map((source) => source.key);
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
      const states = new Map(
        newsHubSettingsRepository
          .listSourceStates()
          .map((row) => [row.sourceKey, row] as const),
      );
      const settings = newsHubSettingsRepository.get();

      return {
        sources: sources
          .filter((source) => source.isEnabled(settings) || source.enabledByDefault)
          .map((source) => {
            const row = stats.get(source.key);
            const state = states.get(source.key);
            return {
              ...source,
              itemCount: row?.itemCount ?? 0,
              lastPublishedAt: row?.lastPublishedAt ?? null,
              lastIngestedAt: row?.lastIngestedAt ?? null,
              lastFetchedAt: state?.lastFetchedAt ?? null,
              lastFetchStatus: state?.lastStatus ?? "idle",
              lastFetchError: state?.lastError ?? null,
            };
          }),
        items: list.items,
        total: list.total,
        generatedAt: nowIso(),
      };
    },

    async refresh(): Promise<NewsHubRefreshResult> {
      return refreshInternal(false);
    },

    async detectFeed(inputUrl: string) {
      return { candidates: await detectFeedCandidates(inputUrl) };
    },

    listFeedSubscriptions(): NewsFeedSubscriptionView[] {
      const states = new Map(newsHubSettingsRepository.listSourceStates().map((item) => [item.sourceKey, item]));
      const stats = new Map(newsItemsRepository.listSourceStats().map((item) => [item.sourceKey, item]));
      return newsFeedSubscriptionsRepository.list().map((subscription) => {
        const state = states.get(subscription.sourceKey);
        const stat = stats.get(subscription.sourceKey);
        return {
          ...subscription,
          itemCount: stat?.itemCount ?? 0,
          lastFetchedAt: state?.lastFetchedAt ?? null,
          lastFetchStatus: state?.lastStatus ?? "idle",
          lastFetchError: state?.lastError ?? null,
        };
      });
    },

    async createFeedSubscription(input: { feedUrl: string; name?: string; lang?: string; topic?: string }) {
      if (newsFeedSubscriptionsRepository.list().length >= 50) throw new Error("最多只能添加 50 个订阅源");
      const candidates = await detectFeedCandidates(input.feedUrl);
      const candidate = candidates.find((item) => item.feedUrl === input.feedUrl) ?? candidates[0];
      if (!candidate) throw new Error("没有找到可用的订阅源");
      if (newsFeedSubscriptionsRepository.getByFeedUrl(candidate.feedUrl)) throw new Error("该订阅源已经存在");
      const subscription = newsFeedSubscriptionsRepository.create({
        name: input.name?.trim() || candidate.name,
        feedUrl: candidate.feedUrl,
        siteUrl: candidate.siteUrl,
        format: candidate.format,
        enabled: true,
        lang: input.lang?.trim() || "zh",
        topic: input.topic?.trim() || "technology",
      });
      await refreshInternal(true, subscription.sourceKey);
      return this.listFeedSubscriptions().find((item) => item.id === subscription.id)!;
    },

    updateFeedSubscription(id: string, input: { name?: string; enabled?: boolean; lang?: string; topic?: string }) {
      const updated = newsFeedSubscriptionsRepository.update(id, input);
      if (!updated) throw new Error("订阅源不存在");
      return this.listFeedSubscriptions().find((item) => item.id === id)!;
    },

    async refreshFeedSubscription(id: string) {
      const subscription = newsFeedSubscriptionsRepository.getById(id);
      if (!subscription) throw new Error("订阅源不存在");
      if (!subscription.enabled) throw new Error("请先启用该订阅源");
      return refreshInternal(true, subscription.sourceKey);
    },

    deleteFeedSubscription(id: string) {
      const subscription = newsFeedSubscriptionsRepository.delete(id);
      if (!subscription) throw new Error("订阅源不存在");
      const deleted = newsItemsRepository.deleteBySourceKey(subscription.sourceKey);
      newsHubSettingsRepository.deleteSourceState(subscription.sourceKey);
      input?.onContentChanged?.();
      return { id, sourceKey: subscription.sourceKey, deletedItemCount: deleted.deletedCount };
    },
  };
};
