import { beforeEach, describe, expect, it, vi } from "vitest";
import * as embedding from "@/services/internal-capabilities/local-embedding.js";
import * as rerank from "@/services/internal-capabilities/local-rerank.js";
import { clearHarnessRegistry, registerCapability } from "./registry.js";
import { resolveHarnessToolCandidatesForTurn } from "./tool-candidates.js";
import { readListTool } from "../mcp/tools/read-list.tool.js";
import { readLocateTool } from "../mcp/tools/read-locate.tool.js";
import { readOpenTool } from "../mcp/tools/read-open.tool.js";
import { readTool } from "../mcp/tools/read.tool.js";
import { readSliceTool } from "../mcp/tools/read-slice.tool.js";
import { webSearchTool } from "../mcp/tools/web-search.tool.js";
import { terminalSessionTool } from "../mcp/tools/terminal-session.tool.js";

const EXTERNAL_HIDDEN_REASON = "External MCP capabilities are hidden unless explicitly enabled.";
const TERMINAL_HIDDEN_REASON =
  "Terminal tools are hidden unless the turn clearly asks to run a command.";
const WORKSPACE_WEB_HIDDEN_REASON =
  "Workspace-local query hides web_search for agent_intent; local read evidence should be preferred.";
const LOW_INTENT_REASON = "Greeting or low-intent input should stay in pure conversation mode.";
const CHAT_SAFE_DOMAIN_REASON = "Chat-visible tool surface is restricted to safe built-in domains.";

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

