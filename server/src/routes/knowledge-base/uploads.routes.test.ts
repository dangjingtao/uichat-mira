import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendRouteError } from "@/utils/route-errors.js";

const mocks = vi.hoisted(() => ({
  readSingleTextUpload: vi.fn(),
  parseChunkingConfig: vi.fn(),
  toUploadDocumentInput: vi.fn(),
  isMultipartTooLargeError: vi.fn(),
  previewChunks: vi.fn(),
  createUploadDocument: vi.fn(),
}));

vi.mock("./multipart.js", () => ({
  MultipartValidationError: class MultipartValidationError extends Error {},
  readSingleTextUpload: mocks.readSingleTextUpload,
  parseChunkingConfig: mocks.parseChunkingConfig,
  toUploadDocumentInput: mocks.toUploadDocumentInput,
  isMultipartTooLargeError: mocks.isMultipartTooLargeError,
  uploadLimitMessage: () => "Upload exceeds 10 MB",
}));
vi.mock("@/services/knowledge-base.preview.service.js", () => ({
  knowledgeBasePreviewService: { previewChunks: mocks.previewChunks },
}));
vi.mock("@/services/knowledge-base.service.js", () => ({
  knowledgeBaseService: { createUploadDocument: mocks.createUploadDocument },
}));

import { MultipartValidationError } from "./multipart.js";
import { registerKnowledgeBaseUploadRoutes } from "./uploads.routes.js";

const createApp = async () => {
  const app = Fastify();
  app.setSerializerCompiler(() => (data) => JSON.stringify(data));
  app.setErrorHandler(sendRouteError);
  await registerKnowledgeBaseUploadRoutes(app);
  return app;
};

describe("knowledge base upload routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const upload = { contentText: "alpha", fields: {}, fileName: "a.txt" };
    mocks.readSingleTextUpload.mockResolvedValue(upload);
    mocks.toUploadDocumentInput.mockReturnValue({ name: "a.txt", fileExt: "txt", contentText: "alpha" });
    mocks.createUploadDocument.mockResolvedValue({ id: "doc-1", indexStatus: "processing" });
    mocks.previewChunks.mockResolvedValue({ totalChunks: 1 });
    mocks.isMultipartTooLargeError.mockReturnValue(false);
  });

  it("starts upload indexing in the requested knowledge base", async () => {
    const app = await createApp();
    const response = await app.inject({ method: "POST", url: "/knowledge-bases/kb-1/documents/upload" });

    expect(response.statusCode).toBe(200);
    expect(servicePayload(response.json())).toMatchObject({ id: "doc-1", indexStatus: "processing" });
    expect(mocks.createUploadDocument).toHaveBeenCalledWith("kb-1", {
      name: "a.txt",
      fileExt: "txt",
      contentText: "alpha",
    });
    await app.close();
  });

  it("maps upload validation and size failures to stable client errors", async () => {
    const app = await createApp();
    mocks.readSingleTextUpload.mockRejectedValueOnce(new MultipartValidationError("Only one file is allowed"));
    const invalid = await app.inject({ method: "POST", url: "/knowledge-base/documents/upload" });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().message).toBe("Only one file is allowed");

    const tooLarge = new Error("limit");
    mocks.readSingleTextUpload.mockRejectedValueOnce(tooLarge);
    mocks.isMultipartTooLargeError.mockImplementation((error) => error === tooLarge);
    const oversized = await app.inject({ method: "POST", url: "/knowledge-base/documents/upload" });
    expect(oversized.statusCode).toBe(413);
    expect(oversized.json()).toMatchObject({ code: "UPLOAD_TOO_LARGE" });
    await app.close();
  });
});

const servicePayload = (body: { data?: unknown }) => body.data;
