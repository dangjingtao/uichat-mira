import {
  DEFAULT_CHUNKING_CONFIG,
  DEFAULT_KNOWLEDGE_BASE_DESCRIPTION,
  DEFAULT_KNOWLEDGE_BASE_ID,
  DEFAULT_KNOWLEDGE_BASE_NAME,
} from "@/constants/knowledge-base.js";
import { eq } from "drizzle-orm";
import { getDb, getSqlite, knowledgeBases } from "@/db";
import { applySqliteConnectionPragmas } from "@/db/init-utils";
import {
  assertSqliteIdentifier,
  getSqliteTableSql,
  hasSqliteTable,
} from "@/db/sqlite-utils";

export const DEFAULT_VECTOR_TABLE_NAME = "document_chunk_embeddings_vec";

const ensureDocumentChunkFts = () => {
  const sqlite = getSqlite();

  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS document_chunks_fts
    USING fts5(
      content,
      content='document_chunks',
      content_rowid='id',
      tokenize='unicode61'
    );

    CREATE TRIGGER IF NOT EXISTS document_chunks_ai
    AFTER INSERT ON document_chunks
    BEGIN
      INSERT INTO document_chunks_fts(rowid, content) VALUES (new.id, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS document_chunks_ad
    AFTER DELETE ON document_chunks
    BEGIN
      INSERT INTO document_chunks_fts(document_chunks_fts, rowid, content)
      VALUES ('delete', old.id, old.content);
    END;

    CREATE TRIGGER IF NOT EXISTS document_chunks_au
    AFTER UPDATE ON document_chunks
    BEGIN
      INSERT INTO document_chunks_fts(document_chunks_fts, rowid, content)
      VALUES ('delete', old.id, old.content);
      INSERT INTO document_chunks_fts(rowid, content) VALUES (new.id, new.content);
    END;
  `);
};

export const rebuildDocumentChunkFts = () => {
  const sqlite = getSqlite();

  const tx = sqlite.transaction(() => {
    sqlite.exec(`
      DROP TRIGGER IF EXISTS document_chunks_ai;
      DROP TRIGGER IF EXISTS document_chunks_ad;
      DROP TRIGGER IF EXISTS document_chunks_au;
      DROP TABLE IF EXISTS document_chunks_fts;
    `);

    ensureDocumentChunkFts();

    sqlite.exec(`
      INSERT INTO document_chunks_fts(rowid, content)
      SELECT id, content
      FROM document_chunks;
    `);
    sqlite.exec(`INSERT INTO document_chunks_fts(document_chunks_fts) VALUES ('optimize');`);
  });

  tx();
};

export const ensureChunkEmbeddingVectorTable = ({
  dimensions,
  tableName = DEFAULT_VECTOR_TABLE_NAME,
}: {
  dimensions: number;
  tableName?: string;
}) => {
  if (!Number.isInteger(dimensions) || dimensions <= 0) {
    throw new Error("Vector dimensions must be a positive integer");
  }

  assertSqliteIdentifier(tableName, "Invalid vector table name");

  const sqlite = getSqlite();
  const existingSql = getSqliteTableSql(sqlite, tableName);

  if (!existingSql) {
    sqlite.exec(`
      CREATE VIRTUAL TABLE ${tableName}
      USING vec0(
        chunk_id INTEGER PRIMARY KEY,
        embedding FLOAT[${dimensions}]
      );
    `);
    return;
  }

  const expectedToken = `FLOAT[${dimensions}]`;
  const normalizedSql = existingSql.toUpperCase();
  if (
    !normalizedSql.includes(expectedToken) ||
    !normalizedSql.includes("CHUNK_ID INTEGER PRIMARY KEY")
  ) {
    throw new Error(
      `Existing vector table ${tableName} does not match expected dimensions ${dimensions}`,
    );
  }
};

const ensureKnowledgeBaseTables = () => {
  const sqlite = getSqlite();

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_bases (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
      embedding_model_config_id TEXT REFERENCES model_configs(id) ON DELETE SET NULL,
      chunking_config_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      knowledge_base_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'upload' CHECK (source_type IN ('upload', 'sync', 'api')),
      source_label TEXT,
      file_ext TEXT NOT NULL,
      mime_type TEXT,
      file_size INTEGER,
      content_text TEXT NOT NULL DEFAULT '',
      index_status TEXT NOT NULL DEFAULT 'processing' CHECK (index_status IN ('processing', 'ready', 'failed')),
      enabled INTEGER NOT NULL DEFAULT 1,
      chunk_count INTEGER NOT NULL DEFAULT 0,
      char_count INTEGER NOT NULL DEFAULT 0,
      token_count INTEGER,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS document_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      knowledge_base_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      char_count INTEGER NOT NULL DEFAULT 0,
      token_count INTEGER,
      start_offset INTEGER,
      end_offset INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(document_id, chunk_index)
    );

    CREATE TABLE IF NOT EXISTS knowledge_base_vector_indexes (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      knowledge_base_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
      table_name TEXT NOT NULL UNIQUE,
      embedding_model_config_id TEXT REFERENCES model_configs(id) ON DELETE SET NULL,
      dimensions INTEGER NOT NULL,
      distance_metric TEXT NOT NULL DEFAULT 'cosine' CHECK (distance_metric IN ('cosine', 'l2', 'inner_product')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_knowledge_bases_status ON knowledge_bases(status);
    CREATE INDEX IF NOT EXISTS idx_documents_knowledge_base ON documents(knowledge_base_id);
    CREATE INDEX IF NOT EXISTS idx_documents_index_status ON documents(index_status);
    CREATE INDEX IF NOT EXISTS idx_documents_enabled ON documents(enabled);
    CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
    CREATE INDEX IF NOT EXISTS idx_document_chunks_knowledge_base ON document_chunks(knowledge_base_id);
    CREATE INDEX IF NOT EXISTS idx_document_chunks_document ON document_chunks(document_id);
    CREATE INDEX IF NOT EXISTS idx_kb_vector_indexes_knowledge_base ON knowledge_base_vector_indexes(knowledge_base_id);
  `);
};

