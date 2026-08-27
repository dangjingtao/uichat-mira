import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDatabaseClients } from "@/db/index.js";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";
import { newsFeedSubscriptionsRepository } from "./news-feed-subscriptions.repository.js";

describe("newsFeedSubscriptionsRepository", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `file:${createTimestampedTestArtifactPath("db", "news-feed-subscriptions", ".sqlite")}`;
    resetDatabaseClients();
    newsFeedSubscriptionsRepository.initialize();
  });
  afterEach(() => {
    resetDatabaseClients();
    delete process.env.DATABASE_URL;
  });

  it("creates, updates and deletes a subscription", () => {
    const created = newsFeedSubscriptionsRepository.create({
      name: "Example", feedUrl: "https://example.com/feed.xml", siteUrl: "https://example.com/",
      format: "rss", enabled: true, lang: "en", topic: "technology",
    });
    expect(created.sourceKey).toBe(`rss:${created.id}`);
    expect(newsFeedSubscriptionsRepository.getByFeedUrl(created.feedUrl)?.id).toBe(created.id);

    const updated = newsFeedSubscriptionsRepository.update(created.id, {
      name: "Renamed", enabled: false, topic: "engineering",
    });
    expect(updated).toMatchObject({ name: "Renamed", enabled: false, topic: "engineering" });
    expect(newsFeedSubscriptionsRepository.delete(created.id)?.id).toBe(created.id);
    expect(newsFeedSubscriptionsRepository.list()).toEqual([]);
  });
});
