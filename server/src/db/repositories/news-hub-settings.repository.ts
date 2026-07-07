import { decryptSecret, encryptSecret } from "@/utils/crypto.js";
import { nowIso } from "@/utils/time.js";
import { getSqlite } from "../index";
import { hasSqliteColumn } from "../sqlite-utils";

export type NewsHubSettingsRecord = {
  newsDataEnabled: boolean;
  newsDataApiKey: string;
  currentsEnabled: boolean;
  currentsApiKey: string;
  redditEnabled: boolean;
  redditClientId: string;
  redditClientSecret: string;
  redditUserAgent: string;
  redditSubreddits: string;
  refreshTtlMinutes: number;
};

export type NewsHubSourceStateRecord = {
  sourceKey: string;
  lastFetchedAt: string | null;
  lastStatus: "idle" | "succeeded" | "failed";
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

const DEFAULT_TTL_MINUTES = 60;
const MIN_TTL_MINUTES = 60;
const MAX_TTL_MINUTES = 24 * 60;
const DEFAULT_REDDIT_USER_AGENT = "UIChat-Mira-NewsHub/0.1";
const DEFAULT_REDDIT_SUBREDDITS = "technology+programming+artificial";

const normalizeBoolean = (value: unknown, fallback = false) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  return fallback;
};

const normalizeText = (value: unknown, fallback = "") =>
  typeof value === "string" ? value.trim() : fallback;

const normalizeTtlMinutes = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_TTL_MINUTES;
  }

  return Math.min(
    MAX_TTL_MINUTES,
    Math.max(MIN_TTL_MINUTES, Math.trunc(value)),
  );
};

const ensureSettingsTable = () => {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS news_hub_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      news_data_enabled INTEGER NOT NULL DEFAULT 0,
      news_data_api_key_encrypted TEXT,
      currents_enabled INTEGER NOT NULL DEFAULT 0,
      currents_api_key_encrypted TEXT,
      reddit_enabled INTEGER NOT NULL DEFAULT 0,
      reddit_client_id_encrypted TEXT,
      reddit_client_secret_encrypted TEXT,
      reddit_user_agent TEXT NOT NULL DEFAULT 'UIChat-Mira-NewsHub/0.1',
      reddit_subreddits TEXT NOT NULL DEFAULT 'technology+programming+artificial',
      refresh_ttl_minutes INTEGER NOT NULL DEFAULT 60,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
};

const ensureSettingsColumns = () => {
  const sqlite = getSqlite();

  if (!hasSqliteColumn(sqlite, "news_hub_settings", "news_data_enabled")) {
    sqlite.exec(
      "ALTER TABLE news_hub_settings ADD COLUMN news_data_enabled INTEGER NOT NULL DEFAULT 0",
    );
  }
  if (!hasSqliteColumn(sqlite, "news_hub_settings", "news_data_api_key_encrypted")) {
    sqlite.exec(
      "ALTER TABLE news_hub_settings ADD COLUMN news_data_api_key_encrypted TEXT",
    );
  }
  if (!hasSqliteColumn(sqlite, "news_hub_settings", "currents_enabled")) {
    sqlite.exec(
      "ALTER TABLE news_hub_settings ADD COLUMN currents_enabled INTEGER NOT NULL DEFAULT 0",
    );
  }
  if (!hasSqliteColumn(sqlite, "news_hub_settings", "currents_api_key_encrypted")) {
    sqlite.exec(
      "ALTER TABLE news_hub_settings ADD COLUMN currents_api_key_encrypted TEXT",
    );
  }
  if (!hasSqliteColumn(sqlite, "news_hub_settings", "reddit_enabled")) {
    sqlite.exec(
      "ALTER TABLE news_hub_settings ADD COLUMN reddit_enabled INTEGER NOT NULL DEFAULT 0",
    );
  }
  if (!hasSqliteColumn(sqlite, "news_hub_settings", "reddit_client_id_encrypted")) {
    sqlite.exec(
      "ALTER TABLE news_hub_settings ADD COLUMN reddit_client_id_encrypted TEXT",
    );
  }
  if (!hasSqliteColumn(sqlite, "news_hub_settings", "reddit_client_secret_encrypted")) {
    sqlite.exec(
      "ALTER TABLE news_hub_settings ADD COLUMN reddit_client_secret_encrypted TEXT",
    );
  }
  if (!hasSqliteColumn(sqlite, "news_hub_settings", "reddit_user_agent")) {
    sqlite.exec(
      `ALTER TABLE news_hub_settings ADD COLUMN reddit_user_agent TEXT NOT NULL DEFAULT '${DEFAULT_REDDIT_USER_AGENT}'`,
    );
  }
  if (!hasSqliteColumn(sqlite, "news_hub_settings", "reddit_subreddits")) {
    sqlite.exec(
      `ALTER TABLE news_hub_settings ADD COLUMN reddit_subreddits TEXT NOT NULL DEFAULT '${DEFAULT_REDDIT_SUBREDDITS}'`,
    );
  }
  if (!hasSqliteColumn(sqlite, "news_hub_settings", "refresh_ttl_minutes")) {
    sqlite.exec(
      `ALTER TABLE news_hub_settings ADD COLUMN refresh_ttl_minutes INTEGER NOT NULL DEFAULT ${DEFAULT_TTL_MINUTES}`,
    );
  }
};

