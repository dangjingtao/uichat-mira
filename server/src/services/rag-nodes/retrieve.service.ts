import { and, eq, inArray } from "drizzle-orm";
import {
  getDb,
  getSqlite,
  documentChunks,
  documents,
} from "@/db";
import { knowledgeBaseVectorStore } from "@/services/knowledge-base.vector-store";
import { lexicalRetrieveService } from "./lexical-retrieve.service";
import type { RagNodeResult } from "@/services/rag-node-contract";
import {
  createRetrievalObservation,
} from "@/services/rag-node-observation";
import { writeStructuredLog } from "@/logger";
import { createEvolvingKnowledgeService } from "@/microapps/evolving-knowledge/index.js";

const RRF_K = 60;

export interface RetrieveInput {
  question?: string;
  userId?: number;
  embedding: number[];
  embeddingDimensions?: number;
  embeddingModel?: string;
  embeddingModelConfigId?: string;
  knowledgeBaseId?: string;
  evolvingKnowledgeEnabled?: boolean;
  topK?: number;
}

export type RetrieveHitMode = "vector" | "lexical";
export type RetrieveMatchType = RetrieveHitMode | "hybrid";

export interface RetrievedChunk {
  chunkId: number;
  documentId: string;
  documentName: string;
  content: string;
  score: number;
  rawScore?: number;
  matchType?: RetrieveMatchType;
  hitModes?: RetrieveHitMode[];
  citation?: {
    sourceType: string;
    sourceId: string;
    captureId: string | null;
    evidenceUnitId: string | null;
    topicId: string | null;
    viewpointVersionId: string | null;
    references: Array<{
      captureId: string | null;
      evidenceUnitId: string | null;
      sourceLocator?: Record<string, unknown>;
    }>;
  };
}

export interface RetrieveOutput {
  chunks: RetrievedChunk[];
  knowledgeBaseId: string;
  execution: {
    strategy: "vector-only" | "hybrid";
    vectorCount: number;
    lexicalCount: number;
    fusedCount: number;
    vectorCandidates: RetrievedChunk[];
    lexicalCandidates: RetrievedChunk[];
    fusedCandidates: RetrievedChunk[];
  };
}

const evolvingKnowledgeService = createEvolvingKnowledgeService();

const retrieveEvolvingKnowledge = (input: RetrieveInput): RetrieveOutput => {
  if (!input.userId) throw new Error("Authenticated user id is required for evolving knowledge retrieval");
  const queryResult = evolvingKnowledgeService.queryKnowledge(
    input.question?.trim() ?? "",
    input.userId,
    { mode: "mixed", limit: input.topK ?? 10 },
  );
  const chunks = queryResult.results.map((result, index) => ({
    chunkId: index + 1,
    documentId: `evolving-knowledge:${result.sourceType}:${result.sourceId}`,
    documentName: `[洞见] ${result.title}`,
    content: result.content,
    score: result.score,
    rawScore: result.score,
    matchType: "lexical" as const,
    hitModes: ["lexical" as const],
    citation: {
      sourceType: result.sourceType,
      sourceId: result.sourceId,
      captureId: result.captureId,
      evidenceUnitId: result.evidenceUnitId,
      topicId: result.topicId,
      viewpointVersionId: result.viewpointVersionId,
      references: result.references,
    },
  }));
  return {
    chunks,
    knowledgeBaseId: "evolving-knowledge",
    execution: {
      strategy: "hybrid",
      vectorCount: 0,
      lexicalCount: chunks.length,
      fusedCount: chunks.length,
      vectorCandidates: [],
      lexicalCandidates: chunks,
      fusedCandidates: chunks,
    },
  };
};

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

const loadChunkDetailsByIds = (kbId: string, chunkIds: number[]) => {
  if (chunkIds.length === 0) {
    return [];
  }

  return getDb()
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
};

