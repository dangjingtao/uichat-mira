import { eq } from "drizzle-orm";
import { getDb, getSqlite } from "../index";
import { webSearchSettings } from "../schema";
import { decryptSecret, encryptSecret } from "@/utils/crypto.js";
import { hasSqliteColumn } from "../sqlite-utils";

export type WebSearchSettingsRecord = {
  tavilyApiKey: string;
  searxngBaseUrl: string;
  maxResults: number;
};

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, "");
const DEFAULT_MAX_RESULTS = 4;
const MIN_MAX_RESULTS = 1;
const MAX_MAX_RESULTS = 10;

const normalizeMaxResults = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_MAX_RESULTS;
  }

  return Math.min(
    MAX_MAX_RESULTS,
    Math.max(MIN_MAX_RESULTS, Math.trunc(value)),
  );
};

const ensureSettingsTable = () => {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS web_search_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tavily_api_key_encrypted TEXT,
      searxng_base_url TEXT NOT NULL DEFAULT '',
      max_results INTEGER NOT NULL DEFAULT 4,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
};

const ensureSettingsColumns = () => {
  const sqlite = getSqlite();

  if (!hasSqliteColumn(sqlite, "web_search_settings", "max_results")) {
    sqlite.exec(
      "ALTER TABLE web_search_settings ADD COLUMN max_results INTEGER NOT NULL DEFAULT 4",
    );
  }
};

const ensureSingleRow = () => {
  ensureSettingsTable();
  ensureSettingsColumns();
  const db = getDb();
  const row = db.select().from(webSearchSettings).limit(1).get();

  if (row) {
    return row;
  }

  return db
    .insert(webSearchSettings)
    .values({})
    .returning()
    .get();
};

export const webSearchSettingsRepository = {
  initialize() {
    ensureSingleRow();
  },

  get(): WebSearchSettingsRecord {
    const row = ensureSingleRow();
    return {
      tavilyApiKey: decryptSecret(row?.tavilyApiKeyEncrypted ?? null),
      searxngBaseUrl: normalizeBaseUrl(row?.searxngBaseUrl ?? ""),
      maxResults: normalizeMaxResults(row?.maxResults),
    };
  },

  update(input: Partial<WebSearchSettingsRecord>): WebSearchSettingsRecord {
    const current = this.get();
    const next = {
      tavilyApiKey:
        typeof input.tavilyApiKey === "string" ? input.tavilyApiKey : current.tavilyApiKey,
      searxngBaseUrl:
        typeof input.searxngBaseUrl === "string"
          ? normalizeBaseUrl(input.searxngBaseUrl)
          : current.searxngBaseUrl,
      maxResults:
        typeof input.maxResults === "number"
          ? normalizeMaxResults(input.maxResults)
          : current.maxResults,
    };

    const row = ensureSingleRow();
    if (!row) {
      throw new Error("Failed to initialize web search settings");
    }

    getDb()
      .update(webSearchSettings)
      .set({
        tavilyApiKeyEncrypted: next.tavilyApiKey.trim()
          ? encryptSecret(next.tavilyApiKey.trim())
          : null,
        searxngBaseUrl: next.searxngBaseUrl,
        maxResults: next.maxResults,
      })
      .where(eq(webSearchSettings.id, row.id))
      .run();

    return next;
  },
};
