import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, getSqlite } from "../index";
import { ttsRefAudios } from "../schema";

export type TtsRefAudioSummary = {
  id: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  createdAt: string;
  lastUsedAt: string;
};

const ensureTable = () => {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tts_ref_audios (
      id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
      original_name TEXT NOT NULL DEFAULT 'ref-audio.wav',
      mime_type TEXT NOT NULL DEFAULT 'audio/wav',
      byte_size INTEGER NOT NULL,
      sha256 TEXT NOT NULL UNIQUE,
      audio_blob BLOB NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_used_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_tts_ref_audios_last_used_at
    ON tts_ref_audios(last_used_at)
  `);
};

const toSummary = (row: typeof ttsRefAudios.$inferSelect): TtsRefAudioSummary => ({
  id: row.id,
  originalName: row.originalName,
  mimeType: row.mimeType,
  byteSize: row.byteSize,
  sha256: row.sha256,
  createdAt: row.createdAt,
  lastUsedAt: row.lastUsedAt,
});

export const ttsRefAudiosRepository = {
  initialize() {
    ensureTable();
  },

  saveOrGet(input: {
    buffer: Buffer;
    originalName: string;
    mimeType?: string;
  }) {
    ensureTable();
    const sha256 = crypto.createHash("sha256").update(input.buffer).digest("hex");
    const existing = getDb()
      .select()
      .from(ttsRefAudios)
      .where(eq(ttsRefAudios.sha256, sha256))
      .get();

    if (existing) {
      const row = getDb()
        .update(ttsRefAudios)
        .set({ lastUsedAt: new Date().toISOString() })
        .where(eq(ttsRefAudios.id, existing.id))
        .returning()
        .get();
      return { summary: toSummary(row), isNew: false };
    }

    const row = getDb()
      .insert(ttsRefAudios)
      .values({
        originalName: input.originalName,
        mimeType: input.mimeType || "audio/wav",
        byteSize: input.buffer.byteLength,
        sha256,
        audioBlob: input.buffer,
      })
      .returning()
      .get();
    return { summary: toSummary(row), isNew: true };
  },

  getById(id: string) {
    ensureTable();
    return getDb()
      .select()
      .from(ttsRefAudios)
      .where(eq(ttsRefAudios.id, id))
      .get();
  },

  touch(id: string) {
    ensureTable();
    getDb()
      .update(ttsRefAudios)
      .set({ lastUsedAt: new Date().toISOString() })
      .where(eq(ttsRefAudios.id, id))
      .run();
  },
};