const buildVectorChunks = (input: RetrieveInput, kbId: string) => {
  if (input.embedding.length === 0) {
    return [];
  }

  const sqlite = getSqlite();
  const vectorIndex = resolveVectorIndexForQuery({
    knowledgeBaseId: kbId,
    embeddingDimensions: input.embeddingDimensions,
    embeddingModel: input.embeddingModel,
    embeddingModelConfigId: input.embeddingModelConfigId,
  });

  if (!vectorIndex) {
    return [];
  }

  const queryVector = toQueryVectorBlob(input.embedding);
  if (!queryVector) {
    return [];
  }

  const topK = input.topK ?? 4;
  const vectorResults = sqlite
    .prepare(
      `SELECT chunk_id as chunkId, distance
       FROM ${vectorIndex.tableName}
       WHERE embedding MATCH ?
       ORDER BY distance
       LIMIT ?`,
    )
    .all(queryVector, topK) as Array<{
      chunkId: number;
      distance: number;
    }>;

  if (vectorResults.length === 0) {
    return [];
  }

  const chunkData = loadChunkDetailsByIds(
    kbId,
    vectorResults.map((result) => result.chunkId),
  );

  return vectorResults.reduce<RetrievedChunk[]>((chunks, vectorResult) => {
    const chunkInfo = chunkData.find((candidate) => candidate.chunkId === vectorResult.chunkId);

    if (!chunkInfo) {
      return chunks;
    }

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
      rawScore: score,
      matchType: "vector",
      hitModes: ["vector"],
    });

    return chunks;
  }, []);
};

const reciprocalRankScore = (rank: number) => 1 / (RRF_K + rank);

const normalizeScores = (values: number[]) => {
  if (values.length === 0) {
    return [];
  }

  if (values.length === 1) {
    return [1];
  }

  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);

  if (maxValue === minValue) {
    return values.map((_value, index) => 1 - index / (values.length - 1));
  }

  return values.map((value) => (value - minValue) / (maxValue - minValue));
};

const normalizeRetrievedChunks = (
  chunks: RetrievedChunk[],
  selector: (chunk: RetrievedChunk) => number = (chunk) => chunk.score,
) => {
  const normalizedScores = normalizeScores(chunks.map(selector));

  return chunks.map((chunk, index) => ({
    ...chunk,
    score: normalizedScores[index] ?? 0,
  }));
};

const toContentSnippet = (content: string, maxChars = 200) =>
  Array.from(content).slice(0, maxChars).join("");

const toStageCandidates = (
  stage: "vector" | "lexical" | "fused",
  chunks: RetrievedChunk[],
) =>
  chunks.map((chunk, index) => ({
    stage,
    rank: index + 1,
    chunkId: chunk.chunkId,
    documentId: chunk.documentId,
    documentName: chunk.documentName,
    rawScore: chunk.rawScore ?? chunk.score,
    score: chunk.score,
    matchType: chunk.matchType ?? null,
    hitModes: chunk.hitModes ?? [],
    contentSnippet: toContentSnippet(chunk.content),
    contentLength: Array.from(chunk.content).length,
  }));

const mergeHitModes = (
  currentModes: RetrieveHitMode[] | undefined,
  nextMode: RetrieveHitMode,
) => {
  const modes = new Set(currentModes ?? []);
  modes.add(nextMode);
  return Array.from(modes);
};

const toMatchType = (hitModes: RetrieveHitMode[]): RetrieveMatchType => {
  if (hitModes.includes("vector") && hitModes.includes("lexical")) {
    return "hybrid";
  }

  return hitModes[0] ?? "vector";
};

const fuseHybridChunks = (
  vectorChunks: RetrievedChunk[],
  lexicalChunks: RetrievedChunk[],
  topK: number,
) => {
  const merged = new Map<
    number,
    RetrievedChunk & {
      rrfScore: number;
    }
  >();

  vectorChunks.forEach((chunk, index) => {
    const existing = merged.get(chunk.chunkId);
    const rrfScore = reciprocalRankScore(index + 1);

    if (existing) {
      existing.rrfScore += rrfScore;
      existing.hitModes = mergeHitModes(existing.hitModes, "vector");
      existing.matchType = toMatchType(existing.hitModes ?? ["vector"]);
      return;
    }

    merged.set(chunk.chunkId, {
      ...chunk,
      rrfScore,
      hitModes: ["vector"],
      matchType: "vector",
    });
  });

  lexicalChunks.forEach((chunk, index) => {
    const existing = merged.get(chunk.chunkId);
    const rrfScore = reciprocalRankScore(index + 1);

    if (existing) {
      existing.rrfScore += rrfScore;
      existing.hitModes = mergeHitModes(existing.hitModes, "lexical");
      existing.matchType = toMatchType(existing.hitModes ?? ["lexical"]);
      return;
    }

    merged.set(chunk.chunkId, {
      ...chunk,
      rrfScore,
      hitModes: ["lexical"],
      matchType: "lexical",
    });
  });

  return Array.from(merged.values())
    .sort((left, right) => right.rrfScore - left.rrfScore)
    .slice(0, topK)
    .map(({ rrfScore, ...chunk }) => ({
      ...chunk,
      rawScore: rrfScore,
    }));
};

