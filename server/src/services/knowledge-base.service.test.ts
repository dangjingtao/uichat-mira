import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureDefault: vi.fn(),
  getKnowledgeBaseById: vi.fn(),
  touchById: vi.fn(),
  documentFindById: vi.fn(),
  findByIdWithChunks: vi.fn(),
  createWithChunks: vi.fn(),
  replaceChunks: vi.fn(),
  updateDocumentById: vi.fn(),
  deleteDocumentById: vi.fn(),
  splitDocumentText: vi.fn(),
  createEmbeddings: vi.fn(),
  listVectorIndexTableNames: vi.fn(),
  deleteChunkEmbeddings: vi.fn(),
  ensureDefaultVectorIndex: vi.fn(),
  upsertChunkEmbeddings: vi.fn(),
  invalidateKnowledgeBase: vi.fn(),
}));

vi.mock("@/db/repositories", () => ({
  knowledgeBaseRepository: {
    ensureDefault: mocks.ensureDefault,
    getById: mocks.getKnowledgeBaseById,
    touchById: mocks.touchById,
  },
  documentRepository: {
    findById: mocks.documentFindById,
    findByIdWithChunks: mocks.findByIdWithChunks,
    createWithChunks: mocks.createWithChunks,
    replaceChunks: mocks.replaceChunks,
    updateById: mocks.updateDocumentById,
    deleteById: mocks.deleteDocumentById,
  },
}));
vi.mock("@/services/knowledge-base.splitter", () => ({
  splitDocumentText: mocks.splitDocumentText,
}));
vi.mock("@/services/knowledge-base.vector-store.js", () => ({
  knowledgeBaseVectorStore: {
    listVectorIndexTableNames: mocks.listVectorIndexTableNames,
    deleteChunkEmbeddings: mocks.deleteChunkEmbeddings,
    ensureDefaultVectorIndex: mocks.ensureDefaultVectorIndex,
    upsertChunkEmbeddings: mocks.upsertChunkEmbeddings,
  },
}));
vi.mock("@/services/rag-nodes/lexical-retrieve.service.js", () => ({
  lexicalRetrieveService: { invalidateKnowledgeBase: mocks.invalidateKnowledgeBase },
}));
vi.mock("@/services/provider-proxy.service/index.js", () => ({
  providerProxyService: { createEmbeddings: mocks.createEmbeddings },
}));

import { knowledgeBaseService } from "./knowledge-base.service.js";

const documentRow = {
  id: "doc-1",
  knowledgeBaseId: "kb-1",
  name: "Guide",
  sourceType: "upload" as const,
  sourceLabel: null,
  fileExt: "md",
  mimeType: "text/markdown",
  fileSize: 20,
  contentText: "hello world",
  indexStatus: "ready" as const,
  enabled: true,
  chunkCount: 1,
  charCount: 11,
  tokenCount: null,
  errorMessage: null,
  createdAt: "2026-08-04T00:00:00.000Z",
  updatedAt: "2026-08-04T00:00:00.000Z",
};
const chunkRow = {
  id: 7,
  chunkIndex: 1,
  content: "hello world",
  charCount: 11,
  tokenCount: null,
  startOffset: 0,
  endOffset: 11,
  createdAt: "2026-08-04T00:00:00.000Z",
};

describe("knowledge base service consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureDefault.mockReturnValue({ id: "kb-1" });
    mocks.getKnowledgeBaseById.mockImplementation((id) => id === "kb-1" ? { id: "kb-1" } : null);
    mocks.findByIdWithChunks.mockReturnValue({ document: documentRow, chunks: [chunkRow] });
    mocks.documentFindById.mockReturnValue(documentRow);
    mocks.listVectorIndexTableNames.mockReturnValue(["vec_kb_1"]);
    mocks.deleteDocumentById.mockReturnValue(true);
    mocks.createWithChunks.mockReturnValue(documentRow);
    mocks.splitDocumentText.mockResolvedValue({
      normalizedText: "hello world",
      chunks: [{ chunkIndex: 1, content: "hello world", charCount: 11, startOffset: 0, endOffset: 11 }],
    });
  });

  it("does not delete a document through a different knowledge base", () => {
    const deleted = knowledgeBaseService.deleteDocument("kb-2", "doc-1");

    expect(deleted).toBe(false);
    expect(mocks.deleteChunkEmbeddings).not.toHaveBeenCalled();
    expect(mocks.deleteDocumentById).not.toHaveBeenCalled();
    expect(mocks.touchById).not.toHaveBeenCalled();
  });

  it("removes vector rows, the document, and lexical cache in one scoped deletion", () => {
    const deleted = knowledgeBaseService.deleteDocument("kb-1", "doc-1");

    expect(deleted).toBe(true);
    expect(mocks.invalidateKnowledgeBase).toHaveBeenCalledWith("kb-1");
    expect(mocks.deleteChunkEmbeddings).toHaveBeenCalledWith({ tableNames: ["vec_kb_1"], chunkIds: [7] });
    expect(mocks.deleteDocumentById).toHaveBeenCalledWith("doc-1");
    expect(mocks.touchById).toHaveBeenCalledWith("kb-1");
  });

  it("cleans persisted chunks and the document when embedding fails during creation", async () => {
    mocks.createEmbeddings.mockRejectedValue(new Error("embedding provider offline"));

    await expect(knowledgeBaseService.createDocument("kb-1", {
      name: "Guide",
      fileExt: "md",
      contentText: "hello world",
    })).rejects.toThrow("embedding provider offline");

    expect(mocks.deleteChunkEmbeddings).toHaveBeenCalledWith({ tableNames: ["vec_kb_1"], chunkIds: [7] });
    expect(mocks.deleteDocumentById).toHaveBeenCalledWith("doc-1");
    expect(mocks.touchById).toHaveBeenCalledWith("kb-1");
    expect(mocks.invalidateKnowledgeBase).toHaveBeenCalledWith("kb-1");
  });
});
