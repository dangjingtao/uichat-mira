import { getSqlite } from "@/db";
import { applySqliteConnectionPragmas } from "@/db/init-utils";
import { hasSqliteColumn, hasSqliteTable } from "@/db/sqlite-utils";

const createThreadTables = () => {
  const sqlite = getSqlite();

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS chat_workspaces (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      root_path TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      model_name TEXT,
      workspace_id TEXT REFERENCES chat_workspaces(id) ON DELETE SET NULL,
      knowledge_base_id TEXT REFERENCES knowledge_bases(id) ON DELETE CASCADE,
      role_id TEXT REFERENCES roles(id) ON DELETE SET NULL,
      agent_enabled INTEGER NOT NULL DEFAULT 0 CHECK (agent_enabled IN (0, 1)),
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

    CREATE INDEX IF NOT EXISTS idx_chat_workspaces_user_id ON chat_workspaces(user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_workspaces_status ON chat_workspaces(status);
    CREATE INDEX IF NOT EXISTS idx_chat_workspaces_updated_at ON chat_workspaces(updated_at);
    CREATE INDEX IF NOT EXISTS idx_threads_user_id ON threads(user_id);
    CREATE INDEX IF NOT EXISTS idx_threads_workspace_id ON threads(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_threads_status ON threads(status);
    CREATE INDEX IF NOT EXISTS idx_threads_updated_at ON threads(updated_at);
    CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
  `);
};

const rebuildThreadsTableForWorkspaceSupport = () => {
  const sqlite = getSqlite();

  const hasThreadsTable = hasSqliteTable(sqlite, "threads");
  const hasWorkspaceColumn = hasSqliteColumn(sqlite, "threads", "workspace_id");

  if (!hasThreadsTable || hasWorkspaceColumn) {
    return;
  }

  const hasKnowledgeBaseColumn = hasSqliteColumn(
    sqlite,
    "threads",
    "knowledge_base_id",
  );
  const hasRoleIdColumn = hasSqliteColumn(sqlite, "threads", "role_id");
  const hasAgentEnabledColumn = hasSqliteColumn(
    sqlite,
    "threads",
    "agent_enabled",
  );
  const hasContextSummaryColumn = hasSqliteColumn(
    sqlite,
    "threads",
    "context_summary",
  );
  const hasContextSummaryUpdatedAtColumn = hasSqliteColumn(
    sqlite,
    "threads",
    "context_summary_updated_at",
  );

  sqlite.exec("PRAGMA foreign_keys = OFF");
  sqlite.exec("BEGIN");

  try {
    sqlite.exec("ALTER TABLE threads RENAME TO threads_legacy");

    sqlite.exec(`
      CREATE TABLE threads (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL DEFAULT '',
        model_name TEXT,
        workspace_id TEXT REFERENCES chat_workspaces(id) ON DELETE SET NULL,
        knowledge_base_id TEXT REFERENCES knowledge_bases(id) ON DELETE CASCADE,
        role_id TEXT REFERENCES roles(id) ON DELETE SET NULL,
        agent_enabled INTEGER NOT NULL DEFAULT 0 CHECK (agent_enabled IN (0, 1)),
        context_summary TEXT,
        context_summary_updated_at TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    sqlite.exec(`
      INSERT INTO threads (
        id,
        user_id,
        title,
        model_name,
        workspace_id,
        knowledge_base_id,
        role_id,
        agent_enabled,
        context_summary,
        context_summary_updated_at,
        status,
        created_at,
        updated_at
      )
      SELECT
        id,
        user_id,
        title,
        model_name,
        NULL,
        ${hasKnowledgeBaseColumn ? "knowledge_base_id" : "NULL"},
        ${hasRoleIdColumn ? "role_id" : "NULL"},
        ${hasAgentEnabledColumn ? "COALESCE(agent_enabled, 0)" : "0"},
        ${hasContextSummaryColumn ? "context_summary" : "NULL"},
        ${hasContextSummaryUpdatedAtColumn ? "context_summary_updated_at" : "NULL"},
        status,
        created_at,
        updated_at
      FROM threads_legacy;
    `);

    sqlite.exec(`
      DROP TABLE threads_legacy;
      CREATE INDEX IF NOT EXISTS idx_threads_user_id ON threads(user_id);
      CREATE INDEX IF NOT EXISTS idx_threads_workspace_id ON threads(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_threads_knowledge_base ON threads(knowledge_base_id);
      CREATE INDEX IF NOT EXISTS idx_threads_role_id ON threads(role_id);
      CREATE INDEX IF NOT EXISTS idx_threads_status ON threads(status);
      CREATE INDEX IF NOT EXISTS idx_threads_updated_at ON threads(updated_at);
    `);

    sqlite.exec("COMMIT");
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  } finally {
    sqlite.exec("PRAGMA foreign_keys = ON");
  }
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

const ensureThreadWorkspaceColumn = () => {
  const sqlite = getSqlite();

  if (!hasSqliteColumn(sqlite, "threads", "workspace_id")) {
    sqlite.exec(`
      ALTER TABLE threads
      ADD COLUMN workspace_id TEXT REFERENCES chat_workspaces(id) ON DELETE SET NULL;
    `);
  }

  sqlite.exec(
    "CREATE INDEX IF NOT EXISTS idx_threads_workspace_id ON threads(workspace_id);",
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

const ensureThreadAgentEnabledColumn = () => {
  const sqlite = getSqlite();

  if (!hasSqliteColumn(sqlite, "threads", "agent_enabled")) {
    sqlite.exec(`
      ALTER TABLE threads
      ADD COLUMN agent_enabled INTEGER NOT NULL DEFAULT 0 CHECK (agent_enabled IN (0, 1));
    `);
  }
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

    rebuildThreadsTableForWorkspaceSupport();
    createThreadTables();
    ensureThreadWorkspaceColumn();
    ensureThreadKnowledgeBaseColumn();
    ensureThreadRoleColumn();
    ensureThreadAgentEnabledColumn();
    ensureThreadContextSummaryColumns();
    ensureMessagePartsJsonColumn();
  } catch (error) {
    console.error("Failed to initialize thread database:", error);
    throw error;
  }
};

export const getThreadDatabaseHealth = () => ({
  hasChatWorkspacesTable: hasSqliteTable(getSqlite(), "chat_workspaces"),
  hasThreadsTable: hasSqliteTable(getSqlite(), "threads"),
  hasMessagesTable: hasSqliteTable(getSqlite(), "messages"),
  hasThreadUserIdColumn: hasSqliteColumn(getSqlite(), "threads", "user_id"),
  hasThreadWorkspaceIdColumn: hasSqliteColumn(
    getSqlite(),
    "threads",
    "workspace_id",
  ),
  hasThreadKnowledgeBaseIdColumn: hasSqliteColumn(
    getSqlite(),
    "threads",
    "knowledge_base_id",
  ),
  hasThreadRoleIdColumn: hasSqliteColumn(getSqlite(), "threads", "role_id"),
  hasThreadAgentEnabledColumn: hasSqliteColumn(
    getSqlite(),
    "threads",
    "agent_enabled",
  ),
});
