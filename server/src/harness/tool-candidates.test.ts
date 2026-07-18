import { beforeEach, describe, expect, it, vi } from "vitest";
import * as embedding from "@/services/internal-capabilities/local-embedding.js";
import * as rerank from "@/services/internal-capabilities/local-rerank.js";
import { clearHarnessRegistry, registerCapability } from "./registry.js";
import { resolveHarnessToolCandidatesForTurn } from "./tool-candidates.js";
import { readOpenTool } from "../mcp/tools/read-open.tool.js";
import { readDiscoverTool } from "../mcp/tools/read-discover.tool.js";
import { readTool } from "../mcp/tools/read.tool.js";
import { readSliceTool } from "../mcp/tools/read-slice.tool.js";
import { webSearchTool } from "../mcp/tools/web-search.tool.js";
import { terminalSessionTool } from "../mcp/tools/terminal-session.tool.js";

const EXTERNAL_HIDDEN_REASON =
  "External MCP capabilities are hidden unless explicitly enabled.";
const CHAT_SAFE_DOMAIN_REASON =
  "Chat-visible tool surface is restricted to safe built-in domains.";

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

const registerTools = (
  tools: Array<{ definition: { id: string } } & Record<string, unknown>>,
) => {
  for (const tool of tools) {
    registerCapability(tool as never);
  }
};

const mockRecallOrder = (preferredCapabilityIds: string[] = []) => {
  vi.spyOn(embedding, "executeLocalEmbedding").mockRejectedValue(
    new Error("LOCAL_MODEL_RAW_ROOT is not set."),
  );
  vi.spyOn(rerank, "executeLocalRerank").mockImplementation(
    async ({ candidates }) => {
      const scored = candidates
        .map((candidate) => {
          const orderIndex = preferredCapabilityIds.indexOf(candidate.id);
          return {
            id: candidate.id,
            text: candidate.text,
            score: orderIndex === -1 ? 0.1 : 1 - orderIndex * 0.1,
            probability:
              orderIndex === -1 ? 0.1 : 0.95 - orderIndex * 0.1,
            rank:
              orderIndex === -1
                ? preferredCapabilityIds.length + 1
                : orderIndex + 1,
          };
        })
        .sort((left, right) => right.probability - left.probability);

      return {
        rerankedCandidates: scored,
        rerankModel: "test-rerank",
        rerankModelConfigId: "test-rerank-config",
      };
    },
  );
};

const createEligibleTool = (id: string) => ({
  definition: {
    id,
    title: id,
    description: "eligible test tool",
    domain: "read",
    source: "internal" as const,
    mode: "sync" as const,
    inputSchema: { type: "object" },
    tags: [] as string[],
    capabilities: {
      sideEffect: "none" as const,
      requiresApproval: false,
    },
  },
  execute() {
    return {};
  },
});

