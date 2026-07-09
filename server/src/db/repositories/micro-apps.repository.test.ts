import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSqlite, resetDatabaseClients } from "@/db/index.js";
import { microAppsRepository } from "./micro-apps.repository.js";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";

describe("microAppsRepository.initialize", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `file:${createTimestampedTestArtifactPath("db", "tmp-micro-apps-repository", ".sqlite")}`;
    resetDatabaseClients();
  });

  afterEach(() => {
    resetDatabaseClients();
    delete process.env.DATABASE_URL;
  });

  it("backfills stale knowledge_query definitions so the settings card remains visible", () => {
    const sqlite = getSqlite();
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS micro_app_definitions (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        supported_access_points_json TEXT NOT NULL DEFAULT '[]',
        binding_schema_json TEXT NOT NULL DEFAULT '{"fields":[]}',
        runtime_key TEXT NOT NULL DEFAULT '',
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    sqlite.exec(`
      INSERT INTO micro_app_definitions (
        id,
        type,
        name,
        description,
        supported_access_points_json,
        binding_schema_json,
        runtime_key,
        enabled
      ) VALUES (
        'stale-knowledge-query',
        'knowledge_query',
        'Knowledge Query',
        '',
        '[]',
        '{"fields":[]}',
        '',
        1
      )
    `);

    microAppsRepository.initialize();

    const restored = microAppsRepository.getByType("knowledge_query");
    expect(restored).toMatchObject({
      id: "stale-knowledge-query",
      type: "knowledge_query",
      runtimeKey: "knowledge-query",
      supportedAccessPoints: ["wecom.smart_robot"],
    });
    expect(restored?.description.length).toBeGreaterThan(0);
    expect(restored?.bindingSchema.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "knowledgeBaseId",
          type: "knowledge_base_select",
          required: true,
        }),
      ]),
    );
  });
});
