import type Database from "better-sqlite3";

export const applySqliteConnectionPragmas = (sqlite: Database.Database) => {
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
};
