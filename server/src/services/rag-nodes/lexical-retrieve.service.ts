import { and, asc, eq } from "drizzle-orm";
import { create, insertMultiple, search } from "@orama/orama";
import { createTokenizer as createMandarinTokenizer } from "@orama/tokenizers/mandarin";
import { documentChunks, documents, getDb } from "@/db";
import { knowledgeBaseRepository } from "@/db/repositories";
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

const lexicalSearchSchema = {
  chunkId: "number",
  documentId: "string",
  documentName: "string",
  content: "string",
} as const;

type LexicalSearchDocument = {
  id: string;
  chunkId: number;
  documentId: string;
  documentName: string;
  content: string;
};

type LexicalSearchIndex = Awaited<ReturnType<typeof createSearchIndex>>;

type LexicalIndexCacheEntry = {
  index: LexicalSearchIndex;
  documentCount: number;
  builtAt: number;
};

const lexicalIndexCache = new Map<string, LexicalIndexCacheEntry>();

const resolveKnowledgeBaseId = (knowledgeBaseId?: string) =>
  knowledgeBaseId ?? knowledgeBaseRepository.ensureDefault().id;

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

const buildCachedIndex = async (knowledgeBaseId: string) => {
  const searchDocuments = loadSearchDocuments(knowledgeBaseId);

  if (searchDocuments.length === 0) {
    lexicalIndexCache.delete(knowledgeBaseId);
    return {
      index: null,
      documentCount: 0,
      fromCache: false,
    } as const;
  }

  const cached = lexicalIndexCache.get(knowledgeBaseId);
  if (cached && cached.documentCount === searchDocuments.length) {
    return {
      index: cached.index,
      documentCount: cached.documentCount,
      fromCache: true,
    } as const;
  }

  const index = await createSearchIndex(searchDocuments);
  lexicalIndexCache.set(knowledgeBaseId, {
    index,
    documentCount: searchDocuments.length,
    builtAt: Date.now(),
  });

  return {
    index,
    documentCount: searchDocuments.length,
    fromCache: false,
  } as const;
};

/**
 * 词法检索服务节点
 * 基于 Orama 的中文词法检索，并按知识库缓存索引以避免每次请求都全量重建。
 */
export const lexicalRetrieveService = {
  async retrieve(input: LexicalRetrieveInput): Promise<LexicalRetrieveOutput> {
    const kbId = resolveKnowledgeBaseId(input.knowledgeBaseId);
    const topK = input.topK ?? 4;
    const question = input.question.trim();

    if (!question) {
      return { chunks: [], knowledgeBaseId: kbId };
    }

    const { index } = await buildCachedIndex(kbId);

    if (!index) {
      return { chunks: [], knowledgeBaseId: kbId };
    }

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

  invalidateKnowledgeBase(knowledgeBaseId?: string) {
    const kbId = resolveKnowledgeBaseId(knowledgeBaseId);
    lexicalIndexCache.delete(kbId);
  },

  clearCache() {
    lexicalIndexCache.clear();
  },

  getCacheSnapshot() {
    return Array.from(lexicalIndexCache.entries()).map(([knowledgeBaseId, entry]) => ({
      knowledgeBaseId,
      documentCount: entry.documentCount,
      builtAt: new Date(entry.builtAt).toISOString(),
    }));
  },
};