describe("resolveHarnessToolCandidatesForTurn", () => {
  beforeEach(() => {
    clearHarnessRegistry();
    vi.restoreAllMocks();
  });

  it("returns candidates and exposed tool ids without invocation payloads", async () => {
    registerTools([readDiscoverTool, readOpenTool]);
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
      expect.objectContaining({ toolId: "read_discover" }),
      expect.objectContaining({ toolId: "read_open" }),
    ]);
    expect(result.toolExposure.exposedToolIds).toEqual([
      "read_discover",
      "read_open",
    ]);
    expect(result).not.toHaveProperty("pendingToolCall");
  });

  it("scores late registry tools before applying the maxTools cutoff", async () => {
    for (let index = 0; index < 20; index += 1) {
      registerCapability(createEligibleTool(`noise_tool_${index}`));
    }
    registerCapability(createEligibleTool("tail_target_tool"));

    vi.spyOn(embedding, "executeLocalEmbedding").mockResolvedValue({
      embeddingModel: "test-embedding",
      embeddingModelConfigId: "test-embedding-config",
      embeddings: [
        [1, 0],
        ...Array.from({ length: 20 }, () => [0, 1]),
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
        ...Array.from({ length: 20 }, (_, index) => ({
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
      topK: 20,
      minScore: 0,
    });

    expect(result.toolCandidates).toHaveLength(20);
    expect(result.toolCandidates[0]).toMatchObject({
      toolId: "tail_target_tool",
    });
    expect(result.toolExposure.exposedToolIds).toHaveLength(20);
    expect(result.toolExposure.exposedToolIds).toContain("tail_target_tool");
  });

  it.each([0, 1, 20])(
    "exposes every eligible tool and skips recall for %s tools",
    async (count) => {
      for (let index = 0; index < count; index += 1) {
        registerCapability(createEligibleTool(`eligible_tool_${index}`));
      }

      const embeddingSpy = vi
        .spyOn(embedding, "executeLocalEmbedding")
        .mockRejectedValue(new Error("recall must not run"));
      const result = await resolveHarnessToolCandidatesForTurn({
        query: "你好",
        source: "agent_intent",
        maxTools: 1,
        topK: 1,
      });

      expect(embeddingSpy).not.toHaveBeenCalled();
      expect(result.toolExposure.exposedToolIds).toHaveLength(count);
      expect(result.toolCandidates).toHaveLength(count);
      expect(result).not.toHaveProperty("selectedToolIds");
    },
  );

  it.each([21, 50])(
    "preserves all eligible tools on recall failure above 20 tools: %s",
    async (count) => {
      for (let index = 0; index < count; index += 1) {
        registerCapability(createEligibleTool(`large_set_tool_${index}`));
      }

      const embeddingSpy = vi
        .spyOn(embedding, "executeLocalEmbedding")
        .mockRejectedValue(new Error("embedding unavailable"));
      const result = await resolveHarnessToolCandidatesForTurn({
        query: "没有关键词也不能隐藏工具",
        source: "agent_intent",
        maxTools: 1,
        topK: 1,
      });

      expect(embeddingSpy).toHaveBeenCalledOnce();
      expect(result.toolExposure.exposedToolIds).toHaveLength(count);
      expect(result.toolCandidates).toHaveLength(count);
      expect(result.retrievalError).toBe("embedding unavailable");
      expect(result.toolExposure.reason).toContain(
        "Candidate recall failed; all eligible tools remain visible as the conservative fallback.",
      );
    },
  );

  it("falls back to all eligible tools when recall has no threshold matches", async () => {
    const count = 21;
    for (let index = 0; index < count; index += 1) {
      registerCapability(createEligibleTool(`no_match_tool_${index}`));
    }

    vi.spyOn(embedding, "executeLocalEmbedding").mockResolvedValue({
      embeddingModel: "test-embedding",
      embeddingModelConfigId: "test-embedding-config",
      embeddings: Array.from({ length: count + 1 }, (_, index) =>
        index === 0 ? [0, 1] : [1, 0],
      ),
    });

    const result = await resolveHarnessToolCandidatesForTurn({
      query: "no semantic match",
      source: "agent_intent",
      minScore: 0.15,
    });

    expect(result.toolExposure.exposedToolIds).toHaveLength(count);
    expect(result.toolCandidates).toHaveLength(count);
    expect(result.toolExposure.reason).toContain(
      "Candidate recall returned no matches above the score threshold; all eligible tools remain visible as the conservative fallback.",
    );
  });

  it("does not use semantic keyword rules to change successful recall exposure", async () => {
    const count = 21;
    for (let index = 0; index < count; index += 1) {
      registerCapability(createEligibleTool(`keyword_neutral_tool_${index}`));
    }

    vi.spyOn(embedding, "executeLocalEmbedding").mockImplementation(
      async ({ texts }) => ({
        embeddingModel: "test-embedding",
        embeddingModelConfigId: "test-embedding-config",
        embeddings: texts.map(() => [1, 0]),
      }),
    );
    vi.spyOn(rerank, "executeLocalRerank").mockResolvedValue({
      rerankedCandidates: [],
      rerankModel: "test-rerank",
      rerankModelConfigId: "test-rerank-config",
    });

    const keywordResult = await resolveHarnessToolCandidatesForTurn({
      query: "workspace web terminal edit",
      source: "agent_intent",
      topK: 20,
    });
    const neutralResult = await resolveHarnessToolCandidatesForTurn({
      query: "unrelated wording",
      source: "agent_intent",
      topK: 20,
    });

    expect(keywordResult.toolExposure.exposedToolIds).toEqual(
      neutralResult.toolExposure.exposedToolIds,
    );
    expect(keywordResult.toolCandidates.map((candidate) => candidate.toolId)).toEqual(
      neutralResult.toolCandidates.map((candidate) => candidate.toolId),
    );
    expect(keywordResult.toolCandidates).toHaveLength(20);
    expect(
      keywordResult.toolCandidates.every((candidate) => candidate.ruleScore === 0),
    ).toBe(true);
  });

  it.each([
    {
      label: "workspace README file content stays local",
      query:
        "README.md 的 Runtime 一节具体列了哪些运行组件？请基于文件内容回答。",
      source: "agent_intent" as const,
      tools: [readOpenTool, webSearchTool, externalFakeTool],
      rerankOrder: ["read_open"],
      expectedExposedToolIds: ["read_open", "web_search"],
      expectedBlockedCapabilityIds: ["external_fake_tool"],
      expectedReasons: [EXTERNAL_HIDDEN_REASON],
      expectedTopToolIds: ["read_open"],
    },
    {
      label: "workspace discovery covers directory listing",
      query: "帮我看看工作区目录里有哪些文件夹",
      source: "agent_intent" as const,
      tools: [readDiscoverTool, externalFakeTool],
      rerankOrder: ["workspace_lookup"],
      expectedExposedToolIds: ["read_discover"],
      expectedBlockedCapabilityIds: ["external_fake_tool"],
      expectedReasons: [EXTERNAL_HIDDEN_REASON],
      expectedTopToolIds: ["read_discover"],
    },
    {
      label: "workspace discovery covers fuzzy lookup",
      query: "帮我找一下 settings 相关文件",
      source: "agent_intent" as const,
      tools: [readDiscoverTool, externalFakeTool],
      rerankOrder: ["workspace_lookup"],
      expectedExposedToolIds: ["read_discover"],
      expectedBlockedCapabilityIds: ["external_fake_tool"],
      expectedReasons: [EXTERNAL_HIDDEN_REASON],
      expectedTopToolIds: ["read_discover"],
    },
    {
      label: "explicit latest-news query keeps web_search",
      query: "请联网搜索今天最新的新闻",
      source: "agent_intent" as const,
      tools: [webSearchTool, externalFakeTool],
      rerankOrder: ["web_research"],
      expectedExposedToolIds: ["web_search"],
      expectedBlockedCapabilityIds: ["external_fake_tool"],
      expectedReasons: [EXTERNAL_HIDDEN_REASON],
      expectedTopToolIds: ["web_search"],
    },
    {
      label: "small talk keeps all eligible built-ins visible",
      query: "谢谢",
      source: "agent_intent" as const,
      tools: [readOpenTool, webSearchTool, terminalSessionTool, externalFakeTool],
      rerankOrder: [],
      expectedExposedToolIds: ["read_open", "web_search", "terminal_session"],
      expectedBlockedCapabilityIds: ["external_fake_tool"],
      expectedReasons: [EXTERNAL_HIDDEN_REASON],
      expectedTopToolIds: ["read_open", "web_search", "terminal_session"],
    },
    {
      label: "read fallback aliases stay hidden for normal agent intent",
      query: "open README.md",
      source: "agent_intent" as const,
      tools: [readTool, readSliceTool, externalFakeTool],
      rerankOrder: [],
      expectedExposedToolIds: [],
      expectedBlockedCapabilityIds: ["read", "read_slice", "external_fake_tool"],
      expectedReasons: [EXTERNAL_HIDDEN_REASON],
      expectedTopToolIds: [],
    },
    {
      label: "chat surface only keeps safe built-in domains",
      query: "今天最新新闻是什么",
      source: "chat_surface" as const,
      tools: [readOpenTool, webSearchTool, terminalSessionTool, externalFakeTool],
      rerankOrder: ["web_research", "read_open"],
      expectedExposedToolIds: ["read_open", "web_search"],
      expectedBlockedCapabilityIds: ["terminal_session", "external_fake_tool"],
      expectedReasons: [CHAT_SAFE_DOMAIN_REASON, EXTERNAL_HIDDEN_REASON],
      expectedTopToolIds: ["read_open", "web_search"],
    },
    {
      label: "explicit terminal command keeps terminal_session",
      query: "run pnpm check",
      source: "agent_intent" as const,
      tools: [terminalSessionTool, externalFakeTool],
      sandboxProfiles: { command: true },
      rerankOrder: ["terminal_execution"],
      expectedExposedToolIds: ["terminal_session"],
      expectedBlockedCapabilityIds: ["external_fake_tool"],
      expectedReasons: [EXTERNAL_HIDDEN_REASON],
      expectedTopToolIds: ["terminal_session"],
    },
    {
      label: "non-command request does not hide terminal_session",
      query: "帮我总结 README.md",
      source: "agent_intent" as const,
      tools: [terminalSessionTool, externalFakeTool],
      rerankOrder: [],
      expectedExposedToolIds: ["terminal_session"],
      expectedBlockedCapabilityIds: ["external_fake_tool"],
      expectedReasons: [EXTERNAL_HIDDEN_REASON],
      expectedTopToolIds: ["terminal_session"],
    },
    {
      label: "external MCP stays hidden by default",
      query: "use external system",
      source: "agent_intent" as const,
      tools: [externalFakeTool],
      rerankOrder: [],
      expectedExposedToolIds: [],
      expectedBlockedCapabilityIds: ["external_fake_tool"],
      expectedReasons: [EXTERNAL_HIDDEN_REASON],
      expectedTopToolIds: [],
    },
    {
      label: "allowExternal exposes external MCP",
      query: "use external system",
      source: "agent_intent" as const,
      tools: [externalFakeTool],
      allowExternal: true,
      allowedExternalToolIds: ["external_fake_tool"],
      rerankOrder: ["external_fake_tool"],
      expectedExposedToolIds: ["external_fake_tool"],
      expectedBlockedCapabilityIds: [],
      expectedReasons: [],
      expectedTopToolIds: ["external_fake_tool"],
    },
    {
      label: "sandbox-unavailable profile does not hide host terminal",
      query: "run pnpm check",
      source: "agent_intent" as const,
      tools: [terminalSessionTool, externalFakeTool],
      sandboxProfiles: { command: false },
      rerankOrder: ["terminal_execution"],
      expectedExposedToolIds: ["terminal_session"],
      expectedBlockedCapabilityIds: ["external_fake_tool"],
      expectedReasons: [EXTERNAL_HIDDEN_REASON],
      expectedTopToolIds: ["terminal_session"],
    },
  ])(
    "keeps the tool-exposure regression pack green: $label",
    async ({
      query,
      source,
      tools,
      allowExternal,
      allowedExternalToolIds,
      sandboxProfiles,
      rerankOrder,
      expectedExposedToolIds,
      expectedBlockedCapabilityIds,
      expectedReasons,
      expectedTopToolIds,
    }) => {
      registerTools(tools);
      mockRecallOrder(rerankOrder);

      const result = await resolveHarnessToolCandidatesForTurn({
        query,
        source,
        allowExternal,
        allowedExternalToolIds,
        sandboxProfiles,
        topK: 8,
        maxTools: 8,
      });

      expect(result.toolExposure.exposedToolIds).toEqual(expectedExposedToolIds);
      expect(result.toolExposure.blockedCapabilityIds).toEqual(
        expect.arrayContaining(expectedBlockedCapabilityIds),
      );
      for (const reason of expectedReasons) {
        expect(result.toolExposure.reason).toContain(reason);
      }
      expect(
        result.toolCandidates
          .slice(0, expectedTopToolIds.length)
          .map((candidate) => candidate.toolId),
      ).toEqual(expectedTopToolIds);
      expect(
        result.toolCandidates.every(
          (candidate) => !("preferredForQuery" in candidate),
        ),
      ).toBe(true);
    },
  );

  it("limits multiple eligible external capabilities by topK and maxTools", async () => {
    const tools = Array.from({ length: 21 }, (_, index) => ({
      definition: {
        id: `mcp:multi-server:tool:search_${index}`,
        title: `Search documentation ${index}`,
        description: "Search product documentation on an external MCP server.",
        domain: "external_mcp" as const,
        source: "external" as const,
        mode: "sync" as const,
        inputSchema: { type: "object" },
        tags: ["docs", "search"],
        capabilities: {
          sideEffect: "network" as const,
          requiresApproval: true,
        },
      },
      execute() {
        return {};
      },
    }));
    tools.forEach(registerCapability);

    vi.spyOn(embedding, "executeLocalEmbedding").mockResolvedValue({
      embeddingModel: "test-embedding",
      embeddingModelConfigId: "test-embedding-config",
      embeddings: Array.from({ length: tools.length + 1 }, () => [1, 0]),
    });
    vi.spyOn(rerank, "executeLocalRerank").mockResolvedValue({
      rerankedCandidates: tools.slice(0, 2).map((tool, index) => ({
        id: tool.definition.id,
        text: tool.definition.title,
        score: 1 - index * 0.1,
        probability: 0.95 - index * 0.1,
        rank: index + 1,
      })),
      rerankModel: "test-rerank",
      rerankModelConfigId: "test-rerank-config",
    });

    const result = await resolveHarnessToolCandidatesForTurn({
      query: "search product documentation",
      source: "agent_intent",
      allowExternal: true,
      allowedExternalToolIds: tools.map((tool) => tool.definition.id),
      topK: 2,
      maxTools: 1,
      minScore: 0,
    });

    expect(result.toolCandidates).toHaveLength(1);
    expect(result.toolCandidates[0]?.source).toBe("external");
  });

  it("keeps a small eligible external set fully exposed regardless of maxTools", async () => {
    const tools = Array.from({ length: 3 }, (_, index) => ({
      definition: {
        id: `mcp:small-server:tool:search_${index}`,
        title: `Small search ${index}`,
        description: "Search product documentation.",
        domain: "external_mcp" as const,
        source: "external" as const,
        mode: "sync" as const,
        inputSchema: { type: "object" },
        tags: ["docs"],
        capabilities: {
          sideEffect: "network" as const,
          requiresApproval: true,
        },
      },
      execute() {
        return {};
      },
    }));
    tools.forEach(registerCapability);

    const result = await resolveHarnessToolCandidatesForTurn({
      query: "search product documentation",
      source: "agent_intent",
      allowExternal: true,
      allowedExternalToolIds: tools.map((tool) => tool.definition.id),
      maxTools: 1,
    });

    expect(result.toolCandidates).toHaveLength(3);
    expect(result.toolExposure.exposedToolIds).toEqual(
      tools.map((tool) => tool.definition.id),
    );
  });

  it("keeps mixed internal and external tools fully exposed in the <=20 path", async () => {
    registerCapability(readOpenTool);
    const externalTools = Array.from({ length: 2 }, (_, index) => ({
      definition: {
        id: `mcp:mixed-server:tool:search_${index}`,
        title: `Mixed search ${index}`,
        description: "Search product documentation.",
        domain: "external_mcp" as const,
        source: "external" as const,
        mode: "sync" as const,
        inputSchema: { type: "object" },
        tags: ["docs"],
        capabilities: {
          sideEffect: "network" as const,
          requiresApproval: true,
        },
      },
      execute() {
        return {};
      },
    }));
    externalTools.forEach(registerCapability);

    const result = await resolveHarnessToolCandidatesForTurn({
      query: "search product documentation",
      source: "agent_intent",
      allowExternal: true,
      allowedExternalToolIds: externalTools.map((tool) => tool.definition.id),
      maxTools: 1,
    });

    expect(result.toolCandidates.map((candidate) => candidate.toolId)).toEqual([
      "read_open",
      ...externalTools.map((tool) => tool.definition.id),
    ]);
    expect(result.toolExposure.reason).toContain(
      "All eligible tools are exposed because the eligible set is at most 20 tools.",
    );
  });
});