const registerTools = (tools: Array<{ definition: { id: string } } & Record<string, unknown>>) => {
  for (const tool of tools) {
    registerCapability(tool as never);
  }
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

describe("resolveHarnessToolCandidatesForTurn", () => {
  beforeEach(() => {
    clearHarnessRegistry();
    vi.restoreAllMocks();
  });

  it("returns tool candidates and exposed tool ids without invocation payloads", async () => {
    registerTools([readListTool, readLocateTool]);
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

  it.each([
    {
      label: "workspace README file content stays local",
      query: "README.md 的 Runtime 一节具体列了哪些运行组件？请基于文件内容回答。",
      source: "agent_intent" as const,
      tools: [readOpenTool, webSearchTool, externalFakeTool],
      rerankOrder: ["read_open"],
      expectedExposedToolIds: ["read_open"],
      expectedBlockedCapabilityIds: ["web_search", "external_fake_tool"],
      expectedReasons: [WORKSPACE_WEB_HIDDEN_REASON, EXTERNAL_HIDDEN_REASON],
      expectedTopToolIds: ["read_open"],
      expectedPreferredToolIds: ["read_open"],
    },
    {
      label: "workspace directory listing prefers read_list",
      query: "帮我看看工作区目录里有哪些文件夹",
      source: "agent_intent" as const,
      tools: [readListTool, externalFakeTool],
      rerankOrder: ["read_list"],
      expectedExposedToolIds: ["read_list"],
      expectedBlockedCapabilityIds: ["external_fake_tool"],
      expectedReasons: [EXTERNAL_HIDDEN_REASON],
      expectedTopToolIds: ["read_list"],
      expectedPreferredToolIds: ["read_list"],
    },
    {
      label: "workspace fuzzy lookup prefers read_locate",
      query: "帮我找一下 settings 相关文件",
      source: "agent_intent" as const,
      tools: [readLocateTool, externalFakeTool],
      rerankOrder: ["workspace_lookup"],
      expectedExposedToolIds: ["read_locate"],
      expectedBlockedCapabilityIds: ["external_fake_tool"],
      expectedReasons: [EXTERNAL_HIDDEN_REASON],
      expectedTopToolIds: ["read_locate"],
      expectedPreferredToolIds: ["read_locate"],
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
      expectedPreferredToolIds: ["web_search"],
    },
    {
      label: "small talk keeps no tool surface",
      query: "谢谢",
      source: "agent_intent" as const,
      tools: [readOpenTool, webSearchTool, terminalSessionTool, externalFakeTool],
      rerankOrder: [],
      expectedExposedToolIds: [],
      expectedBlockedCapabilityIds: [
        "read_open",
        "web_search",
        "terminal_session",
        "external_fake_tool",
      ],
      expectedReasons: [LOW_INTENT_REASON],
      expectedTopToolIds: [],
      expectedPreferredToolIds: [],
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
      expectedPreferredToolIds: [],
    },
    {
      label: "chat surface only keeps safe built-in domains",
      query: "今天最新新闻是什么",
      source: "chat_surface" as const,
      tools: [readOpenTool, webSearchTool, terminalSessionTool, externalFakeTool],
      rerankOrder: ["web_research", "read_open"],
      expectedExposedToolIds: ["web_search"],
      expectedBlockedCapabilityIds: ["terminal_session", "external_fake_tool"],
      expectedReasons: [CHAT_SAFE_DOMAIN_REASON, EXTERNAL_HIDDEN_REASON],
      expectedTopToolIds: ["web_search"],
      expectedPreferredToolIds: ["web_search"],
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
      expectedPreferredToolIds: ["terminal_session"],
    },
    {
      label: "non-command request keeps terminal_session hidden",
      query: "帮我总结 README.md",
      source: "agent_intent" as const,
      tools: [terminalSessionTool, externalFakeTool],
      rerankOrder: [],
      expectedExposedToolIds: [],
      expectedBlockedCapabilityIds: ["terminal_session", "external_fake_tool"],
      expectedReasons: [TERMINAL_HIDDEN_REASON, EXTERNAL_HIDDEN_REASON],
      expectedTopToolIds: [],
      expectedPreferredToolIds: [],
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
      expectedPreferredToolIds: [],
    },
    {
      label: "allowExternal exposes external MCP",
      query: "use external system",
      source: "agent_intent" as const,
      tools: [externalFakeTool],
      allowExternal: true,
      rerankOrder: ["external_fake_tool"],
      expectedExposedToolIds: ["external_fake_tool"],
      expectedBlockedCapabilityIds: [],
      expectedReasons: [],
      expectedTopToolIds: ["external_fake_tool"],
      expectedPreferredToolIds: ["external_fake_tool"],
    },
    {
      label: "sandbox-unavailable command does not surface terminal",
      query: "run pnpm check",
      source: "agent_intent" as const,
      tools: [terminalSessionTool, externalFakeTool],
      sandboxProfiles: { command: false },
      rerankOrder: [],
      expectedExposedToolIds: [],
      expectedBlockedCapabilityIds: ["terminal_session", "external_fake_tool"],
      expectedReasons: [
        "Sandbox-required tools are hidden when their sandbox profile is unavailable.",
        EXTERNAL_HIDDEN_REASON,
      ],
      expectedTopToolIds: [],
      expectedPreferredToolIds: [],
    },
  ])(
    "keeps the tool-exposure regression pack green: $label",
    async ({
      query,
      source,
      tools,
      allowExternal,
      sandboxProfiles,
      rerankOrder,
      expectedExposedToolIds,
      expectedBlockedCapabilityIds,
      expectedReasons,
      expectedTopToolIds,
      expectedPreferredToolIds,
    }) => {
      registerTools(tools);
      mockRecallOrder(rerankOrder);

      const result = await resolveHarnessToolCandidatesForTurn({
        query,
        source,
        allowExternal,
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
      expect(result.toolCandidates.slice(0, expectedTopToolIds.length).map((candidate) => candidate.toolId)).toEqual(
        expectedTopToolIds,
      );
      expect(
        result.toolCandidates
          .filter((candidate) => candidate.preferredForQuery === true)
          .map((candidate) => candidate.toolId),
      ).toEqual(expectedPreferredToolIds);
    },
  );
});
