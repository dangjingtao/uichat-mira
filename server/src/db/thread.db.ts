import { getSqlite } from "@/db";
import {
  applySqliteConnectionPragmas,
  withSqliteForeignKeysDisabled,
} from "@/db/init-utils";
import {
  hasSqliteColumn,
  hasSqliteForeignKeyReference,
  hasSqliteTable,
} from "@/db/sqlite-utils";

const hasThreadUserForeignKey = () => {
  const sqlite = getSqlite();
  return hasSqliteForeignKeyReference(sqlite, "threads", "user_id", "users");
};

const getDefaultUserId = () => {
  const sqlite = getSqlite();
  const row = sqlite
    .prepare("SELECT id FROM users ORDER BY id ASC LIMIT 1")
    .get() as { id: number } | undefined;

  if (!row) {
    throw new Error("Cannot initialize threads table before at least one user exists");
  }

  return row.id;
};

const createThreadTables = () => {
  const sqlite = getSqlite();

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      model_name TEXT,
      rag_enabled INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
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

const rebuildLegacyThreadTables = () => {
  const sqlite = getSqlite();
  const defaultUserId = getDefaultUserId();
  const hasMessages = hasSqliteTable(sqlite, "messages");

  withSqliteForeignKeysDisabled(sqlite, () => {
    const tx = sqlite.transaction(() => {
      if (hasMessages) {
        sqlite.exec("ALTER TABLE messages RENAME TO messages__legacy;");
      }

      sqlite.exec("ALTER TABLE threads RENAME TO threads__legacy;");

      createThreadTables();

      sqlite
        .prepare(`
          INSERT INTO threads (
            id,
            user_id,
            title,
            model_name,
            rag_enabled,
            status,
            created_at,
            updated_at
          )
          SELECT
            id,
            ?,
            title,
            model_name,
            0,
            status,
            created_at,
            updated_at
          FROM threads__legacy
        `)
        .run(defaultUserId);

      if (hasMessages) {
        sqlite.exec(`
          INSERT INTO messages (
            id,
            thread_id,
            role,
            content,
            metadata,
            created_at
          )
          SELECT
            id,
            thread_id,
            role,
            content,
            metadata,
            created_at
          FROM messages__legacy;
        `);
      }

      if (hasMessages) {
        sqlite.exec("DROP TABLE messages__legacy;");
      }

      sqlite.exec("DROP TABLE threads__legacy;");
    });

    tx();
  });
};

const ensureThreadTables = () => {
  const sqlite = getSqlite();

  if (!hasSqliteTable(sqlite, "threads")) {
    createThreadTables();
    return;
  }

  if (!hasSqliteColumn(sqlite, "threads", "user_id") || !hasThreadUserForeignKey()) {
    rebuildLegacyThreadTables();
    return;
  }

  if (!hasSqliteColumn(sqlite, "threads", "rag_enabled")) {
    sqlite.exec(
      "ALTER TABLE threads ADD COLUMN rag_enabled INTEGER NOT NULL DEFAULT 0;",
    );
  }

  createThreadTables();
};

export const initializeThreadDatabase = () => {
  try {
    const sqlite = getSqlite();
    applySqliteConnectionPragmas(sqlite);

    ensureThreadTables();
  } catch (error) {
    console.error("Failed to initialize thread database:", error);
    throw error;
  }
};

export const getThreadDatabaseHealth = () => ({
  hasThreadsTable: hasSqliteTable(getSqlite(), "threads"),
  hasMessagesTable: hasSqliteTable(getSqlite(), "messages"),
  hasThreadUserIdColumn: hasSqliteColumn(getSqlite(), "threads", "user_id"),
  hasThreadUserForeignKey: hasThreadUserForeignKey(),
});
