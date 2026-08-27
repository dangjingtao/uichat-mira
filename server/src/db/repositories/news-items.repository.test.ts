import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSqlite, resetDatabaseClients } from "@/db/index.js";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";
import { newsItemsRepository } from "./news-items.repository.js";

const createItem = (input: {
  sourceKey: string;
  sourceName: string;
  externalId: string;
  publishedAt: string;
}) => ({
  sourceType: "api",
  sourceName: input.sourceName,
  sourceKey: input.sourceKey,
  externalId: input.externalId,
  title: input.externalId,
  summary: "",
  contentText: "",
  url: `https://example.com/${input.externalId}`,
  author: null,
  publishedAt: input.publishedAt,
  lang: "en",
  topic: "technology",
  tags: [],
  rawPayload: {},
});

describe("newsItemsRepository published time ordering", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `file:${createTimestampedTestArtifactPath("db", "news-time-order", ".sqlite")}`;
    resetDatabaseClients();
    newsItemsRepository.initialize();
  });

  afterEach(() => {
    resetDatabaseClients();
    delete process.env.DATABASE_URL;
  });

  it("normalizes provider date formats before sorting recent items", () => {
    newsItemsRepository.upsertMany([
      createItem({
        sourceKey: "github-changelog",
        sourceName: "GitHub Changelog",
        externalId: "github-older",
        publishedAt: "Wed, 22 Jul 2026 16:21:47 +0000",
      }),
      createItem({
        sourceKey: "hn-frontpage",
        sourceName: "Hacker News Front Page",
        externalId: "hn-newer",
        publishedAt: "2026-07-29T13:01:57Z",
      }),
      createItem({
        sourceKey: "currents",
        sourceName: "Currents API",
        externalId: "currents-newest",
        publishedAt: "2026-07-29 14:04:20 +0000",
      }),
    ]);

    const items = newsItemsRepository.listRecent({ limit: 3 }).items;

    expect(items.map((item) => item.externalId)).toEqual([
      "currents-newest",
      "hn-newer",
      "github-older",
    ]);
    expect(items.map((item) => item.publishedAt)).toEqual([
      "2026-07-29T14:04:20.000Z",
      "2026-07-29T13:01:57.000Z",
      "2026-07-22T16:21:47.000Z",
    ]);
  });

  it("migrates existing mixed-format dates when the repository initializes", () => {
    const sqlite = getSqlite();
    sqlite
      .prepare(`
        INSERT INTO news_items (
          id, source_type, source_name, source_key, external_id, title, url, published_at
        ) VALUES (?, 'rss', 'GitHub Changelog', 'github-changelog', ?, ?, ?, ?)
      `)
      .run(
        "legacy-github",
        "legacy-github",
        "Legacy GitHub item",
        "https://example.com/legacy-github",
        "Wed, 22 Jul 2026 16:21:47 +0000",
      );

    resetDatabaseClients();
    newsItemsRepository.initialize();

    expect(newsItemsRepository.listRecent({ limit: 1 }).items[0]?.publishedAt).toBe(
      "2026-07-22T16:21:47.000Z",
    );
  });
});