/**
 * 混合检索服务节点
 * 默认优先走向量召回；当问题文本可用时，同时做关键词召回并使用 RRF 融合。
 */
export const retrieveService = {
  async retrieve(input: RetrieveInput): Promise<RetrieveOutput> {
    if (input.evolvingKnowledgeEnabled) {
      return retrieveEvolvingKnowledge(input);
    }
    const kbId = input.knowledgeBaseId?.trim();
    if (!kbId) {
      throw new Error("Knowledge base id is required for retrieval");
    }

    const topK = input.topK ?? 4;
    const normalizedQuestion = input.question?.trim() ?? "";
    const vectorChunks = normalizeRetrievedChunks(
      buildVectorChunks(input, kbId),
      (chunk) => chunk.rawScore ?? chunk.score,
    );

    if (!normalizedQuestion) {
      return {
        chunks: vectorChunks,
        knowledgeBaseId: kbId,
        execution: {
          strategy: "vector-only",
          vectorCount: vectorChunks.length,
          lexicalCount: 0,
          fusedCount: vectorChunks.length,
          vectorCandidates: vectorChunks,
          lexicalCandidates: [],
          fusedCandidates: vectorChunks,
        },
      };
    }

    const lexicalResult = await lexicalRetrieveService.retrieve({
      question: normalizedQuestion,
      knowledgeBaseId: kbId,
      topK,
    });
    const lexicalChunks = normalizeRetrievedChunks(
      lexicalResult.chunks.map((chunk) => ({
        ...chunk,
        rawScore: chunk.score,
        matchType: "lexical" as const,
        hitModes: ["lexical" as const],
      })),
      (chunk) => chunk.rawScore ?? chunk.score,
    );

    if (vectorChunks.length === 0) {
      return {
        chunks: lexicalChunks,
        knowledgeBaseId: kbId,
        execution: {
          strategy: "hybrid",
          vectorCount: 0,
          lexicalCount: lexicalChunks.length,
          fusedCount: lexicalChunks.length,
          vectorCandidates: [],
          lexicalCandidates: lexicalChunks,
          fusedCandidates: lexicalChunks,
        },
      };
    }

    const fusedChunks = normalizeRetrievedChunks(
      fuseHybridChunks(vectorChunks, lexicalChunks, topK),
      (chunk) => chunk.rawScore ?? chunk.score,
    );

    return {
      chunks: fusedChunks,
      knowledgeBaseId: kbId,
      execution: {
        strategy: "hybrid",
        vectorCount: vectorChunks.length,
        lexicalCount: lexicalChunks.length,
        fusedCount: fusedChunks.length,
        vectorCandidates: vectorChunks,
        lexicalCandidates: lexicalChunks,
        fusedCandidates: fusedChunks,
      },
    };
  },

  async runNode(
    input: RetrieveInput,
  ): Promise<RagNodeResult<RetrieveStatePatch>> {
    const startedAtMs = Date.now();
    const result = await this.retrieve(input);

    writeStructuredLog("info", {
      scope: "rag-retrieve",
      event: "candidates-preview",
      question: input.question?.trim() ?? "",
      knowledgeBaseId: result.knowledgeBaseId,
      strategy: result.execution.strategy,
      vectorCount: result.execution.vectorCount,
      lexicalCount: result.execution.lexicalCount,
      fusedCount: result.execution.fusedCount,
      topCandidates: result.chunks.slice(0, 3).map((chunk) => ({
        documentName: chunk.documentName,
        score: chunk.score,
        rawScore: chunk.rawScore ?? chunk.score,
        matchType: chunk.matchType ?? null,
        hitModes: chunk.hitModes ?? [],
        contentPreview: toContentSnippet(chunk.content, 80),
      })),
    });

    return {
      state: {
        retrievedChunks: result.chunks,
      },
      observation: createRetrievalObservation({
        startedAtMs,
        label: "检索知识库",
        summary:
          result.chunks.length > 0
            ? result.execution.strategy === "hybrid"
              ? `已融合语义检索和关键词检索，召回 ${result.chunks.length} 个候选片段`
              : `已召回 ${result.chunks.length} 个候选片段`
            : "未命中相关片段，将直接生成回答",
        details: {
          count: result.chunks.length,
          topK: input.topK ?? 10,
          knowledgeBaseId: result.knowledgeBaseId,
          retrievalStrategy: result.execution.strategy,
          vectorCount: result.execution.vectorCount,
          lexicalCount: result.execution.lexicalCount,
          fusedCount: result.execution.fusedCount,
          retrievalBreakdown: {
            strategy: result.execution.strategy,
            counts: {
              embeddingHits: result.execution.vectorCount,
              lexicalHits: result.execution.lexicalCount,
              fusedHits: result.execution.fusedCount,
            },
            candidates: [
              ...toStageCandidates(
                "vector",
                result.execution.vectorCandidates,
              ),
              ...toStageCandidates(
                "lexical",
                result.execution.lexicalCandidates,
              ),
              ...toStageCandidates(
                "fused",
                result.execution.fusedCandidates,
              ),
            ],
          },
          sources: result.chunks.slice(0, 5).map((chunk) => ({
            chunkId: chunk.chunkId,
            documentId: chunk.documentId,
            documentName: chunk.documentName,
            rawScore: chunk.rawScore ?? chunk.score,
            score: chunk.score,
            matchType: chunk.matchType ?? null,
            hitModes: chunk.hitModes ?? [],
            contentPreview: toContentSnippet(chunk.content, 100),
            contentLength: Array.from(chunk.content).length,
          })),
        },
        artifacts: {
          retrievalBreakdown: {
            strategy: result.execution.strategy,
            counts: {
              embeddingHits: result.execution.vectorCount,
              lexicalHits: result.execution.lexicalCount,
              fusedHits: result.execution.fusedCount,
            },
            candidates: [
              ...toStageCandidates(
                "vector",
                result.execution.vectorCandidates,
              ),
              ...toStageCandidates(
                "lexical",
                result.execution.lexicalCandidates,
              ),
              ...toStageCandidates(
                "fused",
                result.execution.fusedCandidates,
              ),
            ],
          },
        },
        knowledgeBaseId: result.knowledgeBaseId,
        topK: input.topK ?? 10,
        candidateCount:
          result.execution.strategy === "hybrid"
            ? result.execution.vectorCount + result.execution.lexicalCount
            : result.execution.vectorCount,
        returnedCount: result.chunks.length,
        result: {
          success: true,
          finishReason: result.chunks.length > 0 ? "retrieved" : "no-hit",
          metrics: {
            inputCount: input.embedding.length,
            candidateCount:
              result.execution.strategy === "hybrid"
                ? result.execution.vectorCount + result.execution.lexicalCount
                : result.execution.vectorCount,
            returnedCount: result.chunks.length,
          },
          response: {
            summary: {
              knowledgeBaseId: result.knowledgeBaseId,
              retrievalStrategy: result.execution.strategy,
              counts: {
                embeddingHits: result.execution.vectorCount,
                lexicalHits: result.execution.lexicalCount,
                fusedHits: result.execution.fusedCount,
              },
              topDocuments: result.chunks.slice(0, 3).map((chunk) => ({
                documentName: chunk.documentName,
                rawScore: chunk.rawScore ?? chunk.score,
                score: chunk.score,
                matchType: chunk.matchType ?? null,
                hitModes: chunk.hitModes ?? [],
              })),
            },
          },
        },
        context: {
          embeddingDimensions: input.embeddingDimensions ?? null,
          embeddingModel: input.embeddingModel ?? null,
          embeddingModelConfigId: input.embeddingModelConfigId ?? null,
          questionProvided: Boolean(input.question?.trim()),
        },
        sources: result.chunks,
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
