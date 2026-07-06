import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/request", () => ({
  get: vi.fn(),
  post: vi.fn(),
}));

import { get, post } from "@/shared/lib/request";
import { getNewsHubOverview, refreshNewsHub } from "../newsHub";

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
      sourceKey: "github-release:openai/openai-node",
      query: "agent sdk",
    });

    expect(get).toHaveBeenCalledWith(
      "/microapps/news-hub/overview?limit=20&sourceKey=github-release%3Aopenai%2Fopenai-node&q=agent+sdk",
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
});