const ensureSourceStatesTable = () => {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS news_hub_source_states (
      source_key TEXT PRIMARY KEY NOT NULL,
      last_fetched_at TEXT,
      last_status TEXT NOT NULL DEFAULT 'idle',
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
};

const ensureSingleRow = () => {
  ensureSettingsTable();
  ensureSettingsColumns();

  const existing = getSqlite()
    .prepare("SELECT * FROM news_hub_settings ORDER BY id ASC LIMIT 1")
    .get() as Record<string, unknown> | undefined;

  if (existing) {
    return existing;
  }

  getSqlite()
    .prepare("INSERT INTO news_hub_settings DEFAULT VALUES")
    .run();

  return getSqlite()
    .prepare("SELECT * FROM news_hub_settings ORDER BY id ASC LIMIT 1")
    .get() as Record<string, unknown>;
};

const toSettingsRecord = (row: Record<string, unknown>): NewsHubSettingsRecord => ({
  newsDataEnabled: normalizeBoolean(row.news_data_enabled),
  newsDataApiKey: decryptSecret(
    typeof row.news_data_api_key_encrypted === "string"
      ? row.news_data_api_key_encrypted
      : null,
  ),
  currentsEnabled: normalizeBoolean(row.currents_enabled),
  currentsApiKey: decryptSecret(
    typeof row.currents_api_key_encrypted === "string"
      ? row.currents_api_key_encrypted
      : null,
  ),
  redditEnabled: normalizeBoolean(row.reddit_enabled),
  redditClientId: decryptSecret(
    typeof row.reddit_client_id_encrypted === "string"
      ? row.reddit_client_id_encrypted
      : null,
  ),
  redditClientSecret: decryptSecret(
    typeof row.reddit_client_secret_encrypted === "string"
      ? row.reddit_client_secret_encrypted
      : null,
  ),
  redditUserAgent:
    normalizeText(row.reddit_user_agent, DEFAULT_REDDIT_USER_AGENT) ||
    DEFAULT_REDDIT_USER_AGENT,
  redditSubreddits:
    normalizeText(row.reddit_subreddits, DEFAULT_REDDIT_SUBREDDITS) ||
    DEFAULT_REDDIT_SUBREDDITS,
  refreshTtlMinutes: normalizeTtlMinutes(row.refresh_ttl_minutes),
});

const toSourceStateRecord = (
  row: Record<string, unknown>,
): NewsHubSourceStateRecord => ({
  sourceKey: normalizeText(row.source_key),
  lastFetchedAt:
    typeof row.last_fetched_at === "string" ? row.last_fetched_at : null,
  lastStatus:
    row.last_status === "succeeded" || row.last_status === "failed"
      ? row.last_status
      : "idle",
  lastError: typeof row.last_error === "string" ? row.last_error : null,
  createdAt: normalizeText(row.created_at),
  updatedAt: normalizeText(row.updated_at),
});

export const newsHubSettingsRepository = {
  initialize() {
    ensureSingleRow();
    ensureSourceStatesTable();
  },

  get(): NewsHubSettingsRecord {
    return toSettingsRecord(ensureSingleRow());
  },

  update(input: Partial<NewsHubSettingsRecord>): NewsHubSettingsRecord {
    const current = this.get();
    const next: NewsHubSettingsRecord = {
      newsDataEnabled:
        typeof input.newsDataEnabled === "boolean"
          ? input.newsDataEnabled
          : current.newsDataEnabled,
      newsDataApiKey:
        typeof input.newsDataApiKey === "string"
          ? input.newsDataApiKey.trim()
          : current.newsDataApiKey,
      currentsEnabled:
        typeof input.currentsEnabled === "boolean"
          ? input.currentsEnabled
          : current.currentsEnabled,
      currentsApiKey:
        typeof input.currentsApiKey === "string"
          ? input.currentsApiKey.trim()
          : current.currentsApiKey,
      redditEnabled:
        typeof input.redditEnabled === "boolean"
          ? input.redditEnabled
          : current.redditEnabled,
      redditClientId:
        typeof input.redditClientId === "string"
          ? input.redditClientId.trim()
          : current.redditClientId,
      redditClientSecret:
        typeof input.redditClientSecret === "string"
          ? input.redditClientSecret.trim()
          : current.redditClientSecret,
      redditUserAgent:
        typeof input.redditUserAgent === "string"
          ? input.redditUserAgent.trim() || DEFAULT_REDDIT_USER_AGENT
          : current.redditUserAgent,
      redditSubreddits:
        typeof input.redditSubreddits === "string"
          ? input.redditSubreddits.trim() || DEFAULT_REDDIT_SUBREDDITS
          : current.redditSubreddits,
      refreshTtlMinutes:
        typeof input.refreshTtlMinutes === "number"
          ? normalizeTtlMinutes(input.refreshTtlMinutes)
          : current.refreshTtlMinutes,
    };

    const row = ensureSingleRow();
    const updatedAt = nowIso();
    getSqlite()
      .prepare(`
        UPDATE news_hub_settings
        SET
          news_data_enabled = @newsDataEnabled,
          news_data_api_key_encrypted = @newsDataApiKeyEncrypted,
          currents_enabled = @currentsEnabled,
          currents_api_key_encrypted = @currentsApiKeyEncrypted,
          reddit_enabled = @redditEnabled,
          reddit_client_id_encrypted = @redditClientIdEncrypted,
          reddit_client_secret_encrypted = @redditClientSecretEncrypted,
          reddit_user_agent = @redditUserAgent,
          reddit_subreddits = @redditSubreddits,
          refresh_ttl_minutes = @refreshTtlMinutes,
          updated_at = @updatedAt
        WHERE id = @id
      `)
      .run({
        id: row.id,
        newsDataEnabled: next.newsDataEnabled ? 1 : 0,
        newsDataApiKeyEncrypted: encryptSecret(next.newsDataApiKey),
        currentsEnabled: next.currentsEnabled ? 1 : 0,
        currentsApiKeyEncrypted: encryptSecret(next.currentsApiKey),
        redditEnabled: next.redditEnabled ? 1 : 0,
        redditClientIdEncrypted: encryptSecret(next.redditClientId),
        redditClientSecretEncrypted: encryptSecret(next.redditClientSecret),
        redditUserAgent: next.redditUserAgent,
        redditSubreddits: next.redditSubreddits,
        refreshTtlMinutes: next.refreshTtlMinutes,
        updatedAt,
      });

    return next;
  },

  getSourceState(sourceKey: string): NewsHubSourceStateRecord | null {
    ensureSourceStatesTable();
    const row = getSqlite()
      .prepare(
        "SELECT * FROM news_hub_source_states WHERE source_key = ? LIMIT 1",
      )
      .get(sourceKey.trim()) as Record<string, unknown> | undefined;

    return row ? toSourceStateRecord(row) : null;
  },

  listSourceStates() {
    ensureSourceStatesTable();
    return (
      getSqlite()
        .prepare("SELECT * FROM news_hub_source_states ORDER BY source_key ASC")
        .all() as Record<string, unknown>[]
    ).map(toSourceStateRecord);
  },

  upsertSourceState(input: {
    sourceKey: string;
    lastFetchedAt?: string | null;
    lastStatus: "idle" | "succeeded" | "failed";
    lastError?: string | null;
  }) {
    ensureSourceStatesTable();
    const now = nowIso();
    const sourceKey = input.sourceKey.trim();
    const existing = this.getSourceState(sourceKey);

    if (existing) {
      getSqlite()
        .prepare(`
          UPDATE news_hub_source_states
          SET
            last_fetched_at = @lastFetchedAt,
            last_status = @lastStatus,
            last_error = @lastError,
            updated_at = @updatedAt
          WHERE source_key = @sourceKey
        `)
        .run({
          sourceKey,
          lastFetchedAt: input.lastFetchedAt ?? existing.lastFetchedAt,
          lastStatus: input.lastStatus,
          lastError:
            typeof input.lastError === "string" ? input.lastError : input.lastError ?? null,
          updatedAt: now,
        });
      return;
    }

    getSqlite()
      .prepare(`
        INSERT INTO news_hub_source_states (
          source_key,
          last_fetched_at,
          last_status,
          last_error,
          created_at,
          updated_at
        ) VALUES (
          @sourceKey,
          @lastFetchedAt,
          @lastStatus,
          @lastError,
          @createdAt,
          @updatedAt
        )
      `)
      .run({
        sourceKey,
        lastFetchedAt: input.lastFetchedAt ?? null,
        lastStatus: input.lastStatus,
        lastError:
          typeof input.lastError === "string" ? input.lastError : input.lastError ?? null,
        createdAt: now,
        updatedAt: now,
      });
  },
};
