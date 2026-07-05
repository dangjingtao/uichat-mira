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

  it("scores late registry tools before applying the maxTools cutoff", async () => {
    for (let index = 0; index < 10; index += 1) {
      registerCapability({
        definition: {
          id: `noise_tool_${index}`,
          title: `Noise Tool ${index}`,
          description: "irrelevant helper",
          domain: "read",
          source: "internal",
          mode: "sync",
          inputSchema: {},
          tags: ["noise"],
          capabilities: {
            sideEffect: "none",
            requiresApproval: false,
          },
        },
        execute() {
          return {};
        },
      });
    }

    registerCapability({
      definition: {
        id: "tail_target_tool",
        title: "Tail Target Tool",
        description: "the relevant tool registered last",
        domain: "read",
        source: "internal",
        mode: "sync",
        inputSchema: {},
        tags: ["target"],
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
        [1, 0],
        ...Array.from({ length: 10 }, () => [0, 1]),
        [1, 0],
      ],
    });
    vi.spyOn(rerank, "executeLocalRerank").mockResolvedValue({
      rerankedCandidates: [
        {
          id: "tail_target_tool",
          text: "Tail Target Tool",
          score: 1,
          probability: 0.97,
          rank: 1,
        },
        ...Array.from({ length: 10 }, (_, index) => ({
          id: `noise_tool_${index}`,
          text: `Noise Tool ${index}`,
          score: 0.1,
          probability: 0.05,
          rank: index + 2,
        })),
      ],
      rerankModel: "test-rerank",
      rerankModelConfigId: "test-rerank-config",
    });

    const result = await resolveHarnessToolCandidatesForTurn({
      query: "target",
      source: "agent_intent",
      maxTools: 3,
      topK: 20,
      minScore: 0,
    });

    expect(result.toolCandidates).toHaveLength(3);
    expect(result.toolCandidates[0]).toMatchObject({
      toolId: "tail_target_tool",
      preferredForQuery: true,
    });
    expect(result.toolExposure.exposedToolIds).toContain("tail_target_tool");
    expect(result.toolExposure.exposedToolIds).not.toEqual([
      "noise_tool_0",
      "noise_tool_1",
      "noise_tool_2",
    ]);
  });
});
