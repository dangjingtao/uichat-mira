import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb, getSqlite } from "@/db";
import {
  DEFAULT_KNOWLEDGE_BASE_ID,
  DEFAULT_KNOWLEDGE_BASE_NAME,
} from "@/db/knowledge-base.db";
import {
  documentChunks,
  documents,
  knowledgeBases,
  type Document,
  type DocumentChunk,
  type KnowledgeBase,
  type NewDocument,
} from "@/db/schema";

export interface DocumentListFilters {
  search?: string;
  enabled?: boolean;
  indexStatus?: "processing" | "ready" | "failed";
  sortBy?: "createdAt" | "updatedAt" | "charCount" | "chunkCount";
  sortOrder?: "asc" | "desc";
}

export const knowledgeBaseRepository = {
  getDefault(): KnowledgeBase | undefined {
    const db = getDb();
    return db
      .select()
      .from(knowledgeBases)
      .where(eq(knowledgeBases.id, DEFAULT_KNOWLEDGE_BASE_ID))
      .limit(1)
      .get();
  },

  ensureDefault(): KnowledgeBase {
    const existing = this.getDefault();
    if (existing) {
      return existing;
    }

    const db = getDb();
    return db
      .insert(knowledgeBases)
      .values({
        id: DEFAULT_KNOWLEDGE_BASE_ID,
        name: DEFAULT_KNOWLEDGE_BASE_NAME,
        status: "active",
        chunkingConfigJson: "{}",
      })
      .returning()
      .get();
  },
};

export const documentRepository = {
  listByKnowledgeBase(
    knowledgeBaseId: string,
    filters: DocumentListFilters = {},
  ): Document[] {
    const db = getDb();
    const conditions = [eq(documents.knowledgeBaseId, knowledgeBaseId)];

    if (typeof filters.enabled === "boolean") {
      conditions.push(eq(documents.enabled, filters.enabled));
    }

    if (filters.indexStatus) {
      conditions.push(eq(documents.indexStatus, filters.indexStatus));
    }

    if (filters.search?.trim()) {
      const searchTerm = `%${filters.search.trim()}%`;
      conditions.push(
        sql`(${documents.name} LIKE ${searchTerm} OR ${documents.sourceLabel} LIKE ${searchTerm})`,
      );
    }

    const orderColumn = (() => {
      switch (filters.sortBy) {
        case "updatedAt":
          return documents.updatedAt;
        case "charCount":
          return documents.charCount;
        case "chunkCount":
          return documents.chunkCount;
        case "createdAt":
        default:
          return documents.createdAt;
      }
    })();

    return db
      .select()
      .from(documents)
      .where(and(...conditions))
      .orderBy(filters.sortOrder === "asc" ? asc(orderColumn) : desc(orderColumn))
      .all();
  },

  findById(id: string): Document | undefined {
    const db = getDb();
    return db.select().from(documents).where(eq(documents.id, id)).limit(1).get();
  },

  findByIdWithChunks(id: string): { document: Document; chunks: DocumentChunk[] } | null {
    const document = this.findById(id);
    if (!document) {
      return null;
    }

    const db = getDb();
    const chunks = db
      .select()
      .from(documentChunks)
      .where(eq(documentChunks.documentId, id))
      .orderBy(asc(documentChunks.chunkIndex))
      .all();

    return { document, chunks };
  },

  createWithChunks(params: {
    document: Omit<
      NewDocument,
      "id" | "createdAt" | "updatedAt" | "chunkCount" | "charCount" | "tokenCount"
    > & {
      chunkCount: number;
      charCount: number;
      tokenCount?: number | null;
    };
    chunks: Array<
      Omit<DocumentChunk, "id" | "documentId" | "createdAt"> & {
        id?: never;
        documentId?: never;
        createdAt?: never;
      }
    >;
  }): Document {
    const sqlite = getSqlite();
    const tx = sqlite.transaction(() => {
      const db = getDb();
      const created = db
        .insert(documents)
        .values(params.document)
        .returning()
        .get();

      if (params.chunks.length > 0) {
        db.insert(documentChunks)
          .values(
            params.chunks.map((chunk) => ({
              knowledgeBaseId: created.knowledgeBaseId,
              documentId: created.id,
              chunkIndex: chunk.chunkIndex,
              content: chunk.content,
              charCount: chunk.charCount,
              tokenCount: chunk.tokenCount ?? null,
              startOffset: chunk.startOffset ?? null,
              endOffset: chunk.endOffset ?? null,
            })),
          )
          .run();
      }

      return created;
    });

    return tx();
  },

  updateById(
    id: string,
    data: Partial<Omit<NewDocument, "id" | "knowledgeBaseId" | "createdAt">>,
  ): Document | undefined {
    const db = getDb();
    return db
      .update(documents)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(documents.id, id))
      .returning()
      .get();
  },

  replaceChunks(params: {
    documentId: string;
    knowledgeBaseId: string;
    contentText: string;
    chunkCount: number;
    charCount: number;
    tokenCount?: number | null;
    indexStatus: "processing" | "ready" | "failed";
    errorMessage?: string | null;
    chunks: Array<{
      chunkIndex: number;
      content: string;
      charCount: number;
      tokenCount?: number | null;
      startOffset: number | null;
      endOffset: number | null;
    }>;
  }): Document | undefined {
    const sqlite = getSqlite();
    const tx = sqlite.transaction(() => {
      const db = getDb();

      db.delete(documentChunks).where(eq(documentChunks.documentId, params.documentId)).run();

      if (params.chunks.length > 0) {
        db.insert(documentChunks)
          .values(
            params.chunks.map((chunk) => ({
              knowledgeBaseId: params.knowledgeBaseId,
              documentId: params.documentId,
              chunkIndex: chunk.chunkIndex,
              content: chunk.content,
              charCount: chunk.charCount,
              tokenCount: chunk.tokenCount ?? null,
              startOffset: chunk.startOffset,
              endOffset: chunk.endOffset,
            })),
          )
          .run();
      }

      return db
        .update(documents)
        .set({
          contentText: params.contentText,
          chunkCount: params.chunkCount,
          charCount: params.charCount,
          tokenCount: params.tokenCount ?? null,
          indexStatus: params.indexStatus,
          errorMessage: params.errorMessage ?? null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(documents.id, params.documentId))
        .returning()
        .get();
    });

    return tx();
  },

  deleteById(id: string): boolean {
    const db = getDb();
    const result = db.delete(documents).where(eq(documents.id, id)).run();
    return result.changes > 0;
  },
};
