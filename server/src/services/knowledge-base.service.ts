import {
  DEFAULT_KNOWLEDGE_BASE_ID,
  DEFAULT_KNOWLEDGE_BASE_NAME,
} from "@/db/knowledge-base.db";
import {
  documentRepository,
  knowledgeBaseRepository,
  type DocumentListFilters,
} from "@/db/repositories";
import type {
  Document,
  DocumentIndexStatus,
  DocumentSourceType,
} from "@/db/schema";
import {
  splitDocumentText,
  type ChunkingConfig,
} from "@/services/knowledge-base.splitter";

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

const toDocumentResponse = (document: Document): KnowledgeBaseDocumentResponse => ({
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

  createDocument(input: CreateDocumentInput): KnowledgeBaseDocumentDetailResponse {
    const kb = knowledgeBaseRepository.ensureDefault();
    const splitResult = splitDocumentText(input.contentText, input.chunkingConfig);

    const created = documentRepository.createWithChunks({
      document: {
        knowledgeBaseId: kb.id,
        name: input.name.trim(),
        sourceType: input.sourceType ?? "upload",
        sourceLabel: input.sourceLabel?.trim() || "本地上传",
        fileExt: input.fileExt.trim().toLowerCase(),
        mimeType: input.mimeType?.trim() || null,
        fileSize: input.fileSize ?? null,
        contentText: splitResult.normalizedText,
        indexStatus: "ready",
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

    return this.getDocumentById(created.id)!;
  },

  updateDocument(id: string, input: UpdateDocumentInput): KnowledgeBaseDocumentDetailResponse | null {
    const existing = documentRepository.findById(id);
    if (!existing) {
      return null;
    }

    if (typeof input.contentText === "string") {
      const splitResult = splitDocumentText(input.contentText, input.chunkingConfig);

      const updated = documentRepository.replaceChunks({
        documentId: existing.id,
        knowledgeBaseId: existing.knowledgeBaseId,
        contentText: splitResult.normalizedText,
        chunkCount: splitResult.chunks.length,
        charCount: splitResult.normalizedText.length,
        tokenCount: null,
        indexStatus: "ready",
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

      if (
        typeof input.name === "string" ||
        typeof input.enabled === "boolean" ||
        "sourceLabel" in input
      ) {
        documentRepository.updateById(id, {
          name: typeof input.name === "string" ? input.name.trim() || updated.name : undefined,
          enabled: typeof input.enabled === "boolean" ? input.enabled : undefined,
          sourceLabel:
            typeof input.sourceLabel === "string"
              ? input.sourceLabel.trim() || null
              : undefined,
        });
      }

      return this.getDocumentById(id);
    }

    const updated = documentRepository.updateById(id, {
      name: typeof input.name === "string" ? input.name.trim() || existing.name : undefined,
      enabled: typeof input.enabled === "boolean" ? input.enabled : undefined,
      sourceLabel:
        typeof input.sourceLabel === "string"
          ? input.sourceLabel.trim() || null
          : undefined,
    });

    return updated ? this.getDocumentById(updated.id) : null;
  },

  deleteDocument(id: string): boolean {
    return documentRepository.deleteById(id);
  },
};
