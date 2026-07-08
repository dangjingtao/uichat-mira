import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSqlite, resetDatabaseClients } from "@/db/index.js";
import {
  microAppsRepository,
  newsHubBindingSchema,
} from "@/db/repositories/micro-apps.repository.js";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";
import { microAppRuntime } from "../runtime.js";

describe("news_hub shared registry", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `file:${createTimestampedTestArtifactPath("db", "tmp-news-hub-registry", ".sqlite")}`;
    resetDatabaseClients();
    getSqlite();
    microAppsRepository.initialize();
  });

  afterEach(() => {
    resetDatabaseClients();
    delete process.env.DATABASE_URL;
  });

  it("seeds news_hub and exposes a stable runtime definition", () => {
    const seeded = microAppsRepository.getByType("news_hub");

    expect(seeded).toMatchObject({
      type: "news_hub",
      runtimeKey: "news_hub",
      supportedAccessPoints: ["desktop.news_hub"],
      enabled: true,
    });
    expect(seeded?.bindingSchema).toEqual(newsHubBindingSchema);

    const definition = microAppRuntime.getDefinition("news_hub");
    expect(definition).toMatchObject({
      type: "news_hub",
      runtimeKey: "news_hub",
      supportedAccessPoints: ["desktop.news_hub"],
    });
    expect(definition?.bindingSchema).toEqual(newsHubBindingSchema);
  });
});
