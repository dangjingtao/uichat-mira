import { getSqlite } from "@/db";

const TABLES_WITH_BOTH_TIMESTAMPS = [
  "model_configs",
  "provider_connections",
  "knowledge_bases",
  "documents",
  "knowledge_base_vector_indexes",
] as const;

const TABLES_WITH_CREATED_ONLY = [
  "users",
  "sessions",
  "model_param_templates",
  "document_chunks",
] as const;

const hasTable = (tableName: string) => {
  const sqlite = getSqlite();
  const row = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type IN ('table', 'view', 'virtual table') AND name = ? LIMIT 1",
    )
    .get(tableName);

  return Boolean(row);
};

export const repairLiteralCurrentTimestampValues = () => {
  const sqlite = getSqlite();
  const now = new Date().toISOString();

  const tx = sqlite.transaction(() => {
    for (const tableName of TABLES_WITH_BOTH_TIMESTAMPS) {
      if (!hasTable(tableName)) {
        continue;
      }

      sqlite
        .prepare(`
          UPDATE ${tableName}
          SET
            created_at = CASE
              WHEN created_at = 'CURRENT_TIMESTAMP' AND updated_at IS NOT NULL AND updated_at <> 'CURRENT_TIMESTAMP'
                THEN updated_at
              WHEN created_at = 'CURRENT_TIMESTAMP'
                THEN ?
              ELSE created_at
            END,
            updated_at = CASE
              WHEN updated_at = 'CURRENT_TIMESTAMP' AND created_at IS NOT NULL AND created_at <> 'CURRENT_TIMESTAMP'
                THEN created_at
              WHEN updated_at = 'CURRENT_TIMESTAMP'
                THEN ?
              ELSE updated_at
            END
          WHERE created_at = 'CURRENT_TIMESTAMP' OR updated_at = 'CURRENT_TIMESTAMP'
        `)
        .run(now, now);
    }

    for (const tableName of TABLES_WITH_CREATED_ONLY) {
      if (!hasTable(tableName)) {
        continue;
      }

      sqlite
        .prepare(`
          UPDATE ${tableName}
          SET created_at = ?
          WHERE created_at = 'CURRENT_TIMESTAMP'
        `)
        .run(now);
    }
  });

  tx();
};
