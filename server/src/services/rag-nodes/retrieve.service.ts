import { and, eq, sql, inArray } from "drizzle-orm";
import {
  getDb,
  documentChunks,
  documents,
} from "@/db";
import { knowledgeBaseService } from "@/services/knowledge-base.service";
import { knowledgeBaseVectorStore } from "@/services/knowledge-base.vector-store";

export interface RetrieveInput {
  embedding: number[];
  embeddingDimensions?: number;
  embeddingModel?: string;
  embeddingModelConfigId?: string;
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

const resolveVectorIndexForQuery = (input: {
  knowledgeBaseId: string;
  embeddingDimensions?: number;
  embeddingModel?: string;
  embeddingModelConfigId?: string;
}) => {
  const activeIndex = knowledgeBaseVectorStore.findActiveVectorIndex(
    input.knowledgeBaseId,
  );
  const queryDimensions = input.embeddingDimensions;

  if (!queryDimensions || !input.embeddingModel || !input.embeddingModelConfigId) {
    return activeIndex ?? null;
  }

  const expectedTableName = knowledgeBaseVectorStore.toExpectedVectorTableName({
    knowledgeBaseId: input.knowledgeBaseId,
    embeddingModelConfigId: input.embeddingModelConfigId,
    model: input.embeddingModel,
    dimensions: queryDimensions,
  });

  const indexes = knowledgeBaseVectorStore.findVectorIndexes(input.knowledgeBaseId);
  const exactIndex = indexes.find((index) => index.tableName === expectedTableName);

  if (exactIndex) {
    if (!exactIndex.isActive) {
      knowledgeBaseVectorStore.activateVectorIndex(
        exactIndex.id,
        input.knowledgeBaseId,
      );
    }

    return exactIndex;
  }

  if (activeIndex?.dimensions === queryDimensions) {
    return activeIndex;
  }

  throw new Error(
    [
      `知识库索引与当前默认 Embedding 模型不匹配。`,
      `当前查询向量: ${input.embeddingModel} (${queryDimensions} 维)。`,
      activeIndex
        ? `当前激活索引: ${activeIndex.tableName} (${activeIndex.dimensions} 维)。`
        : "当前知识库没有激活的向量索引。",
      "请重建知识库索引，或切换回与现有知识库兼容的 Embedding 模型。",
    ].join(" "),
  );
};

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
    const vectorIndex = resolveVectorIndexForQuery({
      knowledgeBaseId: kbId,
      embeddingDimensions: input.embeddingDimensions,
      embeddingModel: input.embeddingModel,
      embeddingModelConfigId: input.embeddingModelConfigId,
    });

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
    return knowledgeBaseVectorStore.findActiveVectorIndex(knowledgeBaseId);
  },
};
