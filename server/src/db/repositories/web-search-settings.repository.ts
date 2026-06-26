import { eq } from "drizzle-orm";
import { getDb, getSqlite } from "../index";
import { webSearchSettings } from "../schema";
import { decryptSecret, encryptSecret } from "@/utils/crypto.js";

export type WebSearchSettingsRecord = {
  tavilyApiKey: string;
  searxngBaseUrl: string;
};

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, "");

const ensureSettingsTable = () => {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS web_search_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tavily_api_key_encrypted TEXT,
      searxng_base_url TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
};

const ensureSingleRow = () => {
  ensureSettingsTable();
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
      })
      .where(eq(webSearchSettings.id, row.id))
      .run();

    return next;
  },
};
