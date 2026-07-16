import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSqlite, resetDatabaseClients } from "@/db/index.js";
import {
  CURRENT_MICRO_APP_DEFINITION_SCHEMA_VERSION,
  microAppsRepository,
} from "./micro-apps.repository.js";
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
    expect(restored?.definitionSchemaVersion).toBe(
      CURRENT_MICRO_APP_DEFINITION_SCHEMA_VERSION,
    );
  });

  it("seeds every default definition with the current version", () => {
    microAppsRepository.initialize();
    expect(
      microAppsRepository.list().every(
        (definition) =>
          definition.definitionSchemaVersion ===
          CURRENT_MICRO_APP_DEFINITION_SCHEMA_VERSION,
      ),
    ).toBe(true);
  });

  it("returns every known seed through list and getByType with visible card metadata", () => {
    microAppsRepository.initialize();
    const expected = {
      knowledge_query: {
        accessPoint: "wecom.smart_robot",
        runtimeKey: "knowledge-query",
        bindingKeys: ["knowledgeBaseId"],
      },
      news_hub: {
        accessPoint: "desktop.news_hub",
        runtimeKey: "news_hub",
        bindingKeys: [],
      },
      image_generation: {
        accessPoint: "desktop.image_generation_studio",
        runtimeKey: "image_generation",
        bindingKeys: [
          "providerId",
          "model",
          "defaultSize",
          "defaultStylePreset",
          "workflowRunnerProfile",
        ],
      },
      computer_use: {
        accessPoint: "desktop.computer_use_studio",
        runtimeKey: "computer_use",
        bindingKeys: [
          "defaultStartUrl",
          "allowedOrigins",
          "requireApprovalForExternalNavigation",
        ],
      },
      tts: {
        accessPoint: "desktop.tts_studio",
        runtimeKey: "tts",
        bindingKeys: ["defaultProviderId"],
      },
      codegraph: {
        accessPoint: "desktop.codegraph_studio",
        runtimeKey: "codegraph",
        bindingKeys: ["command", "appDataRoot"],
      },
      evolving_knowledge: {
        accessPoint: "desktop.evolving_knowledge_studio",
        runtimeKey: "evolving_knowledge",
        bindingKeys: [],
      },
    } as const;

    const definitions = microAppsRepository.list();
    expect(definitions.map((definition) => definition.type).sort()).toEqual(
      Object.keys(expected).sort(),
    );

    for (const [type, contract] of Object.entries(expected)) {
      const fromList = definitions.find((definition) => definition.type === type);
      const fromType = microAppsRepository.getByType(type as keyof typeof expected);
      expect(fromType).toEqual(fromList);
      expect(fromType).toMatchObject({
        type,
        enabled: true,
        definitionSchemaVersion: CURRENT_MICRO_APP_DEFINITION_SCHEMA_VERSION,
        supportedAccessPoints: [contract.accessPoint],
        runtimeKey: contract.runtimeKey,
      });
      expect(fromType?.bindingSchema.fields.map((field) => field.key)).toEqual(
        contract.bindingKeys,
      );
    }
  });

  it("migrates non-empty stale system fields without overwriting user fields", () => {
    microAppsRepository.initialize();
    const current = microAppsRepository.getByType("knowledge_query");
    getSqlite().prepare(`
      UPDATE micro_app_definitions
      SET name = ?, enabled = 0, description = ?, supported_access_points_json = ?,
          binding_schema_json = ?, runtime_key = ?, definition_schema_version = 0
      WHERE id = ?
    `).run("用户名称", "旧描述", '["wecom.webhook_robot"]', '{"fields":[]}', "old-key", current?.id);

    microAppsRepository.initialize();
    expect(microAppsRepository.getByType("knowledge_query")).toMatchObject({
      name: "用户名称",
      enabled: false,
      description: expect.not.stringContaining("旧描述"),
      supportedAccessPoints: ["wecom.smart_robot"],
      runtimeKey: "knowledge-query",
      definitionSchemaVersion: 1,
    });
  });

  it("is idempotent at the current version and preserves unknown types", () => {
    microAppsRepository.initialize();
    const sqlite = getSqlite();
    sqlite.prepare(`
      INSERT INTO micro_app_definitions (type, name, description, definition_schema_version)
      VALUES (?, ?, ?, ?)
    `).run("vendor_custom", "Custom", "User definition", 0);
    const before = sqlite.prepare("SELECT * FROM micro_app_definitions WHERE type = ?").get("knowledge_query");

    microAppsRepository.initialize();
    microAppsRepository.initialize();

    expect(sqlite.prepare("SELECT * FROM micro_app_definitions WHERE type = ?").get("knowledge_query")).toMatchObject({
      id: (before as { id: string }).id,
      definition_schema_version: 1,
    });
    expect(microAppsRepository.list().find((definition) => definition.type === "vendor_custom")).toMatchObject({
      type: "vendor_custom",
      name: "Custom",
      description: "User definition",
      definitionSchemaVersion: 0,
    });
  });

  it("fails explicitly and rolls back all definition updates on invalid JSON", () => {
    microAppsRepository.initialize();
    const sqlite = getSqlite();
    const current = microAppsRepository.getByType("knowledge_query");
    const news = microAppsRepository.getByType("news_hub");
    getSqlite().prepare(`
      UPDATE micro_app_definitions
      SET description = ?, definition_schema_version = 0
      WHERE id = ?
    `).run("old knowledge description", current?.id);
    sqlite.prepare(`
      UPDATE micro_app_definitions
      SET supported_access_points_json = ?, definition_schema_version = 0
      WHERE id = ?
    `).run("{invalid", news?.id);

    expect(() => microAppsRepository.initialize()).toThrow(/Cannot migrate micro-app definition JSON/);
    expect(
      sqlite
        .prepare("SELECT description, definition_schema_version FROM micro_app_definitions WHERE id = ?")
        .get(current?.id),
    ).toMatchObject({
      description: "old knowledge description",
      definition_schema_version: 0,
    });
    expect(
      sqlite
        .prepare("SELECT supported_access_points_json, definition_schema_version FROM micro_app_definitions WHERE id = ?")
        .get(news?.id),
    ).toMatchObject({
      supported_access_points_json: "{invalid",
      definition_schema_version: 0,
    });
  });
});
