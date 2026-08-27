import { del, get, patch, post, put } from "../lib/request";

export type NewsHubSource = {
  key: string;
  name: string;
  sourceType: string;
  fetchUrl: string;
  siteUrl: string;
  topic: string;
  lang: string;
  tags: string[];
  itemCount: number;
  lastPublishedAt: string | null;
  lastIngestedAt: string | null;
  lastFetchedAt: string | null;
  lastFetchStatus: "idle" | "succeeded" | "failed";
  lastFetchError: string | null;
};

export type NewsHubItem = {
  id: string;
  sourceType: string;
  sourceName: string;
  sourceKey: string;
  externalId: string;
  title: string;
  summary: string;
  contentText: string;
  url: string;
  author: string | null;
  publishedAt: string | null;
  ingestedAt: string;
  lang: string;
  topic: string;
  tags: string[];
  rawPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type NewsHubOverview = {
  sources: NewsHubSource[];
  items: NewsHubItem[];
  total: number;
  generatedAt: string;
};

export type NewsHubRefreshResult = {
  startedAt: string;
  finishedAt: string;
  fetchedCount: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  ttlMinutes: number;
  sources: Array<{
    key: string;
    name: string;
    fetchedCount: number;
    insertedCount: number;
    updatedCount: number;
    status: "succeeded" | "failed" | "skipped";
    error: string | null;
    usedCache: boolean;
    lastFetchedAt: string | null;
  }>;
};

export type NewsHubConfig = {
  newsDataEnabled: boolean;
  newsDataApiKey: string;
  currentsEnabled: boolean;
  currentsApiKey: string;
  redditEnabled: boolean;
  redditClientId: string;
  redditClientSecret: string;
  redditUserAgent: string;
  redditSubreddits: string;
  refreshTtlMinutes: number;
};

export type NewsFeedCandidate = {
  feedUrl: string;
  siteUrl: string;
  name: string;
  format: "rss" | "atom";
  previewItems: Array<{
    title: string;
    url: string;
    publishedAt: string | null;
  }>;
};

export type NewsFeedSubscription = {
  id: string;
  sourceKey: string;
  name: string;
  feedUrl: string;
  siteUrl: string;
  format: "rss" | "atom";
  enabled: boolean;
  lang: string;
  topic: string;
  itemCount: number;
  lastFetchedAt: string | null;
  lastFetchStatus: "idle" | "succeeded" | "failed";
  lastFetchError: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getNewsHubOverview(params?: {
  limit?: number;
  sourceKey?: string;
  query?: string;
}) {
  const search = new URLSearchParams();
  if (typeof params?.limit === "number") {
    search.set("limit", String(params.limit));
  }
  if (params?.sourceKey) {
    search.set("sourceKey", params.sourceKey);
  }
  if (params?.query) {
    search.set("q", params.query);
  }

  const suffix = search.size > 0 ? `?${search.toString()}` : "";
  return get<NewsHubOverview>(`/microapps/news-hub/overview${suffix}`);
}

export async function refreshNewsHub() {
  return post<NewsHubRefreshResult>("/microapps/news-hub/refresh");
}

export async function getNewsHubConfig() {
  return get<NewsHubConfig>("/microapps/news-hub/config");
}

export async function saveNewsHubConfig(payload: NewsHubConfig) {
  return put<NewsHubConfig>("/microapps/news-hub/config", payload);
}

export async function detectNewsFeed(url: string) {
  const result = await post<{ candidates: NewsFeedCandidate[] }>(
    "/microapps/news-hub/feeds/detect",
    { url },
  );
  return result.candidates;
}

export async function listNewsFeedSubscriptions() {
  return get<NewsFeedSubscription[]>("/microapps/news-hub/feeds");
}

export async function createNewsFeedSubscription(payload: {
  feedUrl: string;
  name?: string;
  lang?: string;
  topic?: string;
}) {
  return post<NewsFeedSubscription>("/microapps/news-hub/feeds", payload);
}

export async function updateNewsFeedSubscription(
  id: string,
  payload: { name?: string; enabled?: boolean; lang?: string; topic?: string },
) {
  return patch<NewsFeedSubscription>(`/microapps/news-hub/feeds/${id}`, payload);
}

export async function refreshNewsFeedSubscription(id: string) {
  return post<NewsHubRefreshResult>(`/microapps/news-hub/feeds/${id}/refresh`);
}

export async function deleteNewsFeedSubscription(id: string) {
  return del<{ id: string; sourceKey: string; deletedItemCount: number }>(
    `/microapps/news-hub/feeds/${id}`,
  );
}
