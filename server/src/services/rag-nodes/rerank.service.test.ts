import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findDefaultByType: vi.fn(),
  resolveRerankProvider: vi.fn(),
  fetchJsonWithTimeout: vi.fn(),
  writeStructuredLog: vi.fn(),
}));

vi.mock("@/db/repositories", () => ({
  modelConfigRepository: { findDefaultByType: mocks.findDefaultByType },
}));
vi.mock("@/services/provider-proxy.service/index.js", () => ({
  providerProxyService: { resolveRerankProvider: mocks.resolveRerankProvider },
}));
vi.mock("@/utils/http", () => ({ fetchJsonWithTimeout: mocks.fetchJsonWithTimeout }));
vi.mock("@/logger", () => ({ writeStructuredLog: mocks.writeStructuredLog }));

import { rerankService } from "./rerank.service.js";

const chunks = [
  { chunkId: 1, documentId: "a", documentName: "A", content: "alpha", score: 0.8 },
  { chunkId: 2, documentId: "b", documentName: "B", content: "beta", score: 0.2 },
  { chunkId: 3, documentId: "c", documentName: "C", content: "gamma", score: 0.5 },
];
const context = {
  providerCode: "openai" as const,
  remoteModelId: "rerank-1",
  enabled: true,
};

describe("rerank service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRerankProvider.mockReturnValue({
      endpoint: "https://rerank.example/v1/rerank",
      apiKey: "secret",
      model: "rerank-1",
    });
  });

  it("preserves retrieval order when rerank is disabled", async () => {
    const result = await rerankService.rerankWithProvider(
      { query: "q", chunks },
      { ...context, enabled: false },
    );

    expect(result.chunks.map((chunk) => chunk.chunkId)).toEqual([1, 2, 3]);
    expect(result.execution).toMatchObject({ applied: false, degraded: false, finishReason: "fallback-disabled" });
    expect(mocks.resolveRerankProvider).not.toHaveBeenCalled();
  });

  it("sorts by provider score, applies topN, and normalizes returned scores", async () => {
    vi.spyOn(rerankService, "callOpenAICompatibleRerank").mockResolvedValue([0.2, 0.9, 0.5]);
    const result = await rerankService.rerankWithProvider({ query: "q", chunks, topN: 2 }, context);

    expect(result.chunks.map((chunk) => chunk.chunkId)).toEqual([2, 3]);
    expect(result.rerankScores).toEqual([0.9, 0.5]);
    expect(result.chunks.map((chunk) => chunk.score)).toEqual([1, 0]);
    expect(result.execution.finishReason).toBe("reranked");
  });

  it("degrades to the original stable order when the provider fails", async () => {
    vi.spyOn(rerankService, "callOpenAICompatibleRerank").mockRejectedValue(new Error("provider offline"));
    const result = await rerankService.rerankWithProvider({ query: "q", chunks, topN: 1 }, context);

    expect(result.chunks.map((chunk) => chunk.chunkId)).toEqual([1, 2, 3]);
    expect(result.execution).toMatchObject({
      applied: false,
      degraded: true,
      finishReason: "fallback-provider-call-failed",
      error: { type: "Error", message: "provider offline" },
    });
  });

  it("maps sparse Cohere result indexes back to candidate order", async () => {
    mocks.fetchJsonWithTimeout.mockResolvedValue({
      results: [{ index: 2, relevance_score: 0.91 }, { index: 0, relevance_score: 0.4 }],
    });
    const scores = await rerankService.callCohereRerank(
      { provider: "cohere", endpoint: "", apiKey: "key" },
      "q",
      chunks,
    );

    expect(scores).toEqual([0.4, 0, 0.91]);
    expect(mocks.fetchJsonWithTimeout).toHaveBeenCalledWith(
      "https://api.cohere.ai/v1/rerank",
      expect.objectContaining({ method: "POST" }),
      30_000,
    );
  });

  it("does not contact an external provider for an empty candidate set", async () => {
    const result = await rerankService.callExternalRerank(
      { provider: "jina", endpoint: "https://jina.example" },
      "q",
      [],
    );
    expect(result).toEqual([]);
    expect(mocks.fetchJsonWithTimeout).not.toHaveBeenCalled();
  });
});
