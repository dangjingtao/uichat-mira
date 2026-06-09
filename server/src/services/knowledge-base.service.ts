import { documentRepository, knowledgeBaseRepository, type DocumentListFilters } from "@/db/repositories";
import type { Document, DocumentIndexStatus, DocumentSourceType } from "@/db/schema";
import { splitDocumentText, type ChunkingConfig } from "@/services/knowledge-base.splitter";
import { knowledgeBaseVectorStore } from "@/services/knowledge-base.vector-store.js";
import { providerProxyService } from "@/services/provider-proxy.service.js";

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

const DEFAULT_UPLOAD_SOURCE_LABEL = "本地上传";

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

  const embeddingResult = await providerProxyService.createEmbeddings(
    "default",
    chunks.map((chunk) => chunk.content),
  );

  const vectorIndex = knowledgeBaseVectorStore.ensureDefaultVectorIndex({
    knowledgeBaseId,
    embeddingModelConfigId: embeddingResult.modelConfigId,
    model: embeddingResult.model,
    dimensions: embeddingResult.dimensions,
  });

  knowledgeBaseVectorStore.upsertChunkEmbeddings({
    tableName: vectorIndex.tableName,
    rows: chunks.map((chunk, index) => ({
      chunkId: chunk.id,
      embedding: embeddingResult.embeddings[index] ?? [],
    })),
  });
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

  async createDocument(
    input: CreateDocumentInput,
  ): Promise<KnowledgeBaseDocumentDetailResponse> {
    const kb = knowledgeBaseRepository.ensureDefault();
    const splitResult = splitDocumentText(input.contentText, input.chunkingConfig);

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
    } catch (error) {
      cleanupDocumentArtifacts(detail);

      throw error instanceof Error
        ? error
        : new Error("Failed to generate embeddings");
    }

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
      const splitResult = splitDocumentText(
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
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to generate embeddings";

        documentRepository.updateById(id, {
          indexStatus: "failed",
          errorMessage,
        });

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

    return updated ? this.getDocumentById(updated.id) : null;
  },

  deleteDocument(id: string): boolean {
    const detail = this.getDocumentById(id);
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
