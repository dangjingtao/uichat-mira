import { asc, eq, inArray } from "drizzle-orm";
import { getDb, getSqlite } from "../index.js";
import { chatMedia } from "../schema.js";

export type ChatMediaType = "audio" | "image";

const ensureTable = () => {
  getSqlite().exec(`
    CREATE TABLE IF NOT EXISTS chat_media (
      id TEXT PRIMARY KEY NOT NULL,
      thread_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      media_type TEXT NOT NULL CHECK (media_type IN ('audio', 'image')),
      absolute_path TEXT NOT NULL UNIQUE,
      mime_type TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_chat_media_message_id ON chat_media(message_id);
    CREATE INDEX IF NOT EXISTS idx_chat_media_thread_id ON chat_media(thread_id);
    CREATE INDEX IF NOT EXISTS idx_chat_media_task_id ON chat_media(task_id);
  `);
};

export const chatMediaRepository = {
  initialize: ensureTable,
  create(input: Omit<typeof chatMedia.$inferInsert, "createdAt">) {
    ensureTable();
    return getDb().insert(chatMedia).values(input).returning().get();
  },
  restore(input: typeof chatMedia.$inferInsert) {
    ensureTable();
    return getDb().insert(chatMedia).values(input).run().changes;
  },
  getById(id: string) {
    ensureTable();
    return getDb().select().from(chatMedia).where(eq(chatMedia.id, id)).get() ?? null;
  },
  listByMessageIds(messageIds: string[]) {
    if (!messageIds.length) return [];
    ensureTable();
    return getDb().select().from(chatMedia).where(inArray(chatMedia.messageId, messageIds)).orderBy(asc(chatMedia.createdAt)).all();
  },
  listByThreadId(threadId: string) {
    ensureTable();
    return getDb().select().from(chatMedia).where(eq(chatMedia.threadId, threadId)).all();
  },
  listAll() {
    ensureTable();
    return getDb().select().from(chatMedia).all();
  },
  countByPath(absolutePath: string) {
    ensureTable();
    return getDb().select().from(chatMedia).where(eq(chatMedia.absolutePath, absolutePath)).all().length;
  },
  deleteByIds(ids: string[]) {
    if (!ids.length) return 0;
    ensureTable();
    return getDb().delete(chatMedia).where(inArray(chatMedia.id, ids)).run().changes;
  },
};
