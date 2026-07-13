import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSqlite, resetDatabaseClients } from "@/db/index.js";
import { microAppsRepository } from "@/db/repositories/micro-apps.repository.js";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";
import { microAppRuntime } from "../runtime.js";

describe("evolving-knowledge shared registry", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `file:${createTimestampedTestArtifactPath("db", "tmp-evolving-knowledge-registry", ".sqlite")}`;
    resetDatabaseClients();
    getSqlite();
    microAppsRepository.initialize();
  });

  afterEach(() => {
    resetDatabaseClients();
    delete process.env.DATABASE_URL;
  });

  it("seeds evolving_knowledge definition", () => {
    const seeded = microAppsRepository.getByType("evolving_knowledge");

    expect(seeded).toMatchObject({
      type: "evolving_knowledge",
      runtimeKey: "evolving_knowledge",
      supportedAccessPoints: ["desktop.evolving_knowledge_studio"],
      enabled: true,
    });

    const definition = microAppRuntime.getDefinition("evolving_knowledge");
    expect(definition).toMatchObject({
      type: "evolving_knowledge",
      runtimeKey: "evolving_knowledge",
      supportedAccessPoints: ["desktop.evolving_knowledge_studio"],
    });
  });

  it("invoke returns studio-only error", async () => {
    const definition = microAppRuntime.getDefinition("evolving_knowledge");
    expect(definition).toBeDefined();

    const result = await definition!.invoke(
      {} as any,
      {} as any,
      { provider: "wecom", accessPointType: "wecom.smart_robot" } as any,
    );

    expect(result).toMatchObject({
      mode: "error",
      errorCode: "evolving_knowledge_studio_only",
    });
  });
});
