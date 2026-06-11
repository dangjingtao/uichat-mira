import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { applySqliteConnectionPragmas } from "./init-utils";
import * as schema from "./schema";

export * from "./schema";
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

export interface VectorStoreHealth {
  ok: boolean;
  provider: "sqlite-vec";
  detail: string;
  extensionPath?: string;
}

let vectorStoreHealth: VectorStoreHealth = {
  ok: false,
  provider: "sqlite-vec",
  detail: "sqlite-vec 尚未初始化",
};

export const getSqlite = (): Database.Database => {
  if (!sqlite) {
    sqlite = new Database(resolveDatabasePath(), {
      readonly: false,
      fileMustExist: false,
    });
    applySqliteConnectionPragmas(sqlite);
  }
  return sqlite;
};

export const getDb = () => {
  if (!db) {
    db = drizzle(getSqlite(), { schema });
    console.log("[Database] ✅ Drizzle database client initialized");
  }
  return db;
};

export const initializeVectorStore = (): VectorStoreHealth => {
  try {
    const extensionPath = sqliteVec.getLoadablePath();
    const sqliteInstance = getSqlite();
    sqliteVec.load(sqliteInstance);

    vectorStoreHealth = {
      ok: true,
      provider: "sqlite-vec",
      detail: "sqlite-vec 扩展已加载",
      extensionPath,
    };
  } catch (error) {
    vectorStoreHealth = {
      ok: false,
      provider: "sqlite-vec",
      detail:
        error instanceof Error
          ? `sqlite-vec 扩展加载失败: ${error.message}`
          : "sqlite-vec 扩展加载失败",
    };
  }

  return vectorStoreHealth;
};

export const getVectorStoreHealth = (): VectorStoreHealth => vectorStoreHealth;
