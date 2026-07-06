import { get, post } from "../lib/request";

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
  sources: Array<{
    key: string;
    name: string;
    fetchedCount: number;
    insertedCount: number;
    updatedCount: number;
    status: "succeeded" | "failed";
    error: string | null;
  }>;
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
