import { eq } from "drizzle-orm";
import {
  getDb,
  getSqlite,
  knowledgeBaseVectorIndexes,
} from "@/db";
import { and, ne } from "drizzle-orm";
import {
  assertSqliteIdentifier,
  hasSqliteTable,
} from "@/db/sqlite-utils";
import {
  DEFAULT_VECTOR_TABLE_NAME,
  ensureChunkEmbeddingVectorTable,
} from "@/db/knowledge-base.db";
import { nowIso } from "@/utils/time.js";

const sanitizeTableName = (tableName: string) => {
  return assertSqliteIdentifier(tableName, "Invalid vector table name");
};

const toVectorPrimaryKey = (chunkId: number) => {
  if (!Number.isInteger(chunkId)) {
    throw new Error(`Invalid chunk id for vector store: ${chunkId}`);
  }

  return BigInt(chunkId);
};

const toVectorTableName = (params: {
  knowledgeBaseId: string;
  embeddingModelConfigId: string;
  model: string;
  dimensions: number;
}) => {
  const knowledgeBasePart = params.knowledgeBaseId
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12);

  const normalizedModel = params.model
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);

  const configPart = params.embeddingModelConfigId
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12);

  const suffix = [
    knowledgeBasePart || "kb",
    normalizedModel || "model",
    configPart || "config",
    `${params.dimensions}`,
  ].filter(Boolean).join("_");

  return sanitizeTableName(`${DEFAULT_VECTOR_TABLE_NAME}_${suffix}`);
};

export const knowledgeBaseVectorStore = {
  ensureDefaultVectorIndex(params: {
    knowledgeBaseId: string;
    embeddingModelConfigId: string;
    model: string;
    dimensions: number;
    tableName?: string;
  }) {
    const now = nowIso();
    const tableName = sanitizeTableName(
      params.tableName ??
        toVectorTableName({
          knowledgeBaseId: params.knowledgeBaseId,
          embeddingModelConfigId: params.embeddingModelConfigId,
          model: params.model,
          dimensions: params.dimensions,
        }),
    );

    ensureChunkEmbeddingVectorTable({
      dimensions: params.dimensions,
      tableName,
    });

    const db = getDb();
    const existing = db
      .select()
      .from(knowledgeBaseVectorIndexes)
      .where(eq(knowledgeBaseVectorIndexes.tableName, tableName))
      .limit(1)
      .get();

    db.update(knowledgeBaseVectorIndexes)
      .set({
        isActive: false,
        updatedAt: now,
      })
      .where(
        and(
          eq(knowledgeBaseVectorIndexes.knowledgeBaseId, params.knowledgeBaseId),
          ne(knowledgeBaseVectorIndexes.tableName, tableName),
        ),
      )
      .run();

    if (existing) {
      db.update(knowledgeBaseVectorIndexes)
        .set({
          embeddingModelConfigId: params.embeddingModelConfigId,
          dimensions: params.dimensions,
          isActive: true,
          updatedAt: now,
        })
        .where(eq(knowledgeBaseVectorIndexes.id, existing.id))
        .run();

      return {
        tableName,
        dimensions: params.dimensions,
      };
    }

    db.insert(knowledgeBaseVectorIndexes)
      .values({
        knowledgeBaseId: params.knowledgeBaseId,
        tableName,
        embeddingModelConfigId: params.embeddingModelConfigId,
        dimensions: params.dimensions,
        distanceMetric: "cosine",
        isActive: true,
      })
      .run();

    return {
      tableName,
      dimensions: params.dimensions,
    };
  },

  listVectorIndexTableNames(knowledgeBaseId: string): string[] {
    const db = getDb();
    return db
      .select({ tableName: knowledgeBaseVectorIndexes.tableName })
      .from(knowledgeBaseVectorIndexes)
      .where(eq(knowledgeBaseVectorIndexes.knowledgeBaseId, knowledgeBaseId))
      .all()
      .map((row) => row.tableName);
  },

  upsertChunkEmbeddings(params: {
    tableName?: string;
    rows: Array<{
      chunkId: number;
      embedding: number[];
    }>;
  }) {
    if (params.rows.length === 0) {
      return;
    }

    const tableName = sanitizeTableName(
      params.tableName ?? DEFAULT_VECTOR_TABLE_NAME,
    );
    const sqlite = getSqlite();
    const statement = sqlite.prepare(
      `INSERT OR REPLACE INTO ${tableName} (chunk_id, embedding) VALUES (?, ?)`,
    );

    const tx = sqlite.transaction(
      (rows: Array<{ chunkId: number; embedding: number[] }>) => {
        for (const row of rows) {
          statement.run(
            toVectorPrimaryKey(row.chunkId),
            JSON.stringify(row.embedding),
          );
        }
      },
    );

    tx(params.rows);
  },

  deleteChunkEmbeddings(params: {
    tableName?: string;
    tableNames?: string[];
    chunkIds: number[];
  }) {
    if (params.chunkIds.length === 0) {
      return;
    }

    const sqlite = getSqlite();
    const tableNames = (
      params.tableNames?.length
        ? params.tableNames
        : [params.tableName ?? DEFAULT_VECTOR_TABLE_NAME]
    ).map((tableName) => sanitizeTableName(tableName));

    const statements = tableNames
      .filter((tableName) => hasSqliteTable(sqlite, tableName))
      .map((tableName) =>
      sqlite.prepare(`DELETE FROM ${tableName} WHERE chunk_id = ?`),
      );

    if (statements.length === 0) {
      return;
    }

    const tx = sqlite.transaction((chunkIds: number[]) => {
      for (const statement of statements) {
        for (const chunkId of chunkIds) {
          statement.run(chunkId);
        }
      }
    });

    tx(params.chunkIds);
  },
};
