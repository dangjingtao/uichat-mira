import { beforeEach, describe, expect, it, vi } from "vitest";

const mockClientPost = vi.hoisted(() => vi.fn());

vi.mock("@/shared/lib/request", () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
  client: { post: mockClientPost },
}));

import { get, post, patch, del, client } from "@/shared/lib/request";
import {
  getKnowledgeBase,
  listKnowledgeBases,
  getKnowledgeBaseById,
  createKnowledgeBase,
  updateKnowledgeBase,
  deleteKnowledgeBase,
  listKnowledgeBaseDocuments,
  getKnowledgeBaseDocument,
  getKnowledgeBaseDocumentStatus,
  createKnowledgeBaseDocument,
  uploadKnowledgeBaseDocument,
  previewKnowledgeBaseChunks,
  updateKnowledgeBaseDocument,
  updateDefaultKnowledgeBaseDocument,
  deleteKnowledgeBaseDocument,
  type KnowledgeBaseSummary,
  type KnowledgeBaseDocument,
  type KnowledgeBaseDocumentDetail,
  type ChunkPreviewResult,
} from "../knowledgeBase";

const sampleKnowledgeBase: KnowledgeBaseSummary = {
  id: "kb-1",
  name: "默认知识库",
  description: "测试用",
  status: "active",
  isSystem: true,
  metadata: { persona: null, scenario: null, tags: [] },
  documentCount: 2,
  enabledDocumentCount: 2,
  totalChunkCount: 10,
  createdAt: "2026-07-06T00:00:00.000Z",
  updatedAt: "2026-07-06T00:00:00.000Z",
};

const sampleDocument: KnowledgeBaseDocument = {
  id: "doc-1",
  knowledgeBaseId: "kb-1",
  name: "doc.txt",
  sourceType: "upload",
  sourceLabel: null,
  fileExt: "txt",
  mimeType: "text/plain",
  fileSize: 100,
  indexStatus: "ready",
  enabled: true,
  chunkCount: 5,
  charCount: 200,
  tokenCount: 50,
  errorMessage: null,
  createdAt: "2026-07-06T00:00:00.000Z",
  updatedAt: "2026-07-06T00:00:00.000Z",
};

const sampleDocumentDetail: KnowledgeBaseDocumentDetail = {
  ...sampleDocument,
  contentText: "hello world",
  chunks: [],
};

const sampleChunkPreview: ChunkPreviewResult = {
  totalChunks: 1,
  stats: {
    totalChunks: 1,
    minChunkLength: 11,
    maxChunkLength: 11,
    averageChunkLength: 11,
    normalizedTextLength: 11,
  },
  effectiveConfig: {
    splitterType: "recursive",
    chunkSize: 1000,
    chunkOverlap: 100,
    keepSeparator: false,
    separator: "",
    separators: [],
    presetLanguage: null,
    encodingName: "cl100k_base",
    allowedSpecial: "all",
    disallowedSpecial: "all",
    lengthMetric: "characters",
    replaceWhitespace: false,
    removeUrls: false,
    useQaSplit: false,
  },
  sampleChunks: [
    { id: "chunk-1", index: 0, text: "hello world", charCount: 11 },
  ],
};

