import { beforeEach, describe, expect, it, vi } from "vitest";
import * as embedding from "@/services/internal-capabilities/local-embedding.js";
import * as rerank from "@/services/internal-capabilities/local-rerank.js";
import { clearHarnessRegistry, registerCapability } from "./registry.js";
import { resolveHarnessToolCandidatesForTurn } from "./tool-candidates.js";

describe("resolveHarnessToolCandidatesForTurn", () => {
  beforeEach(() => {
    clearHarnessRegistry();
    vi.restoreAllMocks();
  });

  it("returns tool candidates and exposed tool ids without invocation payloads", async () => {
    registerCapability({
      definition: {
        id: "read_list",
        title: "Read List",
        description: "list workspace",
        domain: "read",
        source: "internal",
        mode: "sync",
        inputSchema: {},
        tags: ["workspace", "list"],
        capabilities: {
          sideEffect: "none",
          requiresApproval: false,
        },
      },
      execute() {
        return {};
      },
    });
    registerCapability({
      definition: {
        id: "read_locate",
        title: "Read Locate",
        description: "locate workspace files",
        domain: "read",
        source: "internal",
        mode: "sync",
        inputSchema: {},
        tags: ["workspace", "locate"],
        capabilities: {
          sideEffect: "none",
          requiresApproval: false,
        },
      },
      execute() {
        return {};
      },
    });

    vi.spyOn(embedding, "executeLocalEmbedding").mockResolvedValue({
      embeddingModel: "test-embedding",
      embeddingModelConfigId: "test-embedding-config",
      embeddings: [
        [1, 0, 0],
        [0.9, 0.1, 0],
      ],
    });
    vi.spyOn(rerank, "executeLocalRerank").mockResolvedValue({
      rerankedCandidates: [
        {
          id: "workspace_lookup",
          text: "Workspace Lookup",
          score: 1,
          probability: 0.74,
          rank: 1,
        },
      ],
      rerankModel: "test-rerank",
      rerankModelConfigId: "test-rerank-config",
    });

    const result = await resolveHarnessToolCandidatesForTurn({
      query: "帮我找一下文件",
      source: "agent_intent",
      maxTools: 8,
    });

    expect(result.toolCandidates).toEqual([
      expect.objectContaining({
        toolId: "read_list",
        actionProfileId: "read_locate",
      }),
      expect.objectContaining({
        toolId: "read_locate",
        actionProfileId: "read_locate",
        preferredForQuery: true,
      }),
    ]);
    expect(result.toolExposure.exposedToolIds).toEqual(["read_list", "read_locate"]);
    expect(result).not.toHaveProperty("pendingToolCall");
  });
});
