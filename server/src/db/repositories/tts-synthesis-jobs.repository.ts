import { desc, eq } from "drizzle-orm";
import { getDb, getSqlite } from "../index";
import { ttsSynthesisJobs } from "../schema";

export type TtsProviderId = "windows_builtin" | "piper_local";
export type TtsSynthesisStatus = "queued" | "running" | "succeeded" | "failed";

export type TtsSynthesisJobRecord = {
  id: string;
  providerId: TtsProviderId;
  status: TtsSynthesisStatus;
  text: string;
  voice: string | null;
  requestConfig: Record<string, unknown>;
  outputPath: string | null;
  mimeType: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

const parseJson = (value: string, fallback: Record<string, unknown>) => {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return fallback;
  }
};

const ensureTable = () => {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tts_synthesis_jobs (
      id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
      provider_id TEXT NOT NULL,
      status TEXT NOT NULL,
      text TEXT NOT NULL DEFAULT '',
      voice TEXT,
      request_config_json TEXT NOT NULL DEFAULT '{}',
      output_path TEXT,
      mime_type TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    )
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_tts_synthesis_jobs_created_at
    ON tts_synthesis_jobs(created_at)
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_tts_synthesis_jobs_provider_status
    ON tts_synthesis_jobs(provider_id, status)
  `);
};

const toRecord = (
  row: typeof ttsSynthesisJobs.$inferSelect,
): TtsSynthesisJobRecord => ({
  id: row.id,
  providerId: row.providerId as TtsProviderId,
  status: row.status as TtsSynthesisStatus,
  text: row.text,
  voice: row.voice ?? null,
  requestConfig: parseJson(row.requestConfigJson ?? "{}", {}),
  outputPath: row.outputPath ?? null,
  mimeType: row.mimeType ?? null,
  errorMessage: row.errorMessage ?? null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  completedAt: row.completedAt ?? null,
});

export const ttsSynthesisJobsRepository = {
  initialize() {
    ensureTable();
  },

  listRecent(limit = 20) {
    return getDb()
      .select()
      .from(ttsSynthesisJobs)
      .orderBy(desc(ttsSynthesisJobs.createdAt))
      .limit(limit)
      .all()
      .map(toRecord);
  },

  getById(id: string) {
    const row = getDb()
      .select()
      .from(ttsSynthesisJobs)
      .where(eq(ttsSynthesisJobs.id, id))
      .get();
    return row ? toRecord(row) : null;
  },

  create(input: {
    providerId: TtsProviderId;
    status: TtsSynthesisStatus;
    text: string;
    voice?: string | null;
    requestConfig?: Record<string, unknown>;
  }) {
    const row = getDb()
      .insert(ttsSynthesisJobs)
      .values({
        providerId: input.providerId,
        status: input.status,
        text: input.text,
        voice: input.voice ?? null,
        requestConfigJson: JSON.stringify(input.requestConfig ?? {}),
      })
      .returning()
      .get();
    return toRecord(row);
  },

  markRunning(id: string, outputPath?: string | null) {
    const row = getDb()
      .update(ttsSynthesisJobs)
      .set({
        status: "running",
        outputPath: outputPath ?? null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(ttsSynthesisJobs.id, id))
      .returning()
      .get();
    return row ? toRecord(row) : null;
  },

  markSucceeded(id: string, input: { outputPath: string; mimeType: string }) {
    const row = getDb()
      .update(ttsSynthesisJobs)
      .set({
        status: "succeeded",
        outputPath: input.outputPath,
        mimeType: input.mimeType,
        errorMessage: null,
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      })
      .where(eq(ttsSynthesisJobs.id, id))
      .returning()
      .get();
    return row ? toRecord(row) : null;
  },

  markFailed(id: string, errorMessage: string) {
    const row = getDb()
      .update(ttsSynthesisJobs)
      .set({
        status: "failed",
        errorMessage,
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      })
      .where(eq(ttsSynthesisJobs.id, id))
      .returning()
      .get();
    return row ? toRecord(row) : null;
  },
};
