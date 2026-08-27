import { Readable } from "node:stream";
import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendRouteError } from "@/utils/route-errors.js";

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  stream: vi.fn(),
  retrieveOnly: vi.fn(),
}));

vi.mock("@/services/rag-pipeline", () => ({ ragPipeline: mocks }));
vi.mock("@/db/auth.db.js", () => ({
  requireAuth: async (request: { authUser?: unknown }) => {
    request.authUser = { id: 41, username: "rag-user", role: "user" };
  },
}));

import chatRagRoute from "./chat-rag.js";

const createApp = async () => {
  const app = Fastify();
  app.setSerializerCompiler(() => (data) => JSON.stringify(data));
  app.setErrorHandler(sendRouteError);
  await app.register(chatRagRoute);
  return app;
};

describe("chat RAG routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.run.mockResolvedValue({ answer: "answer", sources: [] });
    mocks.retrieveOnly.mockResolvedValue([]);
    mocks.stream.mockReturnValue(Readable.from(["data: done\n\n"]));
  });

  it("binds non-streaming RAG execution to the authenticated user", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/chat/rag",
      payload: { question: "What changed?", knowledgeBaseId: "kb-1", topK: 5 },
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.run).toHaveBeenCalledWith({
      question: "What changed?",
      knowledgeBaseId: "kb-1",
      topK: 5,
      userId: 41,
    });
    await app.close();
  });

  it("returns retrieval failures as a stable route error", async () => {
    mocks.retrieveOnly.mockRejectedValue(new Error("embedding provider offline"));
    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/chat/rag/retrieve",
      payload: { question: "Find evidence" },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ success: false, message: "Failed to retrieve RAG chunks" });
    expect(mocks.retrieveOnly).toHaveBeenCalledWith({ question: "Find evidence", userId: 41 });
    await app.close();
  });

  it("exposes streaming responses with SSE headers", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/chat/rag/stream",
      payload: { question: "Stream this" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(mocks.stream).toHaveBeenCalledWith({ question: "Stream this", userId: 41 });
    await app.close();
  });
});
