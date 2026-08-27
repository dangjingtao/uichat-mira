import { randomUUID } from "node:crypto";
import { getSqlite } from "../index";
import { nowIso } from "@/utils/time.js";

export type NewsFeedFormat = "rss" | "atom";

export type NewsFeedSubscriptionRecord = {
  id: string;
  sourceKey: string;
  name: string;
  feedUrl: string;
  siteUrl: string;
  format: NewsFeedFormat;
  enabled: boolean;
  lang: string;
  topic: string;
  createdAt: string;
  updatedAt: string;
};

const ensureTable = () => {
  getSqlite().exec(`
    CREATE TABLE IF NOT EXISTS news_feed_subscriptions (
      id TEXT PRIMARY KEY NOT NULL,
      source_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      feed_url TEXT NOT NULL UNIQUE,
      site_url TEXT NOT NULL DEFAULT '',
      format TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      lang TEXT NOT NULL DEFAULT 'zh',
      topic TEXT NOT NULL DEFAULT 'technology',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  getSqlite().exec(`
    CREATE INDEX IF NOT EXISTS idx_news_feed_subscriptions_enabled
    ON news_feed_subscriptions(enabled)
  `);
};

const toRecord = (row: Record<string, unknown>): NewsFeedSubscriptionRecord => ({
  id: String(row.id),
  sourceKey: String(row.source_key),
  name: String(row.name),
  feedUrl: String(row.feed_url),
  siteUrl: String(row.site_url ?? ""),
  format: row.format === "atom" ? "atom" : "rss",
  enabled: Number(row.enabled) === 1,
  lang: String(row.lang || "zh"),
  topic: String(row.topic || "technology"),
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
});

export const newsFeedSubscriptionsRepository = {
  initialize() {
    ensureTable();
  },

  list(): NewsFeedSubscriptionRecord[] {
    ensureTable();
    return (getSqlite()
      .prepare("SELECT * FROM news_feed_subscriptions ORDER BY created_at ASC")
      .all() as Record<string, unknown>[]).map(toRecord);
  },

  getById(id: string): NewsFeedSubscriptionRecord | null {
    ensureTable();
    const row = getSqlite()
      .prepare("SELECT * FROM news_feed_subscriptions WHERE id = ? LIMIT 1")
      .get(id.trim()) as Record<string, unknown> | undefined;
    return row ? toRecord(row) : null;
  },

  getByFeedUrl(feedUrl: string): NewsFeedSubscriptionRecord | null {
    ensureTable();
    const row = getSqlite()
      .prepare("SELECT * FROM news_feed_subscriptions WHERE feed_url = ? LIMIT 1")
      .get(feedUrl.trim()) as Record<string, unknown> | undefined;
    return row ? toRecord(row) : null;
  },

  create(input: Omit<NewsFeedSubscriptionRecord, "id" | "sourceKey" | "createdAt" | "updatedAt">) {
    ensureTable();
    const id = randomUUID();
    const now = nowIso();
    getSqlite().prepare(`
      INSERT INTO news_feed_subscriptions
        (id, source_key, name, feed_url, site_url, format, enabled, lang, topic, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      `rss:${id}`,
      input.name.trim(),
      input.feedUrl.trim(),
      input.siteUrl.trim(),
      input.format,
      input.enabled ? 1 : 0,
      input.lang.trim() || "zh",
      input.topic.trim() || "technology",
      now,
      now,
    );
    return this.getById(id)!;
  },

  update(id: string, input: Partial<Pick<NewsFeedSubscriptionRecord, "name" | "enabled" | "lang" | "topic">>) {
    const current = this.getById(id);
    if (!current) return null;
    getSqlite().prepare(`
      UPDATE news_feed_subscriptions
      SET name = ?, enabled = ?, lang = ?, topic = ?, updated_at = ?
      WHERE id = ?
    `).run(
      typeof input.name === "string" ? input.name.trim() : current.name,
      typeof input.enabled === "boolean" ? (input.enabled ? 1 : 0) : (current.enabled ? 1 : 0),
      typeof input.lang === "string" ? input.lang.trim() || current.lang : current.lang,
      typeof input.topic === "string" ? input.topic.trim() || current.topic : current.topic,
      nowIso(),
      current.id,
    );
    return this.getById(current.id);
  },

  delete(id: string) {
    const current = this.getById(id);
    if (!current) return null;
    getSqlite().prepare("DELETE FROM news_feed_subscriptions WHERE id = ?").run(current.id);
    return current;
  },
};
