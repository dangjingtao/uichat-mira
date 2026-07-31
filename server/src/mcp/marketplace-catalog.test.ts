import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { createMcpMarketplaceRepository } from "@/db/repositories/mcp-marketplace.repository.js";
import {
  createMcpMarketplaceCatalog,
  MCP_MARKETPLACE_SOURCE_URL,
} from "./marketplace-catalog.js";
import type {
  FetchMcpMarketplaceServersInput,
  McpMarketplaceRegistryEntry,
  McpMarketplaceServer,
} from "./marketplace.js";

const server = (
  id: string,
  overrides: Partial<McpMarketplaceServer> = {},
): McpMarketplaceServer => ({
  id,
  name: id,
  title: id,
  description: "",
  version: "1.0.0",
  status: "active",
  isLatest: true,
  publishedAt: null,
  updatedAt: "2026-07-31T00:00:00.000Z",
  websiteUrl: null,
  repositoryUrl: null,
  transports: [],
  ...overrides,
});

const entry = (
  id: string,
  overrides: Partial<McpMarketplaceServer> = {},
): McpMarketplaceRegistryEntry => ({
  server: server(id, overrides),
  raw: { server: { name: id } },
});

describe("MCP marketplace catalog", () => {
  it("persists a full snapshot and queries local search, category, and transport", () => {
    const sqlite = new Database(":memory:");
    const repository = createMcpMarketplaceRepository(sqlite);
    const syncedAt = "2026-07-31T00:00:00.000Z";
    repository.upsertPage(MCP_MARKETPLACE_SOURCE_URL, [
      {
        server: server("docs", {
          title: "Docs Search",
          description: "Search documentation",
          transports: [
            {
              kind: "streamable-http",
              packageType: "remote",
              installable: true,
              label: "Remote HTTP",
              url: "https://example.test/mcp",
            },
          ],
        }),
        sourceUrl: MCP_MARKETPLACE_SOURCE_URL,
        category: "search-knowledge",
        categorySource: "inferred",
        categoryRuleVersion: 1,
        deleted: false,
        syncedAt,
      },
      {
        server: server("hidden", { status: "deleted" }),
        sourceUrl: MCP_MARKETPLACE_SOURCE_URL,
        category: "other",
        categorySource: "uncategorized",
        categoryRuleVersion: 1,
        deleted: true,
        syncedAt,
      },
    ], 100);
    const result = repository.list(MCP_MARKETPLACE_SOURCE_URL, {
      limit: 20,
      query: "documentation",
      category: "search-knowledge",
      transport: "remote",
      installable: true,
    });
    expect(result.servers.map((item) => item.id)).toEqual(["docs"]);
    expect(repository.countVisible(MCP_MARKETPLACE_SOURCE_URL)).toBe(1);
    sqlite.close();
  });

  it("shares one sync task and never follows the Registry cursor past 100 entries", async () => {
    const sqlite = new Database(":memory:");
    const repository = createMcpMarketplaceRepository(sqlite);
    const seenCursors: Array<string | undefined> = [];
    const catalog = createMcpMarketplaceCatalog({
      repository,
      now: () => new Date("2026-07-31T01:00:00.000Z"),
      fetchPage: async (input) => {
        seenCursors.push(input.cursor);
        return { entries: [entry("first")], nextCursor: "page-2" };
      },
    });

    const first = catalog.requestSync();
    const second = catalog.requestSync();
    expect(first.task).toBe(second.task);
    await first.task;

    expect(seenCursors).toEqual([undefined]);
    expect(
      catalog.list({ limit: 20 }).servers.map((item) => item.id),
    ).toEqual(["first"]);
    expect(catalog.getStatus()).toMatchObject({
      status: "idle",
      mode: "full",
      updatedCount: 1,
    });
    sqlite.close();
  });

  it("migrates raw_json away and enforces the local entry budget", () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(`
      CREATE TABLE mcp_marketplace_servers (
        source_url TEXT NOT NULL,
        id TEXT NOT NULL,
        name TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        version TEXT,
        registry_status TEXT,
        is_latest INTEGER,
        published_at TEXT,
        registry_updated_at TEXT,
        website_url TEXT,
        repository_url TEXT,
        transports_json TEXT NOT NULL DEFAULT '[]',
        search_text TEXT NOT NULL DEFAULT '',
        transport_family TEXT NOT NULL DEFAULT 'unknown',
        installable INTEGER NOT NULL DEFAULT 0,
        raw_json TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'other',
        category_source TEXT NOT NULL DEFAULT 'uncategorized',
        category_rule_version INTEGER NOT NULL DEFAULT 1,
        deleted INTEGER NOT NULL DEFAULT 0,
        synced_at TEXT NOT NULL,
        PRIMARY KEY (source_url, id)
      );
      CREATE TABLE mcp_marketplace_sync_state (
        source_url TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'idle',
        mode TEXT,
        last_attempt_at TEXT,
        last_successful_sync_at TEXT,
        last_full_sync_at TEXT,
        watermark TEXT,
        continuation_cursor TEXT,
        updated_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT
      );
    `);
    const repository = createMcpMarketplaceRepository(sqlite);
    const columns = sqlite
      .prepare("PRAGMA table_info(mcp_marketplace_servers)")
      .all() as Array<{ name: string }>;
    expect(columns.some((column) => column.name === "raw_json")).toBe(false);
    const syncColumns = sqlite
      .prepare("PRAGMA table_info(mcp_marketplace_sync_state)")
      .all() as Array<{ name: string }>;
    expect(
      syncColumns.some((column) => column.name === "continuation_cursor"),
    ).toBe(false);

    const records = Array.from({ length: 101 }, (_, index) => ({
      server: server(`server-${index}`, {
        status: index === 0 ? "deleted" : "active",
      }),
      sourceUrl: MCP_MARKETPLACE_SOURCE_URL,
      category: "other",
      categorySource: "uncategorized" as const,
      categoryRuleVersion: 1,
      deleted: index === 0,
      syncedAt: `2026-07-31T00:00:${String(index).padStart(2, "0")}.000Z`,
    }));
    repository.upsertPage(MCP_MARKETPLACE_SOURCE_URL, records, 100);

    expect(repository.countTotal(MCP_MARKETPLACE_SOURCE_URL)).toBe(100);
    expect(
      repository
        .list(MCP_MARKETPLACE_SOURCE_URL, { limit: 25 })
        .servers.some((item) => item.id === "server-0"),
    ).toBe(false);
    sqlite.close();
  });

  it("uses an overlapped incremental watermark, handles deletes, and retains data on failure", async () => {
    const sqlite = new Database(":memory:");
    const repository = createMcpMarketplaceRepository(sqlite);
    const seedCatalog = createMcpMarketplaceCatalog({
      repository,
      now: () => new Date("2026-07-31T00:00:00.000Z"),
      fetchPage: async () => ({ entries: [entry("existing")], nextCursor: null }),
    });
    await seedCatalog.requestSync("full").task;

    let incrementalInput:
      | Omit<FetchMcpMarketplaceServersInput, "query">
      | undefined;
    const incrementalCatalog = createMcpMarketplaceCatalog({
      repository,
      now: () => new Date("2026-07-31T06:00:00.000Z"),
      fetchPage: async (input) => {
        incrementalInput = input;
        return {
          entries: [entry("existing", { status: "deleted" })],
          nextCursor: null,
        };
      },
    });
    await incrementalCatalog.requestSync("incremental").task;

    expect(incrementalInput).toMatchObject({
      includeDeleted: true,
      updatedSince: "2026-07-30T23:55:00.000Z",
    });
    expect(
      repository.list(MCP_MARKETPLACE_SOURCE_URL, { limit: 20 }).servers,
    ).toEqual([]);

    repository.upsertPage(MCP_MARKETPLACE_SOURCE_URL, [
      {
        server: server("retained"),
        sourceUrl: MCP_MARKETPLACE_SOURCE_URL,
        category: "other",
        categorySource: "uncategorized",
        categoryRuleVersion: 1,
        deleted: false,
        syncedAt: "2026-07-31T06:00:00.000Z",
      },
    ], 100);
    expect(
      repository.list(MCP_MARKETPLACE_SOURCE_URL, { limit: 20 }).servers[0]?.id,
    ).toBe("retained");
    const failedCatalog = createMcpMarketplaceCatalog({
      repository,
      now: () => new Date("2026-07-31T12:00:00.000Z"),
      fetchPage: async () => {
        throw new Error("registry unavailable");
      },
    });
    await failedCatalog.requestSync("incremental").task;
    expect(failedCatalog.getStatus()).toMatchObject({
      status: "failed",
      lastError: "registry unavailable",
    });
    expect(
      repository.list(MCP_MARKETPLACE_SOURCE_URL, { limit: 20 }).servers[0]?.id,
    ).toBe("retained");
    expect(failedCatalog.list({ limit: 20 }).servers[0]?.id).toBe("retained");
    sqlite.close();
  });

  it("supplements a local search miss from the Registry without exceeding the budget", async () => {
    const sqlite = new Database(":memory:");
    const repository = createMcpMarketplaceRepository(sqlite);
    repository.setSyncState({
      sourceUrl: MCP_MARKETPLACE_SOURCE_URL,
      status: "idle",
      mode: "full",
      lastAttemptAt: "2026-07-31T00:00:00.000Z",
      lastSuccessfulSyncAt: "2026-07-31T00:00:00.000Z",
      lastFullSyncAt: "2026-07-31T00:00:00.000Z",
      watermark: "2026-07-31T00:00:00.000Z",
      updatedCount: 1,
      lastError: null,
    });
    repository.upsertPage(
      MCP_MARKETPLACE_SOURCE_URL,
      [
        {
          server: server("existing"),
          sourceUrl: MCP_MARKETPLACE_SOURCE_URL,
          category: "other",
          categorySource: "uncategorized",
          categoryRuleVersion: 1,
          deleted: false,
          syncedAt: "2026-07-31T00:00:00.000Z",
        },
      ],
      100,
    );
    const seenQueries: Array<string | undefined> = [];
    const catalog = createMcpMarketplaceCatalog({
      repository,
      now: () => new Date("2026-07-31T01:00:00.000Z"),
      fetchPage: async (input) => {
        seenQueries.push(input.query);
        return {
          entries: input.query ? [entry("zeta-search")] : [],
          nextCursor: null,
        };
      },
    });

    expect(catalog.list({ limit: 20, query: "zeta" }).metadata.searchPending).toBe(
      true,
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(seenQueries).toEqual(["zeta"]);
    expect(
      catalog.list({ limit: 20, query: "zeta" }).servers[0]?.id,
    ).toBe("zeta-search");
    expect(repository.countTotal(MCP_MARKETPLACE_SOURCE_URL)).toBeLessThanOrEqual(
      100,
    );
    sqlite.close();
  });
});
