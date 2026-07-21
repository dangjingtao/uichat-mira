import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const getArgument = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const databasePath = getArgument("--database");
const userId = Number(getArgument("--user-id"));

if (!databasePath || !Number.isInteger(userId) || userId <= 0) {
  throw new Error(
    "Usage: pnpm exec tsx server/scripts/migrate-evolving-knowledge-user-id.ts --database <path> --user-id <id>",
  );
}

const resolvedDatabasePath = path.resolve(databasePath);
if (!fs.existsSync(resolvedDatabasePath)) {
  throw new Error(`Database file does not exist: ${resolvedDatabasePath}`);
}

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const artifactDir = path.join(repositoryRoot, ".test-artifact");
fs.mkdirSync(artifactDir, { recursive: true });
const backupPath = path.join(
  artifactDir,
  `evolving-knowledge-before-migration-${Date.now()}.sqlite`,
);

const sqlite = new Database(resolvedDatabasePath);

const hasTable = (tableName: string) =>
  Boolean(
    sqlite
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
      )
      .get(tableName),
  );

const tableInfo = (tableName: string) =>
  sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    name: string;
    pk: number;
  }>;

const ensureUserColumn = (tableName: string) => {
  if (!hasTable(tableName)) {
    return false;
  }

  if (!tableInfo(tableName).some((column) => column.name === "user_id")) {
    sqlite.exec(
      `ALTER TABLE ${tableName} ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`,
    );
  }

  sqlite.prepare(`UPDATE ${tableName} SET user_id = ? WHERE user_id IS NULL`).run(
    userId,
  );
  return true;
};

const migrateTagsTable = () => {
  if (!ensureUserColumn("knowledge_tags_evolution")) {
    return;
  }

  const columns = tableInfo("knowledge_tags_evolution");
  const hasCompositePrimaryKey =
    columns.some((column) => column.name === "tag_name" && column.pk === 1) &&
    columns.some((column) => column.name === "user_id" && column.pk === 2);

  if (hasCompositePrimaryKey) {
    return;
  }

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
  `);
  sqlite.exec("DROP TABLE knowledge_tags_evolution_legacy");
};

try {
  await sqlite.backup(backupPath);

  const userExists = sqlite
    .prepare("SELECT 1 FROM users WHERE id = ? LIMIT 1")
    .get(userId);
  if (!userExists) {
    throw new Error(`User does not exist: ${userId}`);
  }

  sqlite.exec("PRAGMA foreign_keys = OFF");
  const migrate = sqlite.transaction(() => {
    for (const tableName of [
      "knowledge_captures",
      "knowledge_relations",
      "knowledge_insights",
    ]) {
      ensureUserColumn(tableName);
    }
    migrateTagsTable();

    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_captures_user_id ON knowledge_captures(user_id)");
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_tags_user_id ON knowledge_tags_evolution(user_id)");
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_relations_user_id ON knowledge_relations(user_id)");
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_insights_user_id ON knowledge_insights(user_id)");
  });

  migrate();
  sqlite.exec("PRAGMA foreign_keys = ON");

  console.log(`Migration completed for user ${userId}.`);
  console.log(`Backup created at ${backupPath}`);
} finally {
  sqlite.close();
}
