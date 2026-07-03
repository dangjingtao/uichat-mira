import { afterEach, describe, expect, it, vi } from "vitest";
import { localModelRuntime } from "@/services/local-model-runtime/index.js";
import { localEmbeddingSharedNode } from "./local-embedding.node.js";
import { localRerankSharedNode } from "./local-rerank.node.js";

describe("local model shared nodes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps local embedding output into a LangGraph-style partial state", async () => {
    vi.spyOn(localModelRuntime, "embedTexts").mockResolvedValue({
      embeddings: [[0.1, 0.2, 0.3]],
      dimensions: 3,
      model: "Xenova/multilingual-e5-small",
      modelConfigId: "local:multilingual-e5-small",
      providerCode: "local",
      runtime: "onnxruntime-web/wasm",
    });

    const patch = await localEmbeddingSharedNode.runGraphNode({
      state: {
        embeddingText: "hello",
      },
    });

    expect(patch).toMatchObject({
      embedding: [0.1, 0.2, 0.3],
      embeddings: [[0.1, 0.2, 0.3]],
      embeddingDimensions: 3,
      embeddingModel: "Xenova/multilingual-e5-small",
      embeddingModelConfigId: "local:multilingual-e5-small",
    });
  });

  it("supports custom embedding state selectors and mappers", async () => {
    vi.spyOn(localModelRuntime, "embedTexts").mockResolvedValue({
      embeddings: [[1], [2]],
      dimensions: 1,
      model: "Xenova/multilingual-e5-small",
      modelConfigId: "local:multilingual-e5-small",
      providerCode: "local",
      runtime: "onnxruntime-web/wasm",
    });

    const patch = await localEmbeddingSharedNode.runGraphNode({
      state: {
        question: "q",
        documents: ["a", "b"],
      },
      selectTexts: (state) => [state.question, ...state.documents],
      mapResult: (_state, result) => ({
        vectors: result.embeddings,
      }),
    });

    expect(patch).toEqual({
      vectors: [[1], [2]],
    });
  });

  it("maps local rerank output into a LangGraph-style partial state", async () => {
    vi.spyOn(localModelRuntime, "rerank").mockResolvedValue({
      candidates: [
        {
          id: "a",
          text: "relevant",
          score: 2,
          probability: 0.88,
          rank: 1,
        },
      ],
      model: "Xenova/ms-marco-MiniLM-L-6-v2",
      modelConfigId: "local:ms-marco-MiniLM-L-6-v2",
      providerCode: "local",
      runtime: "onnxruntime-web/wasm",
    });

    const patch = await localRerankSharedNode.runGraphNode({
      state: {
        rerankQuery: "query",
        rerankCandidates: [
          {
            id: "a",
            text: "relevant",
          },
        ],
      },
      topN: 1,
    });

    expect(patch).toMatchObject({
      rerankedCandidates: [
        {
          id: "a",
          score: 2,
          rank: 1,
        },
      ],
      rerankModel: "Xenova/ms-marco-MiniLM-L-6-v2",
      rerankModelConfigId: "local:ms-marco-MiniLM-L-6-v2",
    });
  });

  it("creates observed node results for execution traces", async () => {
    vi.spyOn(localModelRuntime, "rerank").mockResolvedValue({
      candidates: [],
      model: "Xenova/ms-marco-MiniLM-L-6-v2",
      modelConfigId: "local:ms-marco-MiniLM-L-6-v2",
      providerCode: "local",
      runtime: "onnxruntime-web/wasm",
    });

    const result = await localRerankSharedNode.runNode({
      state: {
        rerankQuery: "query",
        rerankCandidates: [],
      },
    });

    expect(result.state).toEqual({
      rerankedCandidates: [],
      rerankModel: "Xenova/ms-marco-MiniLM-L-6-v2",
      rerankModelConfigId: "local:ms-marco-MiniLM-L-6-v2",
    });
    expect(result.observation.environment?.model?.operation).toBe("local-rerank");
    expect(result.observation.environment?.model?.protocol).toBe(
      "onnxruntime-web/wasm",
    );
  });
});
