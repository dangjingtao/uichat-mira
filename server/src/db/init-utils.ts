import type Database from "better-sqlite3";

export const applySqliteConnectionPragmas = (sqlite: Database.Database) => {
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
};

export const withSqliteForeignKeysDisabled = <T>(
  sqlite: Database.Database,
  run: () => T,
) => {
  sqlite.pragma("foreign_keys = OFF");

  try {
    return run();
  } finally {
    sqlite.pragma("foreign_keys = ON");
  }
};
