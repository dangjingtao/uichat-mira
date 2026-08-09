import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendRouteError } from "@/utils/route-errors.js";

const service = vi.hoisted(() => ({
  listKnowledgeBases: vi.fn(),
  getKnowledgeBaseById: vi.fn(),
  createKnowledgeBase: vi.fn(),
  updateKnowledgeBase: vi.fn(),
  deleteKnowledgeBase: vi.fn(),
  getDefaultKnowledgeBase: vi.fn(),
  listDocuments: vi.fn(),
  getDocumentSummaryById: vi.fn(),
  getDocumentSummaryByKnowledgeBaseId: vi.fn(),
  getDocumentById: vi.fn(),
  getDocumentByKnowledgeBaseId: vi.fn(),
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
  deleteDocument: vi.fn(),
}));

vi.mock("@/services/knowledge-base.service.js", () => ({ knowledgeBaseService: service }));

import { registerKnowledgeBaseDocumentRoutes } from "./documents.routes.js";

const document = {
  id: "doc-1",
  knowledgeBaseId: "kb-1",
  name: "Guide",
  sourceType: "upload",
  sourceLabel: null,
  fileExt: "md",
  mimeType: "text/markdown",
  fileSize: 12,
  indexStatus: "ready",
  enabled: true,
  chunkCount: 1,
  charCount: 12,
  tokenCount: null,
  errorMessage: null,
  createdAt: "2026-08-04T00:00:00.000Z",
  updatedAt: "2026-08-04T00:00:00.000Z",
  contentText: "Hello world",
  chunks: [{
    id: 1,
    chunkIndex: 1,
    content: "Hello world",
    charCount: 11,
    tokenCount: null,
    startOffset: 0,
    endOffset: 11,
    createdAt: "2026-08-04T00:00:00.000Z",
  }],
};

const createApp = async () => {
  const app = Fastify();
  app.setSerializerCompiler(() => (data) => JSON.stringify(data));
  app.setErrorHandler(sendRouteError);
  await registerKnowledgeBaseDocumentRoutes(app);
  return app;
};

describe("knowledge base document routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.getKnowledgeBaseById.mockReturnValue({ id: "kb-1" });
    service.listDocuments.mockReturnValue([document]);
    service.createDocument.mockResolvedValue(document);
    service.updateDocument.mockResolvedValue(document);
    service.deleteDocument.mockReturnValue(true);
  });

  it("normalizes document filters before listing", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/knowledge-base/documents?enabled=false&indexStatus=failed&sortBy=charCount&sortOrder=asc",
    });

    expect(response.statusCode).toBe(200);
    expect(service.listDocuments).toHaveBeenCalledWith(undefined, {
      search: undefined,
      enabled: false,
      indexStatus: "failed",
      sortBy: "charCount",
      sortOrder: "asc",
    });
    await app.close();
  });

  it("keeps create, update, and delete operations scoped to the selected knowledge base", async () => {
    const app = await createApp();
    const created = await app.inject({
      method: "POST",
      url: "/knowledge-bases/kb-1/documents",
      payload: { name: "Guide", fileExt: "md", contentText: "Hello world" },
    });
    expect(created.statusCode).toBe(200);
    expect(service.createDocument).toHaveBeenCalledWith("kb-1", expect.objectContaining({ name: "Guide" }));

    const updated = await app.inject({
      method: "PATCH",
      url: "/knowledge-bases/kb-1/documents/doc-1",
      payload: { enabled: false },
    });
    expect(updated.statusCode).toBe(200);
    expect(service.updateDocument).toHaveBeenCalledWith("kb-1", "doc-1", { enabled: false });

    const deleted = await app.inject({ method: "DELETE", url: "/knowledge-bases/kb-1/documents/doc-1" });
    expect(deleted.statusCode).toBe(200);
    expect(service.deleteDocument).toHaveBeenCalledWith("kb-1", "doc-1");
    await app.close();
  });

  it("returns 404 without reporting a deletion when the document is outside the requested knowledge base", async () => {
    service.deleteDocument.mockReturnValue(false);
    const app = await createApp();
    const response = await app.inject({ method: "DELETE", url: "/knowledge-bases/kb-2/documents/doc-1" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ success: false });
    expect(service.deleteDocument).toHaveBeenCalledWith("kb-2", "doc-1");
    await app.close();
  });
});
