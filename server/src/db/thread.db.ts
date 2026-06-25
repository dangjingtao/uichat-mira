import { getSqlite } from "@/db";
import { applySqliteConnectionPragmas } from "@/db/init-utils";
import { hasSqliteColumn, hasSqliteTable } from "@/db/sqlite-utils";

const createThreadTables = () => {
  const sqlite = getSqlite();

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      model_name TEXT,
      knowledge_base_id TEXT REFERENCES knowledge_bases(id) ON DELETE CASCADE,
      role_id TEXT REFERENCES roles(id) ON DELETE SET NULL,
      context_summary TEXT,
      context_summary_updated_at TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      parts_json TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_threads_user_id ON threads(user_id);
    CREATE INDEX IF NOT EXISTS idx_threads_status ON threads(status);
    CREATE INDEX IF NOT EXISTS idx_threads_updated_at ON threads(updated_at);
    CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
  `);
};

const ensureThreadKnowledgeBaseColumn = () => {
  const sqlite = getSqlite();

  const hasKnowledgeBaseColumn = hasSqliteColumn(
    sqlite,
    "threads",
    "knowledge_base_id",
  );

  if (!hasKnowledgeBaseColumn) {
    sqlite.exec(`
      ALTER TABLE threads
      ADD COLUMN knowledge_base_id TEXT REFERENCES knowledge_bases(id) ON DELETE CASCADE;
    `);
  }

  sqlite.exec(
    "CREATE INDEX IF NOT EXISTS idx_threads_knowledge_base ON threads(knowledge_base_id);",
  );
};

const ensureThreadRoleColumn = () => {
  const sqlite = getSqlite();

  const hasRoleIdColumn = hasSqliteColumn(sqlite, "threads", "role_id");
  if (!hasRoleIdColumn) {
    sqlite.exec(`
      ALTER TABLE threads
      ADD COLUMN role_id TEXT REFERENCES roles(id) ON DELETE SET NULL;
    `);
  }

  sqlite.exec(
    "CREATE INDEX IF NOT EXISTS idx_threads_role_id ON threads(role_id);",
  );
};

const ensureThreadContextSummaryColumns = () => {
  const sqlite = getSqlite();

  if (!hasSqliteColumn(sqlite, "threads", "context_summary")) {
    sqlite.exec(`
      ALTER TABLE threads
      ADD COLUMN context_summary TEXT;
    `);
  }

  if (!hasSqliteColumn(sqlite, "threads", "context_summary_updated_at")) {
    sqlite.exec(`
      ALTER TABLE threads
      ADD COLUMN context_summary_updated_at TEXT;
    `);
  }
};

const ensureMessagePartsJsonColumn = () => {
  const sqlite = getSqlite();

  const hasPartsJsonColumn = hasSqliteColumn(sqlite, "messages", "parts_json");

  if (!hasPartsJsonColumn) {
    sqlite.exec(`
      ALTER TABLE messages
      ADD COLUMN parts_json TEXT;
    `);
  }
};

export const initializeThreadDatabase = () => {
  try {
    const sqlite = getSqlite();
    applySqliteConnectionPragmas(sqlite);

    createThreadTables();
    ensureThreadKnowledgeBaseColumn();
    ensureThreadRoleColumn();
    ensureThreadContextSummaryColumns();
    ensureMessagePartsJsonColumn();
  } catch (error) {
    console.error("Failed to initialize thread database:", error);
    throw error;
  }
};

export const getThreadDatabaseHealth = () => ({
  hasThreadsTable: hasSqliteTable(getSqlite(), "threads"),
  hasMessagesTable: hasSqliteTable(getSqlite(), "messages"),
  hasThreadUserIdColumn: hasSqliteColumn(getSqlite(), "threads", "user_id"),
  hasThreadKnowledgeBaseIdColumn: hasSqliteColumn(
    getSqlite(),
    "threads",
    "knowledge_base_id",
  ),
  hasThreadRoleIdColumn: hasSqliteColumn(getSqlite(), "threads", "role_id"),
});
