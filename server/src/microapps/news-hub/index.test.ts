import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDatabaseClients } from "@/db/index.js";
import {
  newsFeedSubscriptionsRepository,
  newsHubSettingsRepository,
  newsItemsRepository,
} from "@/db/repositories/index.js";
import { newsItemsVectorRepository } from "@/db/repositories/news-items-vector.repository.js";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";
import {
  createNewsHubService,
  createSourceDefinitions,
  resolveSourceFetchKind,
} from "./index.js";

describe("NewsHub source definitions", () => {
  it("uses a NewsData.io page size supported by free and paid plans", () => {
    const source = createSourceDefinitions().find((item) => item.key === "newsdata");

    expect(source).toBeDefined();
    expect(new URL(source!.fetchUrl).searchParams.get("size")).toBe("10");
  });

  it("routes dynamic RSS and Atom subscriptions through the feed parser", () => {
    expect(resolveSourceFetchKind({
      key: "rss:subscription-id",
      name: "Example Atom",
      sourceType: "rss",
      fetchUrl: "https://example.com/atom.xml",
      siteUrl: "https://example.com/",
      topic: "technology",
      lang: "en",
      tags: ["subscription", "atom"],
      isEnabled: () => true,
    })).toBe("rss");
  });
});

describe("NewsHub feed subscription deletion", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `file:${createTimestampedTestArtifactPath("db", "news-feed-delete", ".sqlite")}`;
    resetDatabaseClients();
    newsHubSettingsRepository.initialize();
    newsFeedSubscriptionsRepository.initialize();
    newsItemsRepository.initialize();
  });

  afterEach(() => {
    resetDatabaseClients();
    delete process.env.DATABASE_URL;
  });

  it("removes the subscription, its articles, vectors and source state", () => {
    const subscription = newsFeedSubscriptionsRepository.create({
      name: "Example", feedUrl: "https://example.com/feed.xml", siteUrl: "https://example.com/",
      format: "rss", enabled: true, lang: "en", topic: "technology",
    });
    newsItemsRepository.upsertMany([{
      sourceType: "rss", sourceName: subscription.name, sourceKey: subscription.sourceKey,
      externalId: "post-1", title: "Post", summary: "Summary", contentText: "Body",
      url: "https://example.com/post-1", author: null, publishedAt: "2026-07-30T08:00:00Z",
      lang: "en", topic: "technology", tags: [], rawPayload: {},
    }]);
    const item = newsItemsRepository.listRecent({ sourceKey: subscription.sourceKey }).items[0]!;
    newsItemsVectorRepository.upsertMany([{ newsItemId: item.id, embedding: [0.1], model: "test", modelConfigId: "test" }]);
    newsHubSettingsRepository.upsertSourceState({
      sourceKey: subscription.sourceKey, lastStatus: "succeeded", lastError: null,
    });
    const onContentChanged = vi.fn();

    const result = createNewsHubService({ onContentChanged }).deleteFeedSubscription(subscription.id);

    expect(result.deletedItemCount).toBe(1);
    expect(newsFeedSubscriptionsRepository.getById(subscription.id)).toBeNull();
    expect(newsItemsRepository.listRecent({ sourceKey: subscription.sourceKey }).total).toBe(0);
    expect(newsItemsVectorRepository.listAll()).toEqual([]);
    expect(newsHubSettingsRepository.getSourceState(subscription.sourceKey)).toBeNull();
    expect(onContentChanged).toHaveBeenCalledTimes(1);
  });
});