const ensureDefaultKnowledgeBase = () => {
  const db = getDb();
  const existing = db
    .select()
    .from(knowledgeBases)
    .where(eq(knowledgeBases.id, DEFAULT_KNOWLEDGE_BASE_ID))
    .get();

  if (existing) {
    return;
  }

  db.insert(knowledgeBases)
    .values({
      id: DEFAULT_KNOWLEDGE_BASE_ID,
      name: DEFAULT_KNOWLEDGE_BASE_NAME,
      description: DEFAULT_KNOWLEDGE_BASE_DESCRIPTION,
      status: "active",
      chunkingConfigJson: JSON.stringify(DEFAULT_CHUNKING_CONFIG),
    })
    .run();
};

export const initializeKnowledgeBaseDatabase = () => {
  try {
    const sqlite = getSqlite();
    applySqliteConnectionPragmas(sqlite);

    ensureKnowledgeBaseTables();
    ensureDocumentChunkFts();
    ensureDefaultKnowledgeBase();
  } catch (error) {
    console.error("Failed to initialize knowledge base database:", error);
    throw error;
  }
};

export const getKnowledgeBaseDatabaseHealth = () => {
  const sqlite = getSqlite();

  return {
    hasKnowledgeBasesTable: hasSqliteTable(sqlite, "knowledge_bases"),
    hasDocumentsTable: hasSqliteTable(sqlite, "documents"),
    hasDocumentChunksTable: hasSqliteTable(sqlite, "document_chunks"),
    hasChunkFtsTable: hasSqliteTable(sqlite, "document_chunks_fts"),
    hasVectorIndexRegistryTable: hasSqliteTable(
      sqlite,
      "knowledge_base_vector_indexes",
    ),
  };
};
