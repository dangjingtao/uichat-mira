import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSqlite, resetDatabaseClients } from "@/db/index.js";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";
import { newsHubSettingsRepository } from "./news-hub-settings.repository.js";

describe("newsHubSettingsRepository", () => {
  let databaseUrl: string;

  beforeEach(() => {
    databaseUrl = `file:${createTimestampedTestArtifactPath("db", "tmp-news-hub-settings", ".sqlite")}`;
    process.env.DATABASE_URL = databaseUrl;
    resetDatabaseClients();
    getSqlite();
    newsHubSettingsRepository.initialize();
  });

  afterEach(() => {
    resetDatabaseClients();
    delete process.env.DATABASE_URL;
  });

  it("persists settings across repository reinitialization", () => {
    const saved = newsHubSettingsRepository.update({
      newsDataEnabled: true,
      newsDataApiKey: "newsdata-key",
      currentsEnabled: true,
      currentsApiKey: "currents-key",
      redditEnabled: true,
      redditClientId: "reddit-client-id",
      redditClientSecret: "reddit-client-secret",
      redditUserAgent: "UIChat-Mira-NewsHub/0.3",
      redditSubreddits: "technology+ai",
      refreshTtlMinutes: 180,
    });

    expect(saved).toMatchObject({
      newsDataEnabled: true,
      newsDataApiKey: "newsdata-key",
      currentsEnabled: true,
      currentsApiKey: "currents-key",
      redditEnabled: true,
      redditClientId: "reddit-client-id",
      redditClientSecret: "reddit-client-secret",
      redditUserAgent: "UIChat-Mira-NewsHub/0.3",
      redditSubreddits: "technology+ai",
      refreshTtlMinutes: 180,
    });

    resetDatabaseClients();
    process.env.DATABASE_URL = databaseUrl;
    getSqlite();
    newsHubSettingsRepository.initialize();

    expect(newsHubSettingsRepository.get()).toEqual(saved);
  });
});
