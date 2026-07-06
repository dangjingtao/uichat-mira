import { describe, expect, it } from "vitest";
import { BUILT_IN_LOCAL_MODELS, getBuiltInLocalModel } from "../localModels";

describe("localModels", () => {
  it("BUILT_IN_LOCAL_MODELS 包含 embedding 与 rerank", () => {
    expect(BUILT_IN_LOCAL_MODELS.embedding.role).toBe("embedding");
    expect(BUILT_IN_LOCAL_MODELS.rerank.role).toBe("rerank");
  });

  it("getBuiltInLocalModel 返回对应角色模型", () => {
    const embedding = getBuiltInLocalModel("embedding");
    expect(embedding).toBe(BUILT_IN_LOCAL_MODELS.embedding);
    expect(embedding?.modelId).toBe("multilingual-e5-small");

    const rerank = getBuiltInLocalModel("rerank");
    expect(rerank).toBe(BUILT_IN_LOCAL_MODELS.rerank);
    expect(rerank?.optional).toBe(true);
  });

  it("getBuiltInLocalModel 对非本地角色返回 null", () => {
    expect(getBuiltInLocalModel("llm")).toBeNull();
    expect(getBuiltInLocalModel("task")).toBeNull();
  });
});
