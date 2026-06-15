import { and, asc, eq } from "drizzle-orm";
import { create, insertMultiple, search } from "@orama/orama";
import { createTokenizer as createMandarinTokenizer } from "@orama/tokenizers/mandarin";
import { documentChunks, documents, getDb } from "@/db";
import { knowledgeBaseService } from "@/services/knowledge-base.service";
import type { RetrievedChunk } from "./retrieve.service";

export interface LexicalRetrieveInput {
  question: string;
  knowledgeBaseId?: string;
  topK?: number;
}

export interface LexicalRetrieveOutput {
  chunks: RetrievedChunk[];
  knowledgeBaseId: string;
}

// Orama 索引结构。
// id 由 Orama 作为文档唯一标识单独处理，不需要放进 schema。
const lexicalSearchSchema = {
  chunkId: "number",
  documentId: "string",
  documentName: "string",
  content: "string",
} as const;

// 写入 Orama 的最小文档结构。
// 检索结果会直接映射回 RAG 统一使用的 RetrievedChunk。
type LexicalSearchDocument = {
  id: string;
  chunkId: number;
  documentId: string;
  documentName: string;
  content: string;
};

/**
 * 加载可参与词法检索的知识库分段
 * 仅索引当前知识库中已启用、索引状态为 ready 的文档分段
 */
const loadSearchDocuments = (
  knowledgeBaseId: string,
): LexicalSearchDocument[] => {
  const rows = getDb()
    .select({
      chunkId: documentChunks.id,
      documentId: documentChunks.documentId,
      documentName: documents.name,
      content: documentChunks.content,
    })
    .from(documentChunks)
    .innerJoin(documents, eq(documentChunks.documentId, documents.id))
    .where(
      and(
        eq(documentChunks.knowledgeBaseId, knowledgeBaseId),
        eq(documents.knowledgeBaseId, knowledgeBaseId),
        eq(documents.enabled, true),
        eq(documents.indexStatus, "ready"),
      ),
    )
    .orderBy(asc(documentChunks.id))
    .all();

  return rows.map((row) => ({
    id: String(row.chunkId),
    chunkId: row.chunkId,
    documentId: row.documentId,
    documentName: row.documentName,
    content: row.content,
  }));
};

/**
 * 创建 Orama 词法检索索引
 * 使用 Mandarin tokenizer 提升中文查询和中文分段的匹配效果
 */
const createSearchIndex = async (searchDocuments: LexicalSearchDocument[]) => {
  const index = create({
    schema: lexicalSearchSchema,
    components: {
      tokenizer: createMandarinTokenizer(),
    },
  });

  await insertMultiple(index, searchDocuments);

  return index;
};

/**
 * 词法检索服务节点
 * 基于 Orama 的 BM25 全文检索召回知识库分段，可作为向量检索之外的可选检索节点
 */
export const lexicalRetrieveService = {
  /**
   * 执行词法检索
   * @param input 用户问题、知识库 ID、返回数量
   * @returns 词法检索召回的分段结果
   */
  async retrieve(input: LexicalRetrieveInput): Promise<LexicalRetrieveOutput> {
    const kbId =
      input.knowledgeBaseId ??
      knowledgeBaseService.getDefaultKnowledgeBase().id;
    const topK = input.topK ?? 4;
    const question = input.question.trim();

    if (!question) {
      return { chunks: [], knowledgeBaseId: kbId };
    }

    const searchDocuments = loadSearchDocuments(kbId);

    if (searchDocuments.length === 0) {
      return { chunks: [], knowledgeBaseId: kbId };
    }

    const index = await createSearchIndex(searchDocuments);
    const result = await search(index, {
      term: question,
      properties: ["documentName", "content"],
      boost: {
        documentName: 2,
      },
      threshold: 0,
      limit: topK,
    });

    return {
      chunks: result.hits.map((hit) => ({
        chunkId: hit.document.chunkId,
        documentId: hit.document.documentId,
        documentName: hit.document.documentName,
        content: hit.document.content,
        score: hit.score,
      })),
      knowledgeBaseId: kbId,
    };
  },
};
