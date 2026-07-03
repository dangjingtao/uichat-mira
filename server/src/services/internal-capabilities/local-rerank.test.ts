import { beforeEach, describe, expect, it, vi } from "vitest";
import { localRerankSharedNode } from "@/services/shared-nodes/local-rerank.node.js";
import { executeLocalRerank } from "./local-rerank.js";

describe("executeLocalRerank", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("wraps local rerank shared node", async () => {
    const runNodeSpy = vi.spyOn(localRerankSharedNode, "runNode").mockResolvedValue({
      state: {
        rerankedCandidates: [
          {
            id: "c1",
            text: "Alpha",
            score: 1.2,
            probability: 0.7,
            rank: 1,
          },
        ],
        rerankModel: "Xenova/ms-marco-MiniLM-L-6-v2",
        rerankModelConfigId: "local:ms-marco-MiniLM-L-6-v2",
      },
      observation: {
        type: "model_call",
        label: "本地重排序",
      },
    } as never);

    const result = await executeLocalRerank({
      query: "alpha query",
      topN: 1,
      candidates: [
        {
          id: "c1",
          text: "Alpha",
        },
        {
          id: "c2",
          text: "Beta",
        },
      ],
    });

    expect(runNodeSpy).toHaveBeenCalledWith({
      state: {
        rerankQuery: "alpha query",
        rerankCandidates: [
          {
            id: "c1",
            text: "Alpha",
          },
          {
            id: "c2",
            text: "Beta",
          },
        ],
      },
      topN: 1,
    });
    expect(result).toMatchObject({
      rerankedCandidates: [
        {
          id: "c1",
          text: "Alpha",
          score: 1.2,
          probability: 0.7,
          rank: 1,
        },
      ],
      rerankModel: "Xenova/ms-marco-MiniLM-L-6-v2",
      rerankModelConfigId: "local:ms-marco-MiniLM-L-6-v2",
      observation: {
        label: "本地重排序",
      },
    });
  });

  it("rejects rerank input without query", async () => {
    await expect(
      executeLocalRerank({
        candidates: [{ text: "Alpha" }],
      }),
    ).rejects.toThrow("query is required");
  });
});