describe("knowledge base api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClientPost.mockReset();
  });

  it("getKnowledgeBase 获取默认知识库", async () => {
    vi.mocked(get).mockResolvedValueOnce(sampleKnowledgeBase);

    const result = await getKnowledgeBase();

    expect(get).toHaveBeenCalledWith("/knowledge-base");
    expect(result).toBe(sampleKnowledgeBase);
  });

  it("listKnowledgeBases 获取知识库列表", async () => {
    vi.mocked(get).mockResolvedValueOnce([sampleKnowledgeBase]);

    const result = await listKnowledgeBases();

    expect(get).toHaveBeenCalledWith("/knowledge-bases");
    expect(result).toEqual([sampleKnowledgeBase]);
  });

  it("getKnowledgeBaseById 按 id 获取知识库", async () => {
    vi.mocked(get).mockResolvedValueOnce(sampleKnowledgeBase);

    const result = await getKnowledgeBaseById("kb-1");

    expect(get).toHaveBeenCalledWith("/knowledge-bases/kb-1");
    expect(result).toBe(sampleKnowledgeBase);
  });

  it("createKnowledgeBase 创建知识库", async () => {
    vi.mocked(post).mockResolvedValueOnce(sampleKnowledgeBase);

    const payload = { name: "新知识库" };
    const result = await createKnowledgeBase(payload);

    expect(post).toHaveBeenCalledWith("/knowledge-bases", payload);
    expect(result).toBe(sampleKnowledgeBase);
  });

  it("updateKnowledgeBase 更新知识库", async () => {
    vi.mocked(patch).mockResolvedValueOnce(sampleKnowledgeBase);

    const payload = { name: "已更新" };
    const result = await updateKnowledgeBase("kb-1", payload);

    expect(patch).toHaveBeenCalledWith("/knowledge-bases/kb-1", payload);
    expect(result).toBe(sampleKnowledgeBase);
  });

  it("deleteKnowledgeBase 删除知识库", async () => {
    vi.mocked(del).mockResolvedValueOnce({ deleted: true });

    const result = await deleteKnowledgeBase("kb-1");

    expect(del).toHaveBeenCalledWith("/knowledge-bases/kb-1");
    expect(result).toEqual({ deleted: true });
  });

  describe("documents", () => {
    it("listKnowledgeBaseDocuments 按知识库 id 列出文档", async () => {
      vi.mocked(get).mockResolvedValueOnce([sampleDocument]);

      const result = await listKnowledgeBaseDocuments("kb-1", {
        search: "hello",
      });

      expect(get).toHaveBeenCalledWith("/knowledge-bases/kb-1/documents", {
        params: { search: "hello", enabled: undefined },
      });
      expect(result).toEqual([sampleDocument]);
    });

    it("listKnowledgeBaseDocuments 使用默认知识库路径", async () => {
      vi.mocked(get).mockResolvedValueOnce([sampleDocument]);

      const result = await listKnowledgeBaseDocuments({ enabled: true });

      expect(get).toHaveBeenCalledWith("/knowledge-base/documents", {
        params: { enabled: "true" },
      });
      expect(result).toEqual([sampleDocument]);
    });

    it("getKnowledgeBaseDocument 按知识库 id 获取文档详情", async () => {
      vi.mocked(get).mockResolvedValueOnce(sampleDocumentDetail);

      const result = await getKnowledgeBaseDocument("kb-1", "doc-1");

      expect(get).toHaveBeenCalledWith("/knowledge-bases/kb-1/documents/doc-1");
      expect(result).toBe(sampleDocumentDetail);
    });

    it("getKnowledgeBaseDocument 使用默认知识库路径", async () => {
      vi.mocked(get).mockResolvedValueOnce(sampleDocumentDetail);

      const result = await getKnowledgeBaseDocument("doc-1");

      expect(get).toHaveBeenCalledWith("/knowledge-base/documents/doc-1");
      expect(result).toBe(sampleDocumentDetail);
    });

    it("getKnowledgeBaseDocumentStatus 查询文档状态", async () => {
      vi.mocked(get).mockResolvedValueOnce(sampleDocument);

      const result = await getKnowledgeBaseDocumentStatus("kb-1", "doc-1");

      expect(get).toHaveBeenCalledWith(
        "/knowledge-bases/kb-1/documents/doc-1/status",
      );
      expect(result).toBe(sampleDocument);
    });

    it("createKnowledgeBaseDocument 创建文档", async () => {
      vi.mocked(post).mockResolvedValueOnce(sampleDocumentDetail);

      const payload = { name: "doc.txt", fileExt: "txt", contentText: "hi" };
      const result = await createKnowledgeBaseDocument("kb-1", payload);

      expect(post).toHaveBeenCalledWith(
        "/knowledge-bases/kb-1/documents",
        payload,
      );
      expect(result).toBe(sampleDocumentDetail);
    });

    it("uploadKnowledgeBaseDocument 使用 FormData 上传", async () => {
      const file = new File(["content"], "doc.txt", { type: "text/plain" });
      mockClientPost.mockResolvedValueOnce({
        data: { data: sampleDocument },
      });

      const result = await uploadKnowledgeBaseDocument("kb-1", { file });

      expect(client.post).toHaveBeenCalledWith(
        "/knowledge-bases/kb-1/documents/upload",
        expect.any(FormData),
        {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 300000,
        },
      );
      expect(result).toBe(sampleDocument);
    });

    it("previewKnowledgeBaseChunks 预览分块", async () => {
      const file = new File(["content"], "doc.txt", { type: "text/plain" });
      mockClientPost.mockResolvedValueOnce({
        data: { data: sampleChunkPreview },
      });

      const result = await previewKnowledgeBaseChunks({ file });

      expect(client.post).toHaveBeenCalledWith(
        "/knowledge-base/chunk-preview",
        expect.any(FormData),
        {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 300000,
        },
      );
      expect(result).toBe(sampleChunkPreview);
    });

    it("updateKnowledgeBaseDocument 更新文档", async () => {
      vi.mocked(patch).mockResolvedValueOnce(sampleDocumentDetail);

      const payload = { name: "new.txt" };
      const result = await updateKnowledgeBaseDocument(
        "kb-1",
        "doc-1",
        payload,
      );

      expect(patch).toHaveBeenCalledWith(
        "/knowledge-bases/kb-1/documents/doc-1",
        payload,
      );
      expect(result).toBe(sampleDocumentDetail);
    });

    it("updateDefaultKnowledgeBaseDocument 更新默认知识库文档", async () => {
      vi.mocked(patch).mockResolvedValueOnce(sampleDocumentDetail);

      const payload = { name: "new.txt" };
      const result = await updateDefaultKnowledgeBaseDocument("doc-1", payload);

      expect(patch).toHaveBeenCalledWith(
        "/knowledge-base/documents/doc-1",
        payload,
      );
      expect(result).toBe(sampleDocumentDetail);
    });

    it("deleteKnowledgeBaseDocument 删除文档", async () => {
      vi.mocked(del).mockResolvedValueOnce({ deleted: true });

      const result = await deleteKnowledgeBaseDocument("kb-1", "doc-1");

      expect(del).toHaveBeenCalledWith("/knowledge-bases/kb-1/documents/doc-1");
      expect(result).toEqual({ deleted: true });
    });
  });
});
