import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSqlite, resetDatabaseClients } from "@/db/index.js";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";
import { newsItemsRepository } from "@/db/repositories/news-items.repository.js";
import { newsItemsVectorRepository } from "@/db/repositories/news-items-vector.repository.js";
import { newsHubSettingsRepository } from "@/db/repositories/news-hub-settings.repository.js";
import { createNewsHubService } from "./index.js";
import { searchNewsHubCache } from "./news-search.adapter.js";

const modelMock = vi.hoisted(() => ({
  executeLocalEmbedding: vi.fn(),
  executeLocalRerank: vi.fn(),
}));
vi.mock("@/services/internal-capabilities/local-embedding.js", () => modelMock);
vi.mock("@/services/internal-capabilities/local-rerank.js", () => modelMock);

describe("news search adapter", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `file:${createTimestampedTestArtifactPath("db", "tmp-news-search", ".sqlite")}`;
    resetDatabaseClients();
    getSqlite();
    newsItemsRepository.initialize();
    newsItemsVectorRepository.initialize();
    newsHubSettingsRepository.initialize();
    newsItemsRepository.upsertMany([
      {
        sourceType: "rss",
        sourceName: "GitHub Changelog",
        sourceKey: "github-changelog",
        externalId: "release-1",
        title: "AI release news",
        summary: "A cached release",
        contentText: "The release adds AI support.",
        url: "https://example.com/release-1",
        author: null,
        publishedAt: "2026-07-14T00:00:00.000Z",
        lang: "en",
        topic: "developer-platform",
        tags: ["github", "changelog"],
        rawPayload: {},
      },
    ]);
    modelMock.executeLocalEmbedding.mockResolvedValue({
      embeddings: [[1, 0]],
      embeddingModel: "test-model",
      embeddingModelConfigId: "test-config",
    });
    modelMock.executeLocalRerank.mockResolvedValue({
      rerankedCandidates: [],
    });
  });

  afterEach(() => {
    resetDatabaseClients();
    delete process.env.DATABASE_URL;
    vi.clearAllMocks();
  });

  it("reads cached news and preserves source metadata without refreshing", async () => {
    const result = await searchNewsHubCache({ query: "AI release news", maxResults: 4 });
    expect(result.results[0]).toMatchObject({
      title: "AI release news",
      link: "https://example.com/release-1",
      metadata: {
        provider: "local_news_hub",
        sourceKey: "github-changelog",
        publishedAt: "2026-07-14T00:00:00.000Z",
      },
    });
    expect(modelMock.executeLocalEmbedding).not.toHaveBeenCalled();
    expect(result.diagnostics.keyword).toBe(1);
    expect(result.diagnostics.vector).toBe(0);
  });

  it("merges a stored vector candidate with keyword recall", async () => {
    const item = newsItemsRepository.listRecent({ limit: 1 }).items[0];
    newsItemsVectorRepository.upsertMany([{ newsItemId: item.id, embedding: [1, 0], model: "test", modelConfigId: "test" }]);
    modelMock.executeLocalEmbedding.mockResolvedValue({
      embeddings: [[1, 0]],
      embeddingModel: "test",
      embeddingModelConfigId: "test",
    });
    modelMock.executeLocalRerank.mockRejectedValue(new Error("rerank unavailable"));

    const result = await searchNewsHubCache({ query: "semantic release", maxResults: 4 });
    expect(result.diagnostics.vector).toBe(1);
    expect(result.diagnostics.embedding).toBe("used");
    expect(result.diagnostics.rerank).toBe("unavailable");
  });

  it("keeps cached overview read-only and does not refresh sources", async () => {
    const service = createNewsHubService();
    const deleteSpy = vi.spyOn(newsItemsRepository, "deleteBySourceKeysExcluding");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await service.getCachedOverview({ limit: 1 });

    expect(deleteSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
