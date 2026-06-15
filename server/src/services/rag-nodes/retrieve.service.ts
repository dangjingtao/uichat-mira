import { and, eq, sql, inArray } from "drizzle-orm";
import {
  getDb,
  getSqlite,
  documentChunks,
  documents,
} from "@/db";
import { knowledgeBaseService } from "@/services/knowledge-base.service";
import { knowledgeBaseVectorStore } from "@/services/knowledge-base.vector-store";
import type { RagNodeResult } from "@/services/rag-node-contract";
import {
  createRetrievalObservation,
} from "@/services/rag-node-observation";

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

export interface RetrieveStatePatch {
  retrievedChunks: RetrievedChunk[];
}

const toQueryVectorBlob = (embedding: number[]) => {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    return null;
  }

  return new Float32Array(embedding);
};

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
    const sqlite = getSqlite();
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
    const tableName = vectorIndex.tableName;
    const queryVector = toQueryVectorBlob(input.embedding);

    if (!queryVector) {
      return { chunks: [], knowledgeBaseId: kbId };
    }

    const vectorResults = sqlite
      .prepare(
        `SELECT chunk_id as chunkId, distance
         FROM ${tableName}
         WHERE embedding MATCH ?
         ORDER BY distance
         LIMIT ?`,
      )
      .all(queryVector, topK) as Array<{
        chunkId: number;
        distance: number;
      }>;

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

  async runNode(
    input: RetrieveInput,
  ): Promise<RagNodeResult<RetrieveStatePatch>> {
    const startedAtMs = Date.now();
    const result = await this.retrieve(input);
    return {
      state: {
        retrievedChunks: result.chunks,
      },
      observation: createRetrievalObservation({
        startedAtMs,
        label: "检索知识库",
        summary:
          result.chunks.length > 0
            ? `已召回 ${result.chunks.length} 个候选片段`
            : "未命中相关片段，将直接生成回答",
        details: {
          count: result.chunks.length,
          topK: input.topK ?? 10,
          knowledgeBaseId: result.knowledgeBaseId,
          sources: result.chunks.slice(0, 5).map((chunk) => ({
            chunkId: chunk.chunkId,
            documentId: chunk.documentId,
            documentName: chunk.documentName,
            score: chunk.score,
            contentPreview: Array.from(chunk.content).slice(0, 100).join(""),
            contentLength: Array.from(chunk.content).length,
          })),
        },
        knowledgeBaseId: result.knowledgeBaseId,
        topK: input.topK ?? 10,
        returnedCount: result.chunks.length,
        result: {
          success: true,
          finishReason: result.chunks.length > 0 ? "retrieved" : "no-hit",
          metrics: {
            inputCount: input.embedding.length,
            returnedCount: result.chunks.length,
          },
          response: {
            summary: {
              knowledgeBaseId: result.knowledgeBaseId,
              topDocuments: result.chunks.slice(0, 3).map((chunk) => ({
                documentName: chunk.documentName,
                score: chunk.score,
              })),
            },
          },
        },
        context: {
          embeddingDimensions: input.embeddingDimensions ?? null,
          embeddingModel: input.embeddingModel ?? null,
          embeddingModelConfigId: input.embeddingModelConfigId ?? null,
        },
      }),
    };
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
