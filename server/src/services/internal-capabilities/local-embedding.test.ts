import { beforeEach, describe, expect, it, vi } from "vitest";
import { localEmbeddingSharedNode } from "@/services/shared-nodes/local-embedding.node.js";
import { executeLocalEmbedding } from "./local-embedding.js";

describe("executeLocalEmbedding", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("wraps local embedding shared node for single text input", async () => {
    const runNodeSpy = vi.spyOn(localEmbeddingSharedNode, "runNode").mockResolvedValue({
      state: {
        embeddings: [[0.1, 0.2]],
        embedding: [0.1, 0.2],
        embeddingDimensions: 2,
        embeddingModel: "Xenova/multilingual-e5-small",
        embeddingModelConfigId: "local:multilingual-e5-small",
      },
      observation: {
        type: "model_call",
        label: "本地向量化",
      },
    } as never);

    const result = await executeLocalEmbedding({
      text: "hello world",
    });

    expect(runNodeSpy).toHaveBeenCalledWith({
      state: {
        embeddingTexts: ["hello world"],
      },
    });
    expect(result).toMatchObject({
      embeddings: [[0.1, 0.2]],
      embedding: [0.1, 0.2],
      embeddingDimensions: 2,
      embeddingModel: "Xenova/multilingual-e5-small",
      embeddingModelConfigId: "local:multilingual-e5-small",
      observation: {
        label: "本地向量化",
      },
    });
  });

  it("rejects empty embedding input", async () => {
    await expect(executeLocalEmbedding({})).rejects.toThrow("text or texts is required");
  });
});
