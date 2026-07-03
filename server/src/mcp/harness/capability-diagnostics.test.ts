import { beforeEach, describe, expect, it, vi } from "vitest";
import * as embedding from "@/services/internal-capabilities/local-embedding.js";
import * as rerank from "@/services/internal-capabilities/local-rerank.js";
import { clearHarnessRegistry, registerCapability } from "./registry.js";
import { resolveHarnessCapabilityDiagnostics } from "./capability-diagnostics.js";

describe("resolveHarnessCapabilityDiagnostics", () => {
  beforeEach(() => {
    clearHarnessRegistry();
    vi.restoreAllMocks();
  });

  it("returns tool diagnostics with grouped tool meta and scores", async () => {
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
      embeddingModel: "Xenova/multilingual-e5-small",
      embeddingModelConfigId: "local:multilingual-e5-small",
      embeddings: [
        [1, 0, 0],
        [0.95, 0.05, 0],
      ],
    });
    vi.spyOn(rerank, "executeLocalRerank").mockResolvedValue({
      rerankedCandidates: [
        {
          id: "workspace_lookup",
          text: "Workspace Lookup",
          score: 1.2,
          probability: 0.73,
          rank: 1,
        },
      ],
      rerankModel: "Xenova/ms-marco-MiniLM-L-6-v2",
      rerankModelConfigId: "local:ms-marco-MiniLM-L-6-v2",
    });

    const result = await resolveHarnessCapabilityDiagnostics({
      query: "帮我找一下文件",
      source: "agent_intent",
    });

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]).toMatchObject({
      toolId: "read_list",
      actionProfileId: "read_locate",
    });
    expect(result.candidates[1]).toMatchObject({
      toolId: "read_locate",
      actionProfileId: "read_locate",
    });
    expect(result.selectedToolIds).toEqual(["read_list"]);
    expect(result.toolCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toolId: "read_list",
          actionProfileId: "read_locate",
        }),
        expect.objectContaining({
          toolId: "read_locate",
          actionProfileId: "read_locate",
        }),
      ]),
    );
    expect(result.retrievalModel).toMatchObject({
      provider: "local",
      model: "Xenova/multilingual-e5-small",
    });
    expect(result.rerankModel).toMatchObject({
      model: "Xenova/ms-marco-MiniLM-L-6-v2",
    });
  });

  it("keeps rule-based workspace candidates when local embedding is unavailable", async () => {
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

    vi.spyOn(embedding, "executeLocalEmbedding").mockRejectedValue(
      new Error("LOCAL_MODEL_RAW_ROOT is not set."),
    );
    const rerankSpy = vi.spyOn(rerank, "executeLocalRerank").mockResolvedValue({
      rerankedCandidates: [
        {
          id: "workspace_lookup",
          text: "Workspace Lookup",
          score: 1,
          probability: 0.61,
          rank: 1,
        },
      ],
      rerankModel: "Xenova/ms-marco-MiniLM-L-6-v2",
      rerankModelConfigId: "local:ms-marco-MiniLM-L-6-v2",
    });

    const result = await resolveHarnessCapabilityDiagnostics({
      query: "帮我看看文件夹下有啥",
      source: "agent_intent",
    });

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]).toMatchObject({
      toolId: "read_list",
      actionProfileId: "read_locate",
    });
    expect(result.candidates[1]).toMatchObject({
      toolId: "read_locate",
      actionProfileId: "read_locate",
    });
    expect(result.selectedToolIds).toEqual(["read_list"]);
    expect(result.retrievalModel).toBeUndefined();
    expect(result.retrievalError).toBe("LOCAL_MODEL_RAW_ROOT is not set.");
    expect(result.exposureReasons).toContain(
      "Local embedding capability is unavailable for intent recall: LOCAL_MODEL_RAW_ROOT is not set.",
    );
    expect(rerankSpy).toHaveBeenCalledTimes(1);
  });

  it("returns action profile metadata for terminal capability diagnostics", async () => {
    registerCapability({
      definition: {
        id: "terminal_session",
        title: "Terminal Session",
        description: "terminal",
        domain: "terminal",
        source: "internal",
        mode: "stream",
        inputSchema: {},
        tags: ["terminal"],
        capabilities: {
          sideEffect: "process",
          requiresApproval: true,
        },
      },
      execute() {
        return {};
      },
    });

    vi.spyOn(embedding, "executeLocalEmbedding").mockResolvedValue({
      embeddingModel: "test",
      embeddingModelConfigId: "test-config",
      embeddings: [
        [1, 0, 0],
        [0.9, 0.1, 0],
      ],
    });
    vi.spyOn(rerank, "executeLocalRerank").mockResolvedValue({
      rerankedCandidates: [
        {
          id: "terminal_execution",
          text: "Terminal Execution",
          score: 1,
          probability: 0.8,
          rank: 1,
        },
      ],
      rerankModel: "test-rerank",
      rerankModelConfigId: "test-rerank-config",
    });

    const result = await resolveHarnessCapabilityDiagnostics({
      query: "run a terminal command",
      source: "agent_intent",
    });

    expect(result.profiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capabilityId: "terminal_execution",
          actionProfileId: "terminal_execute_command",
          preferredToolId: "terminal_session",
        }),
      ]),
    );
    expect(result.candidates[0]).toMatchObject({
      toolId: "terminal_session",
      actionProfileId: "terminal_execute_command",
    });
  });
});
