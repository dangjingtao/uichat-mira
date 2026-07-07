import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/request", () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));

import { get, post } from "@/shared/lib/request";
import { put } from "@/shared/lib/request";
import {
  getNewsHubConfig,
  getNewsHubOverview,
  refreshNewsHub,
  saveNewsHubConfig,
} from "../newsHub";

describe("news hub api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gets overview with encoded query params", async () => {
    vi.mocked(get).mockResolvedValueOnce({
      sources: [],
      items: [],
      total: 0,
      generatedAt: "2026-07-06T12:00:00.000Z",
    });

    await getNewsHubOverview({
      limit: 20,
      sourceKey: "github-changelog",
      query: "agent sdk",
    });

    expect(get).toHaveBeenCalledWith(
      "/microapps/news-hub/overview?limit=20&sourceKey=github-changelog&q=agent+sdk",
    );
  });

  it("posts refresh requests to the shared route", async () => {
    vi.mocked(post).mockResolvedValueOnce({
      startedAt: "2026-07-06T12:00:00.000Z",
      finishedAt: "2026-07-06T12:00:02.000Z",
      fetchedCount: 8,
      insertedCount: 8,
      updatedCount: 0,
      sources: [],
    });

    await refreshNewsHub();

    expect(post).toHaveBeenCalledWith("/microapps/news-hub/refresh");
  });

  it("loads the news hub config", async () => {
    vi.mocked(get).mockResolvedValueOnce({
      newsDataEnabled: false,
      newsDataApiKey: "",
      currentsEnabled: true,
      currentsApiKey: "currents-key",
      redditEnabled: false,
      redditClientId: "",
      redditClientSecret: "",
      redditUserAgent: "UIChat-Mira-NewsHub/0.1",
      redditSubreddits: "technology",
      refreshTtlMinutes: 60,
    });

    await getNewsHubConfig();

    expect(get).toHaveBeenCalledWith("/microapps/news-hub/config");
  });

  it("saves the news hub config", async () => {
    const payload = {
      newsDataEnabled: true,
      newsDataApiKey: "newsdata-key",
      currentsEnabled: true,
      currentsApiKey: "currents-key",
      redditEnabled: true,
      redditClientId: "reddit-client-id",
      redditClientSecret: "reddit-client-secret",
      redditUserAgent: "UIChat-Mira-NewsHub/0.2",
      redditSubreddits: "technology+artificial",
      refreshTtlMinutes: 60,
    };
    vi.mocked(put).mockResolvedValueOnce(payload);

    await saveNewsHubConfig(payload);

    expect(put).toHaveBeenCalledWith("/microapps/news-hub/config", payload);
  });
});
