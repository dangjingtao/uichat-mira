import type Database from "better-sqlite3";

const SQLITE_IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export const assertSqliteIdentifier = (
  value: string,
  message = "Invalid SQLite identifier",
) => {
  if (!SQLITE_IDENTIFIER_PATTERN.test(value)) {
    throw new Error(message);
  }

  return value;
};

export const hasSqliteTable = (
  sqlite: Database.Database,
  tableName: string,
) => {
  const row = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name = ? LIMIT 1",
    )
    .get(tableName);

  return Boolean(row);
};

export const hasSqliteColumn = (
  sqlite: Database.Database,
  tableName: string,
  columnName: string,
) => {
  if (!hasSqliteTable(sqlite, tableName)) {
    return false;
  }

  assertSqliteIdentifier(tableName);

  const rows = sqlite
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>;

  return rows.some((row) => row.name === columnName);
};

export const getSqliteTableSql = (
  sqlite: Database.Database,
  tableName: string,
) => {
  const row = sqlite
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
    )
    .get(tableName) as { sql?: string } | undefined;

  return row?.sql ?? null;
};

export const hasSqliteForeignKeyReference = (
  sqlite: Database.Database,
  tableName: string,
  fromColumn: string,
  referencedTable: string,
) => {
  if (
    !hasSqliteTable(sqlite, tableName) ||
    !hasSqliteColumn(sqlite, tableName, fromColumn)
  ) {
    return false;
  }

  assertSqliteIdentifier(tableName);

  const rows = sqlite
    .prepare(`PRAGMA foreign_key_list(${tableName})`)
    .all() as Array<{ from: string; table: string }>;

  return rows.some(
    (row) => row.from === fromColumn && row.table === referencedTable,
  );
};
