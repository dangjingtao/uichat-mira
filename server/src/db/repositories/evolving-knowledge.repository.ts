import { and, asc, desc, eq, gte, gt, inArray, isNull, sql } from "drizzle-orm";
import { getDb, getSqlite } from "../index";
import { hasSqliteColumn } from "../sqlite-utils";
import {
  knowledgeCaptures,
  knowledgeAttachments,
  knowledgeRelations,
  knowledgeInsights,
  knowledgeTagsEvolution,
} from "../schema";

const parseJson = <T>(value: string | null, fallback: T): T => {
  try {
    return JSON.parse(value ?? "") as T;
  } catch {
    return fallback;
  }
};

export type CaptureInput = {
  userId: number;
  sourceUrl: string;
  title: string;
  favicon?: string;
  contentType: "text" | "image";
  rawContent: string;
  rewrittenSummary: string;
  aiTags: string[];
  aiEntities: Array<{ name: string; type: string; context: string }>;
  captureMetadata?: Record<string, unknown>;
  attachments?: Array<{ filePath: string; mimeType: string }>;
};

export type CaptureRecord = {
  id: string;
  sourceUrl: string;
  title: string;
  favicon: string;
  capturedAt: string;
  contentType: string;
  rawContent: string;
  rewrittenSummary: string;
  aiTags: string[];
  aiEntities: Array<{ name: string; type: string; context: string }>;
  userEdited: boolean;
  captureMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  processingStatus: "pending" | "processing" | "completed" | "failed" | "skipped";
  processingError: string | null;
};

const toCaptureRecord = (row: typeof knowledgeCaptures.$inferSelect): CaptureRecord => ({
  id: row.id,
  sourceUrl: row.sourceUrl,
  title: row.title,
  favicon: row.favicon,
  capturedAt: row.capturedAt,
  contentType: row.contentType,
  rawContent: row.rawContent,
  rewrittenSummary: row.rewrittenSummary,
  aiTags: parseJson<string[]>(row.aiTagsJson, []),
  aiEntities: parseJson<Array<{ name: string; type: string; context: string }>>(
    row.aiEntitiesJson,
    [],
  ),
  userEdited: Boolean(row.userEdited),
  captureMetadata: parseJson<Record<string, unknown>>(
    row.captureMetadataJson,
    {},
  ),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  processingStatus: row.processingStatus as CaptureRecord["processingStatus"],
  processingError: row.processingError,
});

