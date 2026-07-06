import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/request", () => ({
  post: vi.fn(),
}));

import { post } from "@/shared/lib/request";
import { retrieveRagSources, type RagRetrievedChunk } from "../chatRag";

const sampleChunks: RagRetrievedChunk[] = [
  {
    chunkId: 1,
    documentId: "doc-1",
    documentName: "doc.txt",
    content: "hello",
    score: 0.9,
    matchType: "hybrid",
    hitModes: ["vector"],
  },
];

describe("chatRag api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retrieveRagSources 提交问题并返回检索块", async () => {
    vi.mocked(post).mockResolvedValueOnce(sampleChunks);

    const result = await retrieveRagSources({
      question: "hello",
      knowledgeBaseId: "kb-1",
      topK: 5,
      topN: 3,
    });

    expect(post).toHaveBeenCalledWith("/chat/rag/retrieve", {
      question: "hello",
      knowledgeBaseId: "kb-1",
      topK: 5,
      topN: 3,
    });
    expect(result).toBe(sampleChunks);
  });
});
