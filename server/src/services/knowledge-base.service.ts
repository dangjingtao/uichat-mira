import { documentRepository, knowledgeBaseRepository, type DocumentListFilters } from "@/db/repositories";
import type { Document, DocumentIndexStatus, DocumentSourceType } from "@/db/schema";
import {
  DEFAULT_UPLOAD_SOURCE_LABEL,
  MAX_EMBEDDING_BATCH_CHARS,
  MAX_EMBEDDING_BATCH_INPUTS,
} from "@/constants/knowledge-base.js";
import { splitDocumentText, type ChunkingConfig } from "@/services/knowledge-base.splitter";
import { knowledgeBaseVectorStore } from "@/services/knowledge-base.vector-store.js";
import { lexicalRetrieveService } from "@/services/rag-nodes/lexical-retrieve.service.js";
import { providerProxyService } from "@/services/provider-proxy.service.js";
import {
  FAILED_GENERATE_EMBEDDINGS_MESSAGE,
  getErrorMessage,
} from "@/utils/errors.js";

export interface KnowledgeBaseSummaryResponse {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  documentCount: number;
  enabledDocumentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeBaseDocumentResponse {
  id: string;
  knowledgeBaseId: string;
  name: string;
  sourceType: DocumentSourceType;
  sourceLabel: string | null;
  fileExt: string;
  mimeType: string | null;
  fileSize: number | null;
  indexStatus: DocumentIndexStatus;
  enabled: boolean;
  chunkCount: number;
  charCount: number;
  tokenCount: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeBaseDocumentDetailResponse
  extends KnowledgeBaseDocumentResponse {
  contentText: string;
  chunks: Array<{
    id: number;
    chunkIndex: number;
    content: string;
    charCount: number;
    tokenCount: number | null;
    startOffset: number | null;
    endOffset: number | null;
    createdAt: string;
  }>;
}

export interface CreateDocumentInput {
  name: string;
  fileExt: string;
  contentText: string;
  mimeType?: string | null;
  fileSize?: number | null;
  sourceType?: DocumentSourceType;
  sourceLabel?: string | null;
  enabled?: boolean;
  chunkingConfig?: Partial<ChunkingConfig> | null;
}

export interface UpdateDocumentInput {
  name?: string;
  sourceLabel?: string | null;
  enabled?: boolean;
  contentText?: string;
  chunkingConfig?: Partial<ChunkingConfig> | null;
}

interface IndexDocumentJob {
  documentId: string;
  chunkingConfig?: Partial<ChunkingConfig> | null;
}

const queuedDocumentIds = new Set<string>();
const indexDocumentQueue: IndexDocumentJob[] = [];
let isIndexingQueuedDocument = false;

const toDocumentResponse = (
  document: Document,
): KnowledgeBaseDocumentResponse => ({
  id: document.id,
  knowledgeBaseId: document.knowledgeBaseId,
  name: document.name,
  sourceType: document.sourceType,
  sourceLabel: document.sourceLabel ?? null,
  fileExt: document.fileExt,
  mimeType: document.mimeType ?? null,
  fileSize: document.fileSize ?? null,
  indexStatus: document.indexStatus,
  enabled: document.enabled,
  chunkCount: document.chunkCount,
  charCount: document.charCount,
  tokenCount: document.tokenCount ?? null,
  errorMessage: document.errorMessage ?? null,
  createdAt: document.createdAt,
  updatedAt: document.updatedAt,
});

const embedDocumentChunks = async (
  knowledgeBaseId: string,
  chunks: KnowledgeBaseDocumentDetailResponse["chunks"],
) => {
  if (chunks.length === 0) {
    return;
  }

  const chunkBatches: KnowledgeBaseDocumentDetailResponse["chunks"][] = [];
  let currentBatch: KnowledgeBaseDocumentDetailResponse["chunks"] = [];
  let currentChars = 0;

  for (const chunk of chunks) {
    const nextChars = currentChars + chunk.content.length;
    if (
      currentBatch.length > 0 &&
      (currentBatch.length >= MAX_EMBEDDING_BATCH_INPUTS ||
        nextChars > MAX_EMBEDDING_BATCH_CHARS)
    ) {
      chunkBatches.push(currentBatch);
      currentBatch = [];
      currentChars = 0;
    }

    currentBatch.push(chunk);
    currentChars += chunk.content.length;
  }

  if (currentBatch.length > 0) {
    chunkBatches.push(currentBatch);
  }

  let vectorTableName = "";
  let vectorModelConfigId = "";
  let vectorDimensions = 0;

  for (const batch of chunkBatches) {
    const embeddingResult = await providerProxyService.createEmbeddings(
      "default",
      batch.map((chunk) => chunk.content),
    );

    if (!vectorTableName) {
      const vectorIndex = knowledgeBaseVectorStore.ensureDefaultVectorIndex({
        knowledgeBaseId,
        embeddingModelConfigId: embeddingResult.modelConfigId,
        model: embeddingResult.model,
        dimensions: embeddingResult.dimensions,
      });

      vectorTableName = vectorIndex.tableName;
      vectorModelConfigId = embeddingResult.modelConfigId;
      vectorDimensions = embeddingResult.dimensions;
    } else if (
      embeddingResult.modelConfigId !== vectorModelConfigId ||
      embeddingResult.dimensions !== vectorDimensions
    ) {
      throw new Error(
        "Embedding model changed during document indexing; please retry the upload.",
      );
    }

    knowledgeBaseVectorStore.upsertChunkEmbeddings({
      tableName: vectorTableName,
      rows: batch.map((chunk, index) => ({
        chunkId: chunk.id,
        embedding: embeddingResult.embeddings[index] ?? [],
      })),
    });
  }
};

const cleanupDocumentArtifacts = (
  document: Pick<
    KnowledgeBaseDocumentDetailResponse,
    "id" | "knowledgeBaseId" | "chunks"
  > | null,
) => {
  if (!document) {
    return;
  }

  if (document.chunks.length > 0) {
    const tableNames = knowledgeBaseVectorStore.listVectorIndexTableNames(
      document.knowledgeBaseId,
    );
    knowledgeBaseVectorStore.deleteChunkEmbeddings({
      tableNames,
      chunkIds: document.chunks.map((chunk) => chunk.id),
    });
  }

  documentRepository.deleteById(document.id);
};

const invalidateLexicalIndex = (knowledgeBaseId: string) => {
  lexicalRetrieveService.invalidateKnowledgeBase(knowledgeBaseId);
};

const processQueuedDocument = async (job: IndexDocumentJob) => {
  const existing = documentRepository.findById(job.documentId);
  if (!existing) {
    return;
  }

  invalidateLexicalIndex(existing.knowledgeBaseId);

  const previousDetail = knowledgeBaseService.getDocumentById(job.documentId);
  const splitResult = await splitDocumentText(existing.contentText, job.chunkingConfig);

  const updated = documentRepository.replaceChunks({
    documentId: existing.id,
    knowledgeBaseId: existing.knowledgeBaseId,
    contentText: splitResult.normalizedText,
    chunkCount: splitResult.chunks.length,
    charCount: splitResult.normalizedText.length,
    tokenCount: null,
    indexStatus: "processing",
    errorMessage: null,
    chunks: splitResult.chunks.map((chunk) => ({
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      charCount: chunk.charCount,
      tokenCount: null,
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset,
    })),
  });

  if (!updated) {
    return;
  }

  try {
    if (previousDetail?.chunks.length) {
      const tableNames = knowledgeBaseVectorStore.listVectorIndexTableNames(
        previousDetail.knowledgeBaseId,
      );
      knowledgeBaseVectorStore.deleteChunkEmbeddings({
        tableNames,
        chunkIds: previousDetail.chunks.map((chunk) => chunk.id),
      });
    }

    const nextDetail = knowledgeBaseService.getDocumentById(job.documentId);
    if (!nextDetail) {
      return;
    }

    await embedDocumentChunks(existing.knowledgeBaseId, nextDetail.chunks);
    documentRepository.updateById(job.documentId, {
      indexStatus: "ready",
      errorMessage: null,
    });
    invalidateLexicalIndex(existing.knowledgeBaseId);
  } catch (error) {
    const errorMessage = getErrorMessage(
      error,
      FAILED_GENERATE_EMBEDDINGS_MESSAGE,
    );

    documentRepository.updateById(job.documentId, {
      indexStatus: "failed",
      errorMessage,
    });
    invalidateLexicalIndex(existing.knowledgeBaseId);
  }
};

const runQueuedDocumentIndexing = async () => {
  if (isIndexingQueuedDocument) {
    return;
  }

  isIndexingQueuedDocument = true;

  try {
    while (indexDocumentQueue.length > 0) {
      const nextJob = indexDocumentQueue.shift();
      if (!nextJob) {
        continue;
      }

      try {
        await processQueuedDocument(nextJob);
      } finally {
        queuedDocumentIds.delete(nextJob.documentId);
      }
    }
  } finally {
    isIndexingQueuedDocument = false;
  }
};

const enqueueDocumentIndexing = (job: IndexDocumentJob) => {
  if (queuedDocumentIds.has(job.documentId)) {
    return;
  }

  queuedDocumentIds.add(job.documentId);
  indexDocumentQueue.push(job);
  void runQueuedDocumentIndexing();
};

export const knowledgeBaseService = {
  getDefaultKnowledgeBase(): KnowledgeBaseSummaryResponse {
    const kb = knowledgeBaseRepository.ensureDefault();
    const documents = documentRepository.listByKnowledgeBase(kb.id);

    return {
      id: kb.id,
      name: kb.name,
      description: kb.description ?? null,
      status: kb.status,
      documentCount: documents.length,
      enabledDocumentCount: documents.filter((item) => item.enabled).length,
      createdAt: kb.createdAt,
      updatedAt: kb.updatedAt,
    };
  },

  listDocuments(filters: DocumentListFilters = {}): KnowledgeBaseDocumentResponse[] {
    const kb = knowledgeBaseRepository.ensureDefault();
    return documentRepository
      .listByKnowledgeBase(kb.id, filters)
      .map((document) => toDocumentResponse(document));
  },

  getDocumentById(id: string): KnowledgeBaseDocumentDetailResponse | null {
    const result = documentRepository.findByIdWithChunks(id);
    if (!result) {
      return null;
    }

    return {
      ...toDocumentResponse(result.document),
      contentText: result.document.contentText,
      chunks: result.chunks.map((chunk) => ({
        id: chunk.id,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        charCount: chunk.charCount,
        tokenCount: chunk.tokenCount ?? null,
        startOffset: chunk.startOffset ?? null,
        endOffset: chunk.endOffset ?? null,
        createdAt: chunk.createdAt,
      })),
    };
  },

  getDocumentSummaryById(id: string): KnowledgeBaseDocumentResponse | null {
    const document = documentRepository.findById(id);
    return document ? toDocumentResponse(document) : null;
  },

  async createDocument(
    input: CreateDocumentInput,
  ): Promise<KnowledgeBaseDocumentDetailResponse> {
    const kb = knowledgeBaseRepository.ensureDefault();
    const splitResult = await splitDocumentText(input.contentText, input.chunkingConfig);

    const created = documentRepository.createWithChunks({
      document: {
        knowledgeBaseId: kb.id,
        name: input.name.trim(),
        sourceType: input.sourceType ?? "upload",
        sourceLabel: input.sourceLabel?.trim() || DEFAULT_UPLOAD_SOURCE_LABEL,
        fileExt: input.fileExt.trim().toLowerCase(),
        mimeType: input.mimeType?.trim() || null,
        fileSize: input.fileSize ?? null,
        contentText: splitResult.normalizedText,
        indexStatus: "processing",
        enabled: input.enabled ?? true,
        chunkCount: splitResult.chunks.length,
        charCount: splitResult.normalizedText.length,
        tokenCount: null,
        errorMessage: null,
      },
      chunks: splitResult.chunks.map((chunk) => ({
        knowledgeBaseId: kb.id,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        charCount: chunk.charCount,
        tokenCount: null,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
      })),
    });

    const detail = this.getDocumentById(created.id)!;

    try {
      await embedDocumentChunks(kb.id, detail.chunks);
      documentRepository.updateById(created.id, {
        indexStatus: "ready",
        errorMessage: null,
      });
      invalidateLexicalIndex(kb.id);
    } catch (error) {
      cleanupDocumentArtifacts(detail);
      invalidateLexicalIndex(kb.id);

      throw error instanceof Error
        ? error
        : new Error(FAILED_GENERATE_EMBEDDINGS_MESSAGE);
    }

    return this.getDocumentById(created.id)!;
  },

  async createUploadDocument(
    input: CreateDocumentInput,
  ): Promise<KnowledgeBaseDocumentDetailResponse> {
    const kb = knowledgeBaseRepository.ensureDefault();
    const created = documentRepository.createWithChunks({
      document: {
        knowledgeBaseId: kb.id,
        name: input.name.trim(),
        sourceType: input.sourceType ?? "upload",
        sourceLabel: input.sourceLabel?.trim() || DEFAULT_UPLOAD_SOURCE_LABEL,
        fileExt: input.fileExt.trim().toLowerCase(),
        mimeType: input.mimeType?.trim() || null,
        fileSize: input.fileSize ?? null,
        contentText: input.contentText,
        indexStatus: "processing",
        enabled: input.enabled ?? true,
        chunkCount: 0,
        charCount: input.contentText.length,
        tokenCount: null,
        errorMessage: null,
      },
      chunks: [],
    });

    enqueueDocumentIndexing({
      documentId: created.id,
      chunkingConfig: input.chunkingConfig,
    });

    return this.getDocumentById(created.id)!;
  },

  async updateDocument(
    id: string,
    input: UpdateDocumentInput,
  ): Promise<KnowledgeBaseDocumentDetailResponse | null> {
    const existing = documentRepository.findById(id);
    if (!existing) {
      return null;
    }

    if (typeof input.contentText === "string") {
      const previousDetail = this.getDocumentById(id);
      invalidateLexicalIndex(existing.knowledgeBaseId);
      const splitResult = await splitDocumentText(
        input.contentText,
        input.chunkingConfig,
      );

      const updated = documentRepository.replaceChunks({
        documentId: existing.id,
        knowledgeBaseId: existing.knowledgeBaseId,
        contentText: splitResult.normalizedText,
        chunkCount: splitResult.chunks.length,
        charCount: splitResult.normalizedText.length,
        tokenCount: null,
        indexStatus: "processing",
        errorMessage: null,
        chunks: splitResult.chunks.map((chunk) => ({
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          charCount: chunk.charCount,
          tokenCount: null,
          startOffset: chunk.startOffset,
          endOffset: chunk.endOffset,
        })),
      });

      if (!updated) {
        return null;
      }

      try {
        if (previousDetail?.chunks.length) {
          const tableNames = knowledgeBaseVectorStore.listVectorIndexTableNames(
            previousDetail.knowledgeBaseId,
          );
          knowledgeBaseVectorStore.deleteChunkEmbeddings({
            tableNames,
            chunkIds: previousDetail.chunks.map((chunk) => chunk.id),
          });
        }

        const nextDetail = this.getDocumentById(id)!;
        await embedDocumentChunks(existing.knowledgeBaseId, nextDetail.chunks);

        documentRepository.updateById(id, {
          name:
            typeof input.name === "string"
              ? input.name.trim() || updated.name
              : undefined,
          enabled: typeof input.enabled === "boolean" ? input.enabled : undefined,
          sourceLabel:
            typeof input.sourceLabel === "string"
              ? input.sourceLabel.trim() || null
              : undefined,
          indexStatus: "ready",
          errorMessage: null,
        });
        invalidateLexicalIndex(existing.knowledgeBaseId);
      } catch (error) {
        const errorMessage = getErrorMessage(
          error,
          FAILED_GENERATE_EMBEDDINGS_MESSAGE,
        );

        documentRepository.updateById(id, {
          indexStatus: "failed",
          errorMessage,
        });
        invalidateLexicalIndex(existing.knowledgeBaseId);

        throw error;
      }

      return this.getDocumentById(id);
    }

    const updated = documentRepository.updateById(id, {
      name:
        typeof input.name === "string"
          ? input.name.trim() || existing.name
          : undefined,
      enabled: typeof input.enabled === "boolean" ? input.enabled : undefined,
      sourceLabel:
        typeof input.sourceLabel === "string"
          ? input.sourceLabel.trim() || null
          : undefined,
    });

    if (
      updated &&
      (typeof input.name === "string" || typeof input.enabled === "boolean")
    ) {
      invalidateLexicalIndex(existing.knowledgeBaseId);
    }

    return updated ? this.getDocumentById(updated.id) : null;
  },

  deleteDocument(id: string): boolean {
    const detail = this.getDocumentById(id);
    if (detail) {
      invalidateLexicalIndex(detail.knowledgeBaseId);
    }
    if (detail?.chunks.length) {
      const tableNames = knowledgeBaseVectorStore.listVectorIndexTableNames(
        detail.knowledgeBaseId,
      );
      knowledgeBaseVectorStore.deleteChunkEmbeddings({
        tableNames,
        chunkIds: detail.chunks.map((chunk) => chunk.id),
      });
    }

    return documentRepository.deleteById(id);
  },
};