export const evolvingKnowledgeRepository = {
  // ── Captures ────────────────────────────────────────────────

  createCapture(input: CaptureInput) {
    const now = new Date().toISOString();
    const row = getDb()
      .insert(knowledgeCaptures)
      .values({
        userId: input.userId,
        capturedAt: now,
        sourceUrl: input.sourceUrl,
        title: input.title,
        favicon: input.favicon ?? "",
        contentType: input.contentType,
        rawContent: input.rawContent,
        rewrittenSummary: input.rewrittenSummary,
        aiTagsJson: JSON.stringify(input.aiTags),
        aiEntitiesJson: JSON.stringify(input.aiEntities),
        captureMetadataJson: JSON.stringify(input.captureMetadata ?? {}),
        processingStatus: "pending",
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
    return toCaptureRecord(row);
  },

  listCaptures(options: { userId: number; limit?: number; offset?: number; contentType?: string }) {
    let query = getDb()
      .select()
      .from(knowledgeCaptures)
      .orderBy(desc(knowledgeCaptures.capturedAt))
      .limit(options?.limit ?? 100)
      .offset(options?.offset ?? 0);

    query = query.where(
      and(
        eq(knowledgeCaptures.userId, options.userId),
        inArray(knowledgeCaptures.contentType, ["text", "image"]),
        options.contentType
          ? eq(knowledgeCaptures.contentType, options.contentType as never)
          : undefined,
      ),
    ) as typeof query;

    return query.all().map(toCaptureRecord);
  },

  getCaptureById(id: string, userId: number) {
    const row = getDb()
      .select()
      .from(knowledgeCaptures)
      .where(and(eq(knowledgeCaptures.id, id), eq(knowledgeCaptures.userId, userId)))
      .get();
    return row ? toCaptureRecord(row) : null;
  },

  getRecentCaptures(userId: number, limit = 50) {
    return getDb()
      .select()
      .from(knowledgeCaptures)
      .where(eq(knowledgeCaptures.userId, userId))
      .orderBy(desc(knowledgeCaptures.capturedAt))
      .limit(limit)
      .all()
      .map(toCaptureRecord);
  },

  updateCapture(id: string, userId: number, input: Partial<Pick<CaptureInput, "rewrittenSummary" | "aiTags" | "aiEntities">> & Partial<Pick<CaptureRecord, "processingStatus" | "processingError">> & { markUserEdited?: boolean }) {
    const current = this.getCaptureById(id, userId);
    if (!current) return null;

    const row = getDb()
      .update(knowledgeCaptures)
      .set({
        rewrittenSummary:
          input.rewrittenSummary !== undefined
            ? input.rewrittenSummary
            : current.rewrittenSummary,
        aiTagsJson: input.aiTags !== undefined ? JSON.stringify(input.aiTags) : JSON.stringify(current.aiTags),
        aiEntitiesJson:
          input.aiEntities !== undefined
            ? JSON.stringify(input.aiEntities)
            : JSON.stringify(current.aiEntities),
        userEdited: input.markUserEdited ?? true,
        processingStatus: input.processingStatus ?? current.processingStatus,
        processingError: input.processingError !== undefined ? input.processingError : current.processingError,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(knowledgeCaptures.id, id), eq(knowledgeCaptures.userId, userId)))
      .returning()
      .get();
    return row ? toCaptureRecord(row) : null;
  },

  deleteCapture(id: string, userId: number) {
    getDb()
      .delete(knowledgeCaptures)
      .where(and(eq(knowledgeCaptures.id, id), eq(knowledgeCaptures.userId, userId)))
      .run();
  },

  searchCapturesByText(q: string, userId: number) {
    // SQLite FTS 后面再加，先用 LIKE
    const pattern = `%${q}%`;
    return getDb()
      .select()
      .from(knowledgeCaptures)
      .where(and(
        eq(knowledgeCaptures.userId, userId),
        inArray(knowledgeCaptures.contentType, ["text", "image"]),
        sql`${knowledgeCaptures.title} LIKE ${pattern} OR ${knowledgeCaptures.rewrittenSummary} LIKE ${pattern} OR ${knowledgeCaptures.rawContent} LIKE ${pattern}`,
      ))
      .orderBy(desc(knowledgeCaptures.capturedAt))
      .limit(50)
      .all()
      .map(toCaptureRecord);
  },

  // ── Attachments ─────────────────────────────────────────────

  createAttachment(input: {
    captureId: string;
    filePath: string;
    mimeType: string;
    aiExtractedText?: string;
    processingStatus?: "done" | "pending" | "failed";
  }) {
    return getDb()
      .insert(knowledgeAttachments)
      .values({
        captureId: input.captureId,
        filePath: input.filePath,
        mimeType: input.mimeType,
        aiExtractedText: input.aiExtractedText ?? "",
        processingStatus: input.processingStatus ?? "pending",
      })
      .returning()
      .get();
  },

  listAttachmentsByCapture(captureId: string) {
    return getDb()
      .select()
      .from(knowledgeAttachments)
      .where(eq(knowledgeAttachments.captureId, captureId))
      .all();
  },

  // ── Relations ───────────────────────────────────────────────

  createRelation(input: {
    userId: number;
    sourceCaptureId: string;
    targetCaptureId: string;
    relationType: "similar" | "contradicts" | "evolves" | "references";
    confidence: number;
    aiReasoning: string;
  }) {
    return getDb()
      .insert(knowledgeRelations)
      .values({
        userId: input.userId,
        sourceCaptureId: input.sourceCaptureId,
        targetCaptureId: input.targetCaptureId,
        relationType: input.relationType,
        confidence: input.confidence,
        aiReasoning: input.aiReasoning,
      })
      .returning()
      .get();
  },

  listRelationsForCapture(captureId: string, userId: number) {
    return getDb()
      .select()
      .from(knowledgeRelations)
      .where(and(
        eq(knowledgeRelations.userId, userId),
        sql`${knowledgeRelations.sourceCaptureId} = ${captureId} OR ${knowledgeRelations.targetCaptureId} = ${captureId}`,
      ))
      .orderBy(desc(knowledgeRelations.confidence))
      .all();
  },

  // ── Insights ────────────────────────────────────────────────

  createInsight(input: {
    userId: number;
    insightType: "synthesis" | "contradiction" | "resurfacing" | "gap";
    title: string;
    description: string;
    triggerCaptureId?: string;
    relatedCaptureIds: string[];
    confidence: number;
  }) {
    const dedupeSince = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const existing = getDb()
      .select()
      .from(knowledgeInsights)
      .where(
        and(
          eq(knowledgeInsights.insightType, input.insightType),
          eq(knowledgeInsights.userId, input.userId),
          input.triggerCaptureId
            ? eq(knowledgeInsights.triggerCaptureId, input.triggerCaptureId)
            : isNull(knowledgeInsights.triggerCaptureId),
          gte(knowledgeInsights.createdAt, dedupeSince),
        ),
      )
      .get();

    if (existing) return existing;

    return getDb()
      .insert(knowledgeInsights)
      .values({
        userId: input.userId,
        insightType: input.insightType,
        title: input.title,
        description: input.description,
        triggerCaptureId: input.triggerCaptureId ?? null,
        relatedCaptureIdsJson: JSON.stringify(input.relatedCaptureIds),
        confidence: input.confidence,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .returning()
      .get();
  },

  listActiveInsights(userId: number, options?: { type?: string; limit?: number }) {
    const now = new Date().toISOString();
    const conditions = [
      eq(knowledgeInsights.dismissedByUser, false),
      eq(knowledgeInsights.userId, userId),
      sql`(${knowledgeInsights.expiresAt} IS NULL OR ${knowledgeInsights.expiresAt} > ${now})`,
    ];
    if (options?.type) {
      conditions.push(eq(knowledgeInsights.insightType, options.type as never));
    }

    return getDb()
      .select()
      .from(knowledgeInsights)
      .where(and(...conditions))
      .orderBy(desc(knowledgeInsights.createdAt))
      .limit(options?.limit ?? 20)
      .all();
  },

  dismissInsight(id: string, userId: number) {
    return getDb()
      .update(knowledgeInsights)
      .set({ dismissedByUser: true })
      .where(and(eq(knowledgeInsights.id, id), eq(knowledgeInsights.userId, userId)))
      .returning()
      .get();
  },

  // ── Tags Evolution ──────────────────────────────────────────

  upsertTag(tagName: string, userId: number) {
    const existing = getDb()
      .select()
      .from(knowledgeTagsEvolution)
      .where(and(eq(knowledgeTagsEvolution.tagName, tagName), eq(knowledgeTagsEvolution.userId, userId)))
      .get();

    if (existing) {
      return getDb()
        .update(knowledgeTagsEvolution)
        .set({
          lastSeenAt: new Date().toISOString(),
          usageCount: existing.usageCount + 1,
        })
        .where(and(eq(knowledgeTagsEvolution.tagName, tagName), eq(knowledgeTagsEvolution.userId, userId)))
        .returning()
        .get();
    }

    return getDb()
      .insert(knowledgeTagsEvolution)
      .values({ tagName, userId })
      .returning()
      .get();
  },

  listPopularTags(userId: number, limit = 30) {
    return getDb()
      .select()
      .from(knowledgeTagsEvolution)
      .where(eq(knowledgeTagsEvolution.userId, userId))
      .orderBy(desc(knowledgeTagsEvolution.usageCount))
      .limit(limit)
      .all();
  },

  initialize() {
    const sqlite = getSqlite();
    const ensureColumn = (table: string, column: string, definition: string) => {
      if (!hasSqliteColumn(sqlite, table, column)) {
        sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      }
    };
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_captures (
        id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        source_url TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL DEFAULT '',
        favicon TEXT NOT NULL DEFAULT '',
        captured_at TEXT NOT NULL DEFAULT (datetime('now')),
        content_type TEXT NOT NULL DEFAULT 'text',
        raw_content TEXT NOT NULL DEFAULT '',
        rewritten_summary TEXT NOT NULL DEFAULT '',
        ai_tags_json TEXT NOT NULL DEFAULT '[]',
        ai_entities_json TEXT NOT NULL DEFAULT '[]',
        user_edited INTEGER NOT NULL DEFAULT 0,
        capture_metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        processing_status TEXT NOT NULL DEFAULT 'pending',
        processing_error TEXT
      )
    `);
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_captures_captured_at
      ON knowledge_captures(captured_at)
    `);
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_captures_content_type
      ON knowledge_captures(content_type)
    `);
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_captures_user_id ON knowledge_captures(user_id)");
    ensureColumn("knowledge_captures", "user_id", "INTEGER REFERENCES users(id) ON DELETE CASCADE");
    ensureColumn("knowledge_captures", "processing_status", "TEXT NOT NULL DEFAULT 'pending'");
    ensureColumn("knowledge_captures", "processing_error", "TEXT");

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_attachments (
        id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
        capture_id TEXT NOT NULL REFERENCES knowledge_captures(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL DEFAULT '',
        mime_type TEXT NOT NULL DEFAULT '',
        ai_extracted_text TEXT NOT NULL DEFAULT '',
        processing_status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_attachments_capture_id
      ON knowledge_attachments(capture_id)
    `);

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_tags_evolution (
        tag_name TEXT NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
        usage_count INTEGER NOT NULL DEFAULT 1,
        merged_into_tag TEXT,
        merged_at TEXT,
        PRIMARY KEY (tag_name, user_id)
      )
    `);
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_tags_last_seen
      ON knowledge_tags_evolution(last_seen_at)
    `);
    ensureColumn("knowledge_tags_evolution", "user_id", "INTEGER REFERENCES users(id) ON DELETE CASCADE");
    const tagColumns = sqlite
      .prepare("PRAGMA table_info(knowledge_tags_evolution)")
      .all() as Array<{ name: string; pk: number }>;
    const hasLegacyTagPrimaryKey =
      tagColumns.some((column) => column.name === "tag_name" && column.pk === 1) &&
      !tagColumns.some((column) => column.name === "user_id" && column.pk > 0);
    if (hasLegacyTagPrimaryKey) {
      sqlite.exec("ALTER TABLE knowledge_tags_evolution RENAME TO knowledge_tags_evolution_legacy");
      sqlite.exec(`
        CREATE TABLE knowledge_tags_evolution (
          tag_name TEXT NOT NULL,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
          last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
          usage_count INTEGER NOT NULL DEFAULT 1,
          merged_into_tag TEXT,
          merged_at TEXT,
          PRIMARY KEY (tag_name, user_id)
        )
      `);
      sqlite.exec(`
        INSERT INTO knowledge_tags_evolution (
          tag_name, user_id, first_seen_at, last_seen_at, usage_count, merged_into_tag, merged_at
        )
        SELECT tag_name, user_id, first_seen_at, last_seen_at, usage_count, merged_into_tag, merged_at
        FROM knowledge_tags_evolution_legacy
        WHERE user_id IS NOT NULL
      `);
      sqlite.exec("DROP TABLE knowledge_tags_evolution_legacy");
    }
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_tags_user_id ON knowledge_tags_evolution(user_id)");

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_relations (
        id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        source_capture_id TEXT NOT NULL REFERENCES knowledge_captures(id) ON DELETE CASCADE,
        target_capture_id TEXT NOT NULL REFERENCES knowledge_captures(id) ON DELETE CASCADE,
        relation_type TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 0.5,
        ai_reasoning TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_relations_source
      ON knowledge_relations(source_capture_id)
    `);
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_relations_target
      ON knowledge_relations(target_capture_id)
    `);
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_relations_type
      ON knowledge_relations(relation_type)
    `);
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_relations_user_id ON knowledge_relations(user_id)");
    ensureColumn("knowledge_relations", "user_id", "INTEGER REFERENCES users(id) ON DELETE CASCADE");

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_insights (
        id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        insight_type TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        trigger_capture_id TEXT REFERENCES knowledge_captures(id) ON DELETE SET NULL,
        related_capture_ids_json TEXT NOT NULL DEFAULT '[]',
        related_concept_ids_json TEXT NOT NULL DEFAULT '[]',
        dismissed_by_user INTEGER NOT NULL DEFAULT 0,
        confidence REAL NOT NULL DEFAULT 0.5,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT
      )
    `);
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_insights_type
      ON knowledge_insights(insight_type)
    `);
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_insights_dismissed
      ON knowledge_insights(dismissed_by_user)
    `);
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_insights_created_at
      ON knowledge_insights(created_at)
    `);
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_insights_user_id ON knowledge_insights(user_id)");
    ensureColumn("knowledge_insights", "user_id", "INTEGER REFERENCES users(id) ON DELETE CASCADE");
  },
};
