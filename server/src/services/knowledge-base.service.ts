import { documentRepository, knowledgeBaseRepository, type DocumentListFilters } from "@/db/repositories";
import type { Document, DocumentIndexStatus, DocumentSourceType } from "@/db/schema";
import {
  DEFAULT_CHUNKING_CONFIG,
  DEFAULT_KNOWLEDGE_BASE_ID,
  DEFAULT_UPLOAD_SOURCE_LABEL,
  MAX_EMBEDDING_BATCH_CHARS,
  MAX_EMBEDDING_BATCH_INPUTS,
} from "@/constants/knowledge-base.js";
import { splitDocumentText, type ChunkingConfig } from "@/services/knowledge-base.splitter";
import { knowledgeBaseVectorStore } from "@/services/knowledge-base.vector-store.js";
import { lexicalRetrieveService } from "@/services/rag-nodes/lexical-retrieve.service.js";
import { providerProxyService } from "@/services/provider-proxy.service/index.js";
import {
  FAILED_GENERATE_EMBEDDINGS_MESSAGE,
  getErrorMessage,
} from "@/utils/errors.js";
import { forbidden } from "@/utils/route-errors.js";

export interface KnowledgeBaseSummaryResponse {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  isSystem: boolean;
  metadata: {
    persona: string | null;
    scenario: string | null;
    tags: string[];
  };
  documentCount: number;
  enabledDocumentCount: number;
  totalChunkCount: number;
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
  textEncoding?: string | null;
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

export interface CreateKnowledgeBaseInput {
  name: string;
  description?: string | null;
  status?: "active" | "archived";
  embeddingModelConfigId?: string | null;
  metadata?: {
    persona?: string | null;
    scenario?: string | null;
    tags?: string[];
  };
  chunkingConfig?: Partial<ChunkingConfig> | null;
}

export interface UpdateKnowledgeBaseInput {
  name?: string;
  description?: string | null;
  status?: "active" | "archived";
  embeddingModelConfigId?: string | null;
  metadata?: {
    persona?: string | null;
    scenario?: string | null;
    tags?: string[];
  };
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
    knowledgeBaseRepository.touchById(existing.knowledgeBaseId);
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
    knowledgeBaseRepository.touchById(existing.knowledgeBaseId);
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

const normalizeKnowledgeBaseMetadata = (value: unknown) => {
  const raw =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};

