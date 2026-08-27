import type Database from "better-sqlite3";
import { getSqlite } from "../index.js";
import type {
  McpMarketplaceServer,
  McpMarketplaceTransport,
} from "@/mcp/marketplace.js";

export type MarketplaceCategorySource = "publisher" | "inferred" | "uncategorized";
export type MarketplaceSyncMode = "full" | "incremental";
export type MarketplaceSyncStatus = "idle" | "syncing" | "failed";

export type MarketplaceCatalogRecord = {
  server: McpMarketplaceServer;
  sourceUrl: string;
  category: string;
  categorySource: MarketplaceCategorySource;
  categoryRuleVersion: number;
  deleted: boolean;
  syncedAt: string;
};

export type MarketplaceCatalogQuery = {
  cursor?: string;
  limit: number;
  query?: string;
  category?: string;
  transport?: "remote" | "local";
  installable?: boolean;
};

export type MarketplaceSyncState = {
  sourceUrl: string;
  status: MarketplaceSyncStatus;
  mode: MarketplaceSyncMode | null;
  lastAttemptAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastFullSyncAt: string | null;
  watermark: string | null;
  updatedCount: number;
  lastError: string | null;
};

type Row = Record<string, unknown>;

const decodeCursor = (cursor?: string) => {
  if (!cursor) return 0;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      offset?: unknown;
    };
    return typeof value.offset === "number" &&
      Number.isInteger(value.offset) &&
      value.offset >= 0
      ? value.offset
      : 0;
  } catch {
    return 0;
  }
};

const encodeCursor = (offset: number) =>
  Buffer.from(JSON.stringify({ offset }), "utf8").toString("base64url");

const parseTransports = (value: unknown): McpMarketplaceTransport[] => {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as McpMarketplaceTransport[]) : [];
  } catch {
    return [];
  }
};

const toServer = (row: Row): McpMarketplaceServer => ({
  id: String(row.id),
  name: String(row.name),
  title: String(row.title),
  description: String(row.description),
  version: typeof row.version === "string" ? row.version : null,
  status: typeof row.registry_status === "string" ? row.registry_status : null,
  isLatest:
    row.is_latest === null || row.is_latest === undefined
      ? null
      : Number(row.is_latest) === 1,
  publishedAt: typeof row.published_at === "string" ? row.published_at : null,
  updatedAt:
    typeof row.registry_updated_at === "string" ? row.registry_updated_at : null,
  websiteUrl: typeof row.website_url === "string" ? row.website_url : null,
  repositoryUrl:
    typeof row.repository_url === "string" ? row.repository_url : null,
  transports: parseTransports(row.transports_json),
  category: String(row.category),
  categorySource: String(row.category_source) as MarketplaceCategorySource,
});

