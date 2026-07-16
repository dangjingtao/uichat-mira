import { describe, expect, it, vi } from "vitest";
import { fuseRetrievalCandidates, rerankRetrievalCandidates } from "./hybrid-retrieval.js";

const rerankMock = vi.hoisted(() => ({ executeLocalRerank: vi.fn() }));
vi.mock("@/services/internal-capabilities/local-rerank.js", () => rerankMock);

const candidate = (id: string, score: number) => ({
  id,
  title: id,
  content: `${id} content`,
  metadata: { sourceKey: "test" },
  score,
});

describe("hybrid retrieval", () => {
  it("fuses keyword and vector candidates and removes duplicates", () => {
    const result = fuseRetrievalCandidates({
      keywordCandidates: [candidate("same", 5), candidate("keyword-only", 2)],
      vectorCandidates: [candidate("same", 0.9), candidate("vector-only", 0.8)],
      maxResults: 10,
    });
    expect(result).toHaveLength(3);
    expect(result.find((item) => item.id === "same")?.hitModes).toEqual(["keyword", "vector"]);
  });

  it("keeps fused order when rerank is unavailable", async () => {
    rerankMock.executeLocalRerank.mockRejectedValue(new Error("model unavailable"));
    const result = await rerankRetrievalCandidates({
      query: "query",
      candidates: [candidate("first", 0.8), candidate("second", 0.7)],
      maxResults: 2,
    });
    expect(result.status).toBe("unavailable");
    expect(result.candidates.map((item) => item.id)).toEqual(["first", "second"]);
  });

  it("treats an empty rerank response as unavailable", async () => {
    rerankMock.executeLocalRerank.mockResolvedValue({ rerankedCandidates: [] });
    const result = await rerankRetrievalCandidates({
      query: "query",
      candidates: [candidate("first", 0.8)],
      maxResults: 1,
    });
    expect(result.status).toBe("unavailable");
    expect(result.candidates[0]?.hitModes).toBeUndefined();
  });
});
