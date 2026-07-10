import { beforeEach, describe, expect, it, vi } from "vitest";
import * as embedding from "@/services/internal-capabilities/local-embedding.js";
import * as rerank from "@/services/internal-capabilities/local-rerank.js";
import { clearHarnessRegistry, registerCapability } from "./registry.js";
import { resolveHarnessCapabilityDiagnostics } from "./capability-diagnostics.js";
import { readOpenTool } from "../mcp/tools/read-open.tool.js";
import { webSearchTool } from "../mcp/tools/web-search.tool.js";
import { terminalSessionTool } from "../mcp/tools/terminal-session.tool.js";

const externalFakeTool = {
  definition: {
    id: "external_fake_tool",
    title: "External Fake Tool",
    description: "Use an external MCP system.",
    domain: "external_mcp" as const,
    source: "external" as const,
    mode: "sync" as const,
    inputSchema: {},
    tags: ["external", "system", "use"],
    capabilities: {
      sideEffect: "network" as const,
      requiresApproval: false,
    },
  },
  execute() {
    return {};
  },
};

const mockRecallOrder = (preferredCapabilityIds: string[] = []) => {
  vi.spyOn(embedding, "executeLocalEmbedding").mockRejectedValue(
    new Error("LOCAL_MODEL_RAW_ROOT is not set."),
  );
  vi.spyOn(rerank, "executeLocalRerank").mockImplementation(async ({ candidates }) => {
    const scored = candidates
      .map((candidate) => {
        const orderIndex = preferredCapabilityIds.indexOf(candidate.id);
        return {
          id: candidate.id,
          text: candidate.text,
          score: orderIndex === -1 ? 0.1 : 1 - orderIndex * 0.1,
          probability: orderIndex === -1 ? 0.1 : 0.95 - orderIndex * 0.1,
          rank: orderIndex === -1 ? preferredCapabilityIds.length + 1 : orderIndex + 1,
        };
      })
      .sort((left, right) => right.probability - left.probability);

    return {
      rerankedCandidates: scored,
      rerankModel: "test-rerank",
      rerankModelConfigId: "test-rerank-config",
    };
  });
};

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

    expect(result).not.toHaveProperty("selectedToolIds");
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]).toMatchObject({
      toolId: "read_list",
      actionProfileId: "read_locate",
    });
    expect(result.candidates[1]).toMatchObject({
      toolId: "read_locate",
      actionProfileId: "read_locate",
    });
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
    expect(result.retrievalModel).toBeUndefined();
    expect(result.rerankModel).toBeUndefined();
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
    expect(result.retrievalModel).toBeUndefined();
    expect(result.retrievalError).toBeUndefined();
    expect(result.exposureReasons).toContain(
      "All eligible tools are exposed because the eligible set is at most 20 tools.",
    );
    expect(rerankSpy).not.toHaveBeenCalled();
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
      query: "run pnpm check",
      source: "agent_intent",
      sandboxProfiles: { command: true },
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

  it("keeps exposure reasons, blocked ids, and candidate scores for workspace-local diagnostics", async () => {
    registerCapability({
      definition: {
        id: "read_open",
        title: "Read Open",
        description: "open workspace file",
        domain: "read",
        source: "internal",
        mode: "sync",
        inputSchema: {},
        tags: ["workspace", "open", "readme"],
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
        id: "web_search",
        title: "Web Search",
        description: "search the public web",
        domain: "web_search",
        source: "internal",
        mode: "sync",
        inputSchema: {},
        tags: ["web", "search", "latest"],
        capabilities: {
          sideEffect: "network",
          requiresApproval: false,
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
        [1, 0],
        [1, 0],
      ],
    });
    vi.spyOn(rerank, "executeLocalRerank").mockResolvedValue({
      rerankedCandidates: [
        {
          id: "workspace_lookup",
          text: "Workspace Lookup",
          score: 1,
          probability: 0.88,
          rank: 1,
        },
      ],
      rerankModel: "test-rerank",
      rerankModelConfigId: "test-rerank-config",
    });

    const result = await resolveHarnessCapabilityDiagnostics({
      query: "请打开 README.md 看看 Runtime 部分",
      source: "agent_intent",
    });

    expect(result.toolExposure.exposedToolIds).toEqual(["read_open", "web_search"]);
    expect(result.blockedCapabilityIds).not.toContain("web_search");
    expect(result.exposureReasons).toContain(
      "All eligible tools are exposed because the eligible set is at most 20 tools.",
    );
    expect(result.toolCandidates[0]).toMatchObject({
      toolId: "read_open",
    });
    expect(result.toolCandidates[0]?.finalScore).toBe(0);
  });

  it.each([
    {
       label: "workspace-local README query keeps all eligible tools visible",
      query: "请打开 README.md 看看 Runtime 部分",
      source: "agent_intent" as const,
      tools: [readOpenTool, webSearchTool, externalFakeTool],
      rerankOrder: ["read_open"],
       expectedExposedToolIds: ["read_open", "web_search"],
       expectedBlockedCapabilityIds: ["external_fake_tool"],
       expectedReason: "All eligible tools are exposed because the eligible set is at most 20 tools.",
      expectedTopToolId: "read_open",
       expectedPreferredToolId: undefined,
    },
    {
      label: "chat surface keeps safe built-in domains only",
      query: "今天最新新闻是什么",
      source: "chat_surface" as const,
      tools: [readOpenTool, webSearchTool, terminalSessionTool, externalFakeTool],
      rerankOrder: ["web_research", "read_open"],
       expectedExposedToolIds: ["read_open", "web_search"],
      expectedBlockedCapabilityIds: ["terminal_session", "external_fake_tool"],
      expectedReason: "Chat-visible tool surface is restricted to safe built-in domains.",
       expectedTopToolId: "read_open",
       expectedPreferredToolId: undefined,
    },
    {
      label: "non-command turn keeps terminal hidden in diagnostics",
      query: "帮我总结 README.md",
      source: "agent_intent" as const,
      tools: [terminalSessionTool, externalFakeTool],
      rerankOrder: [],
       expectedExposedToolIds: ["terminal_session"],
       expectedBlockedCapabilityIds: ["external_fake_tool"],
       expectedReason: "All eligible tools are exposed because the eligible set is at most 20 tools.",
       expectedTopToolId: "terminal_session",
      expectedPreferredToolId: undefined,
    },
    {
      label: "allowExternal propagates to diagnostics",
      query: "use external system",
      source: "agent_intent" as const,
      tools: [externalFakeTool],
      allowExternal: true,
      rerankOrder: ["external_fake_tool"],
      expectedExposedToolIds: ["external_fake_tool"],
      expectedBlockedCapabilityIds: [],
      expectedReason: undefined,
      expectedTopToolId: "external_fake_tool",
       expectedPreferredToolId: undefined,
    },
    {
      label: "sandbox-unavailable command keeps terminal blocked",
      query: "run pnpm check",
      source: "agent_intent" as const,
      tools: [terminalSessionTool, externalFakeTool],
      sandboxProfiles: { command: false },
      rerankOrder: [],
      expectedExposedToolIds: [],
      expectedBlockedCapabilityIds: ["terminal_session", "external_fake_tool"],
      expectedReason: "Sandbox-required tools are hidden when their sandbox profile is unavailable.",
      expectedTopToolId: undefined,
      expectedPreferredToolId: undefined,
    },
  ])(
    "mirrors the exposure regression pack in diagnostics: $label",
    async ({
      query,
      source,
      tools,
      allowExternal,
      sandboxProfiles,
      rerankOrder,
      expectedExposedToolIds,
      expectedBlockedCapabilityIds,
      expectedReason,
      expectedTopToolId,
      expectedPreferredToolId,
    }) => {
      for (const tool of tools) {
        registerCapability(tool);
      }
      mockRecallOrder(rerankOrder);

      const result = await resolveHarnessCapabilityDiagnostics({
        query,
        source,
        allowExternal,
        sandboxProfiles,
      });

      expect(result.toolExposure.exposedToolIds).toEqual(expectedExposedToolIds);
      expect(result.blockedCapabilityIds).toEqual(expect.arrayContaining(expectedBlockedCapabilityIds));
      if (expectedReason) {
        expect(result.exposureReasons).toContain(expectedReason);
      }
      expect(result.toolCandidates[0]?.toolId).toBe(expectedTopToolId);
      expect(result.toolCandidates.every((candidate) => !("preferredForQuery" in candidate))).toBe(true);
    },
  );
});
