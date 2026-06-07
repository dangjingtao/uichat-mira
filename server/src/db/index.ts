/**
 * 统一的数据库连接管理
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

// Re-export schema
export * from "./schema";

// Re-export repositories
export * from "./repositories";

const resolveDatabasePath = (): string => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  if (databaseUrl.startsWith("file:")) {
    return databaseUrl.slice(5);
  }

  if (databaseUrl.endsWith(".db") || databaseUrl.endsWith(".sqlite")) {
    return databaseUrl;
  }

  throw new Error("Only SQLite DATABASE_URL is supported");
};

let sqlite: Database.Database | null = null;
let db: ReturnType<typeof drizzle> | null = null;

/**
 * 获取原生 SQLite 数据库连接（用于执行原始 SQL）
 */
export const getSqlite = (): Database.Database => {
  if (!sqlite) {
    sqlite = new Database(resolveDatabasePath(), {
      readonly: false,
      fileMustExist: false,
    });
  }
  return sqlite;
};

/**
 * 获取 Drizzle 数据库实例
 */
export const getDb = () => {
  if (!db) {
    db = drizzle(getSqlite(), { schema });
  }
  return db;
};