const ensureSchema = (sqlite: Database.Database) => {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mcp_marketplace_servers (
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
      category TEXT NOT NULL DEFAULT 'other',
      category_source TEXT NOT NULL DEFAULT 'uncategorized',
      category_rule_version INTEGER NOT NULL DEFAULT 1,
      deleted INTEGER NOT NULL DEFAULT 0,
      synced_at TEXT NOT NULL,
      PRIMARY KEY (source_url, id)
    );
    CREATE INDEX IF NOT EXISTS idx_mcp_marketplace_visible
      ON mcp_marketplace_servers (source_url, deleted, title, id);
    CREATE INDEX IF NOT EXISTS idx_mcp_marketplace_category
      ON mcp_marketplace_servers (source_url, deleted, category);
    CREATE INDEX IF NOT EXISTS idx_mcp_marketplace_transport
      ON mcp_marketplace_servers (source_url, deleted, transport_family, installable);
    CREATE TABLE IF NOT EXISTS mcp_marketplace_sync_state (
      source_url TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'idle',
      mode TEXT,
      last_attempt_at TEXT,
      last_successful_sync_at TEXT,
      last_full_sync_at TEXT,
      watermark TEXT,
      updated_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );
  `);

  const serverColumns = sqlite
    .prepare("PRAGMA table_info(mcp_marketplace_servers)")
    .all() as Array<{ name: string }>;
  if (serverColumns.some((column) => column.name === "raw_json")) {
    sqlite.exec("ALTER TABLE mcp_marketplace_servers DROP COLUMN raw_json");
  }

  const syncColumns = sqlite
    .prepare("PRAGMA table_info(mcp_marketplace_sync_state)")
    .all() as Array<{ name: string }>;
  if (syncColumns.some((column) => column.name === "continuation_cursor")) {
    sqlite.exec("ALTER TABLE mcp_marketplace_sync_state DROP COLUMN continuation_cursor");
  }
};

const getTransportFamily = (transports: McpMarketplaceTransport[]) => {
  const remote = transports.some((item) => item.kind === "streamable-http");
  const local = transports.some((item) => item.kind !== "streamable-http");
  return remote && local ? "mixed" : remote ? "remote" : local ? "local" : "unknown";
};

export const createMcpMarketplaceRepository = (
  sqlite: Database.Database = getSqlite(),
) => {
  ensureSchema(sqlite);
  const upsertStatement = sqlite.prepare(`
    INSERT INTO mcp_marketplace_servers (
      source_url, id, name, title, description, version, registry_status,
      is_latest, published_at, registry_updated_at, website_url, repository_url,
      transports_json, search_text, transport_family, installable,
      category, category_source, category_rule_version, deleted, synced_at
    ) VALUES (
      @sourceUrl, @id, @name, @title, @description, @version, @status,
      @isLatest, @publishedAt, @updatedAt, @websiteUrl, @repositoryUrl,
      @transportsJson, @searchText, @transportFamily, @installable,
      @category, @categorySource, @categoryRuleVersion, @deleted, @syncedAt
    )
    ON CONFLICT(source_url, id) DO UPDATE SET
      name=excluded.name, title=excluded.title, description=excluded.description,
      version=excluded.version, registry_status=excluded.registry_status,
      is_latest=excluded.is_latest, published_at=excluded.published_at,
      registry_updated_at=excluded.registry_updated_at,
      website_url=excluded.website_url, repository_url=excluded.repository_url,
      transports_json=excluded.transports_json, search_text=excluded.search_text,
      transport_family=excluded.transport_family, installable=excluded.installable,
      category=excluded.category,
      category_source=excluded.category_source,
      category_rule_version=excluded.category_rule_version,
      deleted=excluded.deleted, synced_at=excluded.synced_at
  `);

  const upsert = (record: MarketplaceCatalogRecord) => {
    const packageIds = record.server.transports
      .map((item) => ("packageIdentifier" in item ? item.packageIdentifier : ""))
      .filter(Boolean);
    upsertStatement.run({
      sourceUrl: record.sourceUrl,
      id: record.server.id,
      name: record.server.name,
      title: record.server.title,
      description: record.server.description,
      version: record.server.version,
      status: record.server.status,
      isLatest:
        record.server.isLatest === null ? null : record.server.isLatest ? 1 : 0,
      publishedAt: record.server.publishedAt,
      updatedAt: record.server.updatedAt,
      websiteUrl: record.server.websiteUrl,
      repositoryUrl: record.server.repositoryUrl,
      transportsJson: JSON.stringify(record.server.transports),
      searchText: [
        record.server.name,
        record.server.title,
        record.server.description,
        ...packageIds,
      ]
        .join("\n")
        .toLocaleLowerCase(),
      transportFamily: getTransportFamily(record.server.transports),
      installable: record.server.transports.some((item) => item.installable) ? 1 : 0,
      category: record.category,
      categorySource: record.categorySource,
      categoryRuleVersion: record.categoryRuleVersion,
      deleted: record.deleted ? 1 : 0,
      syncedAt: record.syncedAt,
    });
  };

  return {
    initialize() {
      ensureSchema(sqlite);
      sqlite
        .prepare(
          `UPDATE mcp_marketplace_sync_state
           SET status='failed', last_error=COALESCE(last_error, 'Previous sync was interrupted')
           WHERE status='syncing'`,
        )
        .run();
    },
    countVisible(sourceUrl: string) {
      const row = sqlite
        .prepare(
          "SELECT COUNT(*) AS count FROM mcp_marketplace_servers WHERE source_url=? AND deleted=0",
        )
        .get(sourceUrl) as { count: number };
      return Number(row.count);
    },
    countTotal(sourceUrl: string) {
      const row = sqlite
        .prepare(
          "SELECT COUNT(*) AS count FROM mcp_marketplace_servers WHERE source_url=?",
        )
        .get(sourceUrl) as { count: number };
      return Number(row.count);
    },
    list(sourceUrl: string, input: MarketplaceCatalogQuery) {
      const clauses = ["source_url=@sourceUrl", "deleted=0"];
      const params: Record<string, string | number> = { sourceUrl };
      if (input.query?.trim()) {
        clauses.push("search_text LIKE @query ESCAPE '\\'");
        params.query = `%${input.query
          .trim()
          .toLocaleLowerCase()
          .replaceAll("\\", "\\\\")
          .replaceAll("%", "\\%")
          .replaceAll("_", "\\_")}%`;
      }
      if (input.category?.trim()) {
        clauses.push("category=@category");
        params.category = input.category.trim();
      }
      if (input.transport === "remote") {
        clauses.push("transport_family IN ('remote','mixed')");
      } else if (input.transport === "local") {
        clauses.push("transport_family IN ('local','mixed')");
      }
      if (typeof input.installable === "boolean") {
        clauses.push("installable=@installable");
        params.installable = input.installable ? 1 : 0;
      }
      const offset = decodeCursor(input.cursor);
      params.limit = input.limit + 1;
      params.offset = offset;
      const rows = sqlite
        .prepare(
          `SELECT * FROM mcp_marketplace_servers
           WHERE ${clauses.join(" AND ")}
           ORDER BY title COLLATE NOCASE ASC, id ASC
           LIMIT @limit OFFSET @offset`,
        )
        .all(params) as Row[];
      const hasMore = rows.length > input.limit;
      return {
        servers: (hasMore ? rows.slice(0, input.limit) : rows).map(toServer),
        nextCursor: hasMore ? encodeCursor(offset + input.limit) : null,
      };
    },
    upsertPage(
      sourceUrl: string,
      records: MarketplaceCatalogRecord[],
      maxEntries: number,
    ) {
      sqlite.transaction(() => {
        for (const record of records) upsert(record);
        sqlite
          .prepare(`
            DELETE FROM mcp_marketplace_servers
            WHERE source_url=@sourceUrl
              AND rowid NOT IN (
                SELECT rowid
                FROM mcp_marketplace_servers
                WHERE source_url=@sourceUrl
                ORDER BY
                  deleted ASC,
                  installable DESC,
                  COALESCE(registry_updated_at, published_at, synced_at) DESC,
                  title COLLATE NOCASE ASC,
                  id ASC
                LIMIT @maxEntries
              )
          `)
          .run({ sourceUrl, maxEntries });
      })();
    },
    getSyncState(sourceUrl: string): MarketplaceSyncState {
      const row = sqlite
        .prepare("SELECT * FROM mcp_marketplace_sync_state WHERE source_url=?")
        .get(sourceUrl) as Row | undefined;
      return {
        sourceUrl,
        status:
          row?.status === "syncing" || row?.status === "failed" ? row.status : "idle",
        mode: row?.mode === "full" || row?.mode === "incremental" ? row.mode : null,
        lastAttemptAt:
          typeof row?.last_attempt_at === "string" ? row.last_attempt_at : null,
        lastSuccessfulSyncAt:
          typeof row?.last_successful_sync_at === "string"
            ? row.last_successful_sync_at
            : null,
        lastFullSyncAt:
          typeof row?.last_full_sync_at === "string" ? row.last_full_sync_at : null,
        watermark: typeof row?.watermark === "string" ? row.watermark : null,
        updatedCount: Number(row?.updated_count ?? 0),
        lastError: typeof row?.last_error === "string" ? row.last_error : null,
      };
    },
    setSyncState(state: MarketplaceSyncState) {
      sqlite
        .prepare(`
          INSERT INTO mcp_marketplace_sync_state (
            source_url,status,mode,last_attempt_at,last_successful_sync_at,
            last_full_sync_at,watermark,updated_count,last_error
          ) VALUES (
            @sourceUrl,@status,@mode,@lastAttemptAt,@lastSuccessfulSyncAt,
            @lastFullSyncAt,@watermark,@updatedCount,@lastError
          )
          ON CONFLICT(source_url) DO UPDATE SET
            status=excluded.status, mode=excluded.mode,
            last_attempt_at=excluded.last_attempt_at,
            last_successful_sync_at=excluded.last_successful_sync_at,
            last_full_sync_at=excluded.last_full_sync_at,
            watermark=excluded.watermark,
            updated_count=excluded.updated_count,
            last_error=excluded.last_error
        `)
        .run(state);
    },
  };
};
