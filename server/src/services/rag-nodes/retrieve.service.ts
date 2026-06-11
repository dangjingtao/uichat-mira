import { and, eq, sql, inArray } from "drizzle-orm";
import {
  getDb,
  knowledgeBaseVectorIndexes,
  documentChunks,
  documents,
} from "@/db";
import { knowledgeBaseService } from "@/services/knowledge-base.service";

export interface RetrieveInput {
  embedding: number[];
  knowledgeBaseId?: string;
  topK?: number;
}

export interface RetrievedChunk {
  chunkId: number;
  documentId: string;
  documentName: string;
  content: string;
  score: number;
}

export interface RetrieveOutput {
  chunks: RetrievedChunk[];
  knowledgeBaseId: string;
}

/**
 * 向量检索服务节点
 * 使用 sqlite-vec 进行向量相似度搜索
 */
export const retrieveService = {
  /**
   * 向量相似度检索
   * @param input 查询向量、知识库ID、返回数量
   * @returns 检索结果
   */
  async retrieve(input: RetrieveInput): Promise<RetrieveOutput> {
    const kbId =
      input.knowledgeBaseId ??
      knowledgeBaseService.getDefaultKnowledgeBase().id;
    const topK = input.topK ?? 4;

    if (input.embedding.length === 0) {
      return { chunks: [], knowledgeBaseId: kbId };
    }

    const db = getDb();

    // 获取向量索引信息
    const vectorIndex = db
      .select()
      .from(knowledgeBaseVectorIndexes)
      .where(
        and(
          eq(knowledgeBaseVectorIndexes.knowledgeBaseId, kbId),
          eq(knowledgeBaseVectorIndexes.isActive, true),
        ),
      )
      .limit(1)
      .get();

    if (!vectorIndex) {
      return { chunks: [], knowledgeBaseId: kbId };
    }

    // 执行向量搜索（使用 Drizzle raw sql）
    const embeddingJson = JSON.stringify(input.embedding);
    const tableName = vectorIndex.tableName;

    const vectorResults = db
      .select({
        chunkId: sql<number>`chunk_id`,
        distance: sql<number>`distance`,
      })
      .from(sql.raw(tableName))
      .where(sql`embedding MATCH ${embeddingJson}`)
      .orderBy(sql`distance`)
      .limit(topK)
      .all();

    if (vectorResults.length === 0) {
      return { chunks: [], knowledgeBaseId: kbId };
    }

    // 批量获取 chunk 详情
    const chunkIds = vectorResults.map((r) => r.chunkId);

    const chunkData = db
      .select({
        chunkId: documentChunks.id,
        documentId: documentChunks.documentId,
        content: documentChunks.content,
        documentName: documents.name,
      })
      .from(documentChunks)
      .innerJoin(documents, eq(documentChunks.documentId, documents.id))
      .where(
        and(
          inArray(documentChunks.id, chunkIds),
          eq(documentChunks.knowledgeBaseId, kbId),
          eq(documents.knowledgeBaseId, kbId),
          eq(documents.enabled, true),
          eq(documents.indexStatus, "ready"),
        ),
      )
      .all();

    // 合并结果
    const chunks: RetrievedChunk[] = [];

    for (const vectorResult of vectorResults) {
      const chunkInfo = chunkData.find(
        (c) => c.chunkId === vectorResult.chunkId,
      );

      if (chunkInfo) {
        const score =
          vectorIndex.distanceMetric === "cosine"
            ? 1 - vectorResult.distance
            : -vectorResult.distance;

        chunks.push({
          chunkId: chunkInfo.chunkId,
          documentId: chunkInfo.documentId,
          documentName: chunkInfo.documentName,
          content: chunkInfo.content,
          score,
        });
      }
    }

    return { chunks, knowledgeBaseId: kbId };
  },

  /**
   * 获取知识库的向量索引信息
   * @param knowledgeBaseId 知识库ID
   * @returns 向量索引信息或 null
   */
  getVectorIndex(knowledgeBaseId: string) {
    const db = getDb();
    return db
      .select()
      .from(knowledgeBaseVectorIndexes)
      .where(
        and(
          eq(knowledgeBaseVectorIndexes.knowledgeBaseId, knowledgeBaseId),
          eq(knowledgeBaseVectorIndexes.isActive, true),
        ),
      )
      .limit(1)
      .get();
  },
};
