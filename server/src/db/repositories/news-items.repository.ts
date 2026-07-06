import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { getDb, getSqlite } from "../index";
import { newsItems } from "../schema";
import { nowIso } from "@/utils/time.js";

export type NewsItemRecord = {
  id: string;
  sourceType: string;
  sourceName: string;
  sourceKey: string;
  externalId: string;
  title: string;
  summary: string;
  contentText: string;
  url: string;
  author: string | null;
  publishedAt: string | null;
  ingestedAt: string;
  lang: string;
  topic: string;
  tags: string[];
  rawPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type NewsItemUpsertInput = Omit<
  NewsItemRecord,
  "id" | "createdAt" | "updatedAt" | "ingestedAt"
> & {
  ingestedAt?: string;
};

export type NewsItemsListFilters = {
  limit?: number;
  sourceKey?: string;
  query?: string;
};

type SourceStatsRow = {
  sourceKey: string;
  itemCount: number;
  lastPublishedAt: string | null;
  lastIngestedAt: string | null;
};

const normalizeText = (value: string) => value.trim();

const parseJson = <T>(value: string, fallback: T): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const toRecord = (row: typeof newsItems.$inferSelect): NewsItemRecord => ({
  id: row.id,
  sourceType: normalizeText(row.sourceType),
  sourceName: normalizeText(row.sourceName),
  sourceKey: normalizeText(row.sourceKey),
  externalId: normalizeText(row.externalId),
  title: normalizeText(row.title),
  summary: normalizeText(row.summary),
  contentText: normalizeText(row.contentText),
  url: normalizeText(row.url),
  author: row.author ? normalizeText(row.author) : null,
  publishedAt: row.publishedAt ?? null,
  ingestedAt: row.ingestedAt,
  lang: normalizeText(row.lang),
  topic: normalizeText(row.topic),
  tags: parseJson<string[]>(row.tagsJson, []),
  rawPayload: parseJson<Record<string, unknown>>(row.rawPayloadJson, {}),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const ensureTable = () => {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS news_items (
      id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
      source_type TEXT NOT NULL DEFAULT 'rss',
      source_name TEXT NOT NULL DEFAULT '',
      source_key TEXT NOT NULL DEFAULT '',
      external_id TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      content_text TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      author TEXT,
      published_at TEXT,
      ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
      lang TEXT NOT NULL DEFAULT 'en',
      topic TEXT NOT NULL DEFAULT 'technology',
      tags_json TEXT NOT NULL DEFAULT '[]',
      raw_payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_news_items_source_key
    ON news_items(source_key)
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_news_items_source_type
    ON news_items(source_type)
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_news_items_published_at
    ON news_items(published_at)
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_news_items_ingested_at
    ON news_items(ingested_at)
  `);
  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_news_items_source_external
    ON news_items(source_key, external_id)
  `);
};

export const newsItemsRepository = {
  initialize() {
    ensureTable();
  },

  upsertMany(items: NewsItemUpsertInput[]) {
    let insertedCount = 0;
    let updatedCount = 0;

    for (const item of items) {
      const existing = getDb()
        .select({ id: newsItems.id })
        .from(newsItems)
        .where(
          and(
            eq(newsItems.sourceKey, item.sourceKey),
            eq(newsItems.externalId, item.externalId),
          ),
        )
        .get();

      const nextPayload = {
        sourceType: normalizeText(item.sourceType),
        sourceName: normalizeText(item.sourceName),
        sourceKey: normalizeText(item.sourceKey),
        externalId: normalizeText(item.externalId),
        title: normalizeText(item.title),
        summary: normalizeText(item.summary),
        contentText: normalizeText(item.contentText),
        url: normalizeText(item.url),
        author: item.author ? normalizeText(item.author) : null,
        publishedAt: item.publishedAt ?? null,
        ingestedAt: item.ingestedAt ?? nowIso(),
        lang: normalizeText(item.lang),
        topic: normalizeText(item.topic),
        tagsJson: JSON.stringify(item.tags),
        rawPayloadJson: JSON.stringify(item.rawPayload),
        updatedAt: nowIso(),
      };

      if (existing) {
        getDb()
          .update(newsItems)
          .set(nextPayload)
          .where(eq(newsItems.id, existing.id))
          .run();
        updatedCount += 1;
        continue;
      }

      getDb()
        .insert(newsItems)
        .values(nextPayload)
        .run();
      insertedCount += 1;
    }

    return {
      insertedCount,
      updatedCount,
      totalCount: insertedCount + updatedCount,
    };
  },

  listRecent(filters: NewsItemsListFilters = {}) {
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    const query = filters.query?.trim();

    const predicates = [];
    if (filters.sourceKey) {
      predicates.push(eq(newsItems.sourceKey, filters.sourceKey));
    }
    if (query) {
      const likeValue = `%${query}%`;
      predicates.push(
        or(
          like(newsItems.title, likeValue),
          like(newsItems.summary, likeValue),
          like(newsItems.contentText, likeValue),
        )!,
      );
    }

    const whereClause =
      predicates.length === 0
        ? undefined
        : predicates.length === 1
          ? predicates[0]
          : and(...predicates);

    const rows = getDb()
      .select()
      .from(newsItems)
      .where(whereClause)
      .orderBy(desc(newsItems.publishedAt), desc(newsItems.ingestedAt))
      .limit(limit)
      .all();

    const totalRow = getDb()
      .select({ count: sql<number>`count(*)` })
      .from(newsItems)
      .where(whereClause)
      .get();

    return {
      items: rows.map(toRecord),
      total: totalRow?.count ?? 0,
    };
  },

  listSourceStats() {
    return getDb()
      .select({
        sourceKey: newsItems.sourceKey,
        itemCount: sql<number>`count(*)`,
        lastPublishedAt: sql<string | null>`max(${newsItems.publishedAt})`,
        lastIngestedAt: sql<string | null>`max(${newsItems.ingestedAt})`,
      })
      .from(newsItems)
      .groupBy(newsItems.sourceKey)
      .all() as SourceStatsRow[];
  },
};