  const persona =
    typeof (raw as { persona?: unknown }).persona === "string"
      ? (raw as { persona: string }).persona.trim() || null
      : null;
  const scenario =
    typeof (raw as { scenario?: unknown }).scenario === "string"
      ? (raw as { scenario: string }).scenario.trim() || null
      : null;
  const tags = Array.isArray((raw as { tags?: unknown[] }).tags)
    ? Array.from(
        new Set(
          (raw as { tags: unknown[] }).tags
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      )
    : [];

  return {
    persona,
    scenario,
    tags,
  };
};

const parseKnowledgeBaseMetadata = (metadataJson: string | null | undefined) => {
  if (!metadataJson?.trim()) {
    return normalizeKnowledgeBaseMetadata({});
  }

  try {
    return normalizeKnowledgeBaseMetadata(JSON.parse(metadataJson));
  } catch {
    return normalizeKnowledgeBaseMetadata({});
  }
};

const toKnowledgeBaseSummary = (knowledgeBaseId: string) => {
  const kb = knowledgeBaseRepository.getById(knowledgeBaseId);
  if (!kb) {
    return null;
  }

  const docs = documentRepository.listByKnowledgeBase(kb.id);
  return {
    id: kb.id,
    name: kb.name,
    description: kb.description ?? null,
    status: kb.status,
    isSystem: kb.id === DEFAULT_KNOWLEDGE_BASE_ID,
    metadata: parseKnowledgeBaseMetadata(kb.metadataJson),
    documentCount: docs.length,
    enabledDocumentCount: docs.filter((item) => item.enabled).length,
    totalChunkCount: docs.reduce((sum, item) => sum + item.chunkCount, 0),
    createdAt: kb.createdAt,
    updatedAt: kb.updatedAt,
  } satisfies KnowledgeBaseSummaryResponse;
};

const resolveKnowledgeBase = (knowledgeBaseId?: string) => {
  if (!knowledgeBaseId?.trim()) {
    return knowledgeBaseRepository.ensureDefault();
  }

  return knowledgeBaseRepository.getById(knowledgeBaseId.trim()) ?? null;
};

export const knowledgeBaseService = {
  listKnowledgeBases(): KnowledgeBaseSummaryResponse[] {
    knowledgeBaseRepository.ensureDefault();
    return knowledgeBaseRepository
      .list()
      .map((knowledgeBase) => toKnowledgeBaseSummary(knowledgeBase.id))
      .filter((knowledgeBase): knowledgeBase is KnowledgeBaseSummaryResponse =>
        Boolean(knowledgeBase),
      );
  },

  getDefaultKnowledgeBase(): KnowledgeBaseSummaryResponse {
    return this.getKnowledgeBaseById(knowledgeBaseRepository.ensureDefault().id)!;
  },

  getKnowledgeBaseById(id: string): KnowledgeBaseSummaryResponse | null {
    return toKnowledgeBaseSummary(id);
  },

  createKnowledgeBase(input: CreateKnowledgeBaseInput): KnowledgeBaseSummaryResponse {
    const name = input.name.trim();
    if (!name) {
      throw new Error("Knowledge base name is required");
    }

    const created = knowledgeBaseRepository.create({
      name,
      description: input.description?.trim() || null,
      status: input.status ?? "active",
      embeddingModelConfigId: input.embeddingModelConfigId?.trim() || null,
      chunkingConfigJson: JSON.stringify({
        ...DEFAULT_CHUNKING_CONFIG,
        ...(input.chunkingConfig ?? {}),
      }),
      metadataJson: JSON.stringify(normalizeKnowledgeBaseMetadata(input.metadata)),
    });

    return this.getKnowledgeBaseById(created.id)!;
  },

  updateKnowledgeBase(
    id: string,
    input: UpdateKnowledgeBaseInput,
  ): KnowledgeBaseSummaryResponse | null {
    const existing = knowledgeBaseRepository.getById(id);
    if (!existing) {
      return null;
    }

    const updated = knowledgeBaseRepository.updateById(id, {
      name:
        typeof input.name === "string"
          ? input.name.trim() || existing.name
          : undefined,
      description:
        input.description === undefined
          ? undefined
          : input.description?.trim() || null,
      status: input.status,
      embeddingModelConfigId:
        input.embeddingModelConfigId === undefined
          ? undefined
          : input.embeddingModelConfigId?.trim() || null,
      metadataJson:
        input.metadata === undefined
          ? undefined
          : JSON.stringify(
              normalizeKnowledgeBaseMetadata({
                ...parseKnowledgeBaseMetadata(existing.metadataJson),
                ...input.metadata,
              }),
            ),
      chunkingConfigJson:
        input.chunkingConfig === undefined
          ? undefined
          : JSON.stringify({
              ...DEFAULT_CHUNKING_CONFIG,
              ...JSON.parse(existing.chunkingConfigJson || "{}"),
              ...input.chunkingConfig,
            }),
    });

    return updated ? this.getKnowledgeBaseById(updated.id) : null;
  },

  deleteKnowledgeBase(id: string): boolean {
    const existing = knowledgeBaseRepository.getById(id);
    if (!existing) {
      return false;
    }

    if (existing.id === DEFAULT_KNOWLEDGE_BASE_ID) {
      throw forbidden("Default knowledge base cannot be deleted");
    }

    const documentDetails = documentRepository
      .listByKnowledgeBase(id)
      .map((document) => this.getDocumentById(document.id))
      .filter(
        (document): document is KnowledgeBaseDocumentDetailResponse =>
          Boolean(document),
      );

    const chunkIds = documentDetails.flatMap((document) =>
      document.chunks.map((chunk) => chunk.id),
    );
    const tableNames = knowledgeBaseVectorStore.listVectorIndexTableNames(id);

    if (chunkIds.length > 0 && tableNames.length > 0) {
      knowledgeBaseVectorStore.deleteChunkEmbeddings({
        tableNames,
        chunkIds,
      });
    }

    invalidateLexicalIndex(id);
    knowledgeBaseVectorStore.dropVectorTables(tableNames);
    knowledgeBaseVectorStore.deleteVectorIndexes(id);

    return knowledgeBaseRepository.deleteById(id);
  },

  listDocuments(
    knowledgeBaseIdOrFilters?: string | DocumentListFilters,
    filters: DocumentListFilters = {},
  ): KnowledgeBaseDocumentResponse[] {
    const knowledgeBaseId =
      typeof knowledgeBaseIdOrFilters === "string"
        ? knowledgeBaseIdOrFilters
        : undefined;
    const effectiveFilters =
      typeof knowledgeBaseIdOrFilters === "string"
        ? filters
        : (knowledgeBaseIdOrFilters ?? {});
    const kb = resolveKnowledgeBase(knowledgeBaseId);
    if (!kb) {
      return [];
    }

    return documentRepository
      .listByKnowledgeBase(kb.id, effectiveFilters)
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

  getDocumentByKnowledgeBaseId(
    knowledgeBaseId: string,
    id: string,
  ): KnowledgeBaseDocumentDetailResponse | null {
    const result = this.getDocumentById(id);
    if (!result || result.knowledgeBaseId !== knowledgeBaseId) {
      return null;
    }

    return result;
  },

  getDocumentSummaryById(id: string): KnowledgeBaseDocumentResponse | null {
    const document = documentRepository.findById(id);
    return document ? toDocumentResponse(document) : null;
  },

  getDocumentSummaryByKnowledgeBaseId(
    knowledgeBaseId: string,
    id: string,
  ): KnowledgeBaseDocumentResponse | null {
    const result = this.getDocumentSummaryById(id);
    if (!result || result.knowledgeBaseId !== knowledgeBaseId) {
      return null;
    }

    return result;
  },

  async createDocument(
    knowledgeBaseId: string | undefined,
    input: CreateDocumentInput,
  ): Promise<KnowledgeBaseDocumentDetailResponse> {
    const kb = resolveKnowledgeBase(knowledgeBaseId);
    if (!kb) {
      throw new Error("Knowledge base not found");
    }

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
      knowledgeBaseRepository.touchById(kb.id);
      invalidateLexicalIndex(kb.id);
    } catch (error) {
      cleanupDocumentArtifacts(detail);
      knowledgeBaseRepository.touchById(kb.id);
      invalidateLexicalIndex(kb.id);

      throw error instanceof Error
        ? error
        : new Error(FAILED_GENERATE_EMBEDDINGS_MESSAGE);
    }

    return this.getDocumentById(created.id)!;
  },

  async createUploadDocument(
    knowledgeBaseId: string | undefined,
    input: CreateDocumentInput,
  ): Promise<KnowledgeBaseDocumentDetailResponse> {
    const kb = resolveKnowledgeBase(knowledgeBaseId);
    if (!kb) {
      throw new Error("Knowledge base not found");
    }

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
    knowledgeBaseRepository.touchById(kb.id);

    return this.getDocumentById(created.id)!;
  },

  async updateDocument(
    knowledgeBaseId: string | undefined,
    id: string,
    input: UpdateDocumentInput,
  ): Promise<KnowledgeBaseDocumentDetailResponse | null> {
    const existing = documentRepository.findById(id);
    if (!existing) {
      return null;
    }

    if (knowledgeBaseId && existing.knowledgeBaseId !== knowledgeBaseId) {
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
        knowledgeBaseRepository.touchById(existing.knowledgeBaseId);
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
        knowledgeBaseRepository.touchById(existing.knowledgeBaseId);
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

    if (updated) {
      knowledgeBaseRepository.touchById(existing.knowledgeBaseId);
    }

    if (
      updated &&
      (typeof input.name === "string" ||
        typeof input.enabled === "boolean" ||
        typeof input.sourceLabel === "string")
    ) {
      invalidateLexicalIndex(existing.knowledgeBaseId);
    }

    return updated ? this.getDocumentById(updated.id) : null;
  },

  deleteDocument(knowledgeBaseIdOrId: string, id?: string): boolean {
    const knowledgeBaseId = id ? knowledgeBaseIdOrId : undefined;
    const documentId = id ?? knowledgeBaseIdOrId;
    const detail = knowledgeBaseId
      ? this.getDocumentByKnowledgeBaseId(knowledgeBaseId, documentId)
      : this.getDocumentById(documentId);
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

    const deleted = detail ? documentRepository.deleteById(detail.id) : false;
    if (deleted && detail) {
      knowledgeBaseRepository.touchById(detail.knowledgeBaseId);
    }

    return deleted;
  },
};
