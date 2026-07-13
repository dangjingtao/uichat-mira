import { afterEach, describe, expect, it } from "vitest";
import { clearHarnessRegistry, registerCapability } from "./registry.js";
import { resolveHarnessToolExposure } from "./exposure.js";
import { terminalSessionTool } from "../mcp/tools/terminal-session.tool.js";
import { readTool } from "../mcp/tools/read.tool.js";
import { readOpenTool } from "../mcp/tools/read-open.tool.js";
import { readDiscoverTool } from "../mcp/tools/read-discover.tool.js";
import { readListTool } from "../mcp/tools/read-list.tool.js";
import { readLocateTool } from "../mcp/tools/read-locate.tool.js";
import { readSliceTool } from "../mcp/tools/read-slice.tool.js";
import { webSearchTool } from "../mcp/tools/web-search.tool.js";

const externalFakeTool = {
  definition: {
    id: "external_fake_tool",
    title: "External Fake Tool",
    description: "external fake",
    domain: "external_mcp" as const,
    source: "external" as const,
    mode: "sync" as const,
    inputSchema: {},
    tags: ["external", "mcp"],
    capabilities: {
      sideEffect: "network" as const,
      requiresApproval: false,
    },
  },
  execute() {
    return {};
  },
};

describe("resolveHarnessToolExposure", () => {
  afterEach(() => {
    clearHarnessRegistry();
  });

  it("keeps the full terminal runtime schema in tools_list exposure", () => {
    registerCapability(terminalSessionTool);

    const [definition] = resolveHarnessToolExposure({
      source: "tools_list",
    }).visibleDefinitions;

    const properties = (definition?.inputSchema.properties ?? {}) as Record<string, unknown>;

    expect(properties.env).toBeDefined();
    expect(properties.attachSessionId).toBeDefined();
    expect(properties.sessionMode).toBeDefined();
  });

  it("exposes eligible terminal_session regardless of user wording", () => {
    registerCapability(terminalSessionTool);
    registerCapability(readOpenTool);

    const decision = resolveHarnessToolExposure({
      source: "agent_intent",
      query: "README.md 的 Runtime 一节具体列了哪些运行组件？请基于文件内容回答。",
    });

    expect(decision.exposedToolIds).toContain("read_open");
    expect(decision.exposedToolIds).toContain("terminal_session");
  });

  it("does not use small talk to change exposure", () => {
    registerCapability(terminalSessionTool);

    const decision = resolveHarnessToolExposure({
      source: "agent_intent",
      query: "你好",
    });

    expect(decision.exposedToolIds).toContain("terminal_session");
  });

  it.each([
    "run",
    "run a local command",
    "command",
    "execute a command",
    "terminal please",
    "执行",
    "执行命令",
    "运行命令",
  ])("exposes terminal_session for any wording when hard boundaries pass: %s", (query) => {
    registerCapability(terminalSessionTool);

    const decision = resolveHarnessToolExposure({
      source: "agent_intent",
      query,
    });

    expect(decision.exposedToolIds).toContain("terminal_session");
  });

  it("exposes terminal_session with approval metadata only when default L1 command sandbox is available", () => {
    registerCapability(terminalSessionTool);

    const [definition] = resolveHarnessToolExposure({
      source: "agent_intent",
      query: "run pnpm check",
    }).visibleDefinitions;

    const properties = (definition?.inputSchema.properties ?? {}) as Record<string, unknown>;

    expect(properties.command).toBeDefined();
    expect(properties.cwd).toBeDefined();
    expect(properties.timeoutMs).toBeDefined();
    expect(properties.env).toBeUndefined();
    expect(properties.attachSessionId).toBeUndefined();
    expect(properties.sessionMode).toBeUndefined();
    expect(definition?.inputSchema.additionalProperties).toBe(false);
    expect(definition?.capabilities.requiresApproval).toBe(true);
    expect(definition?.capabilities.sandboxRequired).toBe(true);
    expect(definition?.capabilities.sandboxProfile).toBe("command");
  });

  it("does not expose terminal_session to agent_intent when approval metadata is missing", () => {
    registerCapability({
      ...terminalSessionTool,
      definition: {
        ...terminalSessionTool.definition,
        capabilities: {
          ...terminalSessionTool.definition.capabilities,
          requiresApproval: false,
        },
      },
    });

    const decision = resolveHarnessToolExposure({
      source: "agent_intent",
      query: "run pnpm check",
    });

    expect(decision.exposedToolIds).not.toContain("terminal_session");
  });

  it("does not expose terminal_session to agent_intent when L1 command sandbox is unavailable", () => {
    registerCapability(terminalSessionTool);

    const decision = resolveHarnessToolExposure({
      source: "agent_intent",
      query: "run pnpm check",
      sandboxProfiles: {
        command: false,
      },
    });

    expect(decision.exposedToolIds).not.toContain("terminal_session");
    expect(decision.reasons).toContain(
      "Sandbox-required tools are hidden when their sandbox profile is unavailable.",
    );
  });

  it("does not expose terminal_session to chat_surface", () => {
    registerCapability(terminalSessionTool);

    const decision = resolveHarnessToolExposure({
      source: "chat_surface",
      query: "run pnpm check",
    });

    expect(decision.exposedToolIds).not.toContain("terminal_session");
  });

  it.each([
    {
      label: "weak English command wording",
      input: { source: "agent_intent" as const, query: "run a local command" },
      requiresApproval: true,
      expectedExposed: true,
      expectedSchemaKeys: ["command", "cwd", "timeoutMs"],
    },
    {
      label: "weak Chinese command wording",
      input: { source: "agent_intent" as const, query: "执行命令" },
      requiresApproval: true,
      expectedExposed: true,
      expectedSchemaKeys: ["command", "cwd", "timeoutMs"],
    },
    {
      label: "explicit command with sandbox available",
      input: { source: "agent_intent" as const, query: "run pnpm check" },
      requiresApproval: true,
      expectedExposed: true,
      expectedSchemaKeys: ["command", "cwd", "timeoutMs"],
    },
    {
      label: "explicit command without approval metadata",
      input: { source: "agent_intent" as const, query: "run pnpm check" },
      requiresApproval: false,
      expectedExposed: false,
      expectedSchemaKeys: [],
    },
    {
      label: "explicit command with sandbox unavailable",
      input: {
        source: "agent_intent" as const,
        query: "run pnpm check",
        sandboxProfiles: { command: false },
      },
      requiresApproval: true,
      expectedExposed: false,
      expectedSchemaKeys: [],
    },
    {
      label: "tools_list keeps runtime schema",
      input: { source: "tools_list" as const },
      requiresApproval: true,
      expectedExposed: true,
      expectedSchemaKeys: ["command", "cwd", "env", "timeoutMs", "attachSessionId", "sessionMode"],
    },
    {
      label: "chat_surface hides terminal",
      input: { source: "chat_surface" as const, query: "run pnpm check" },
      requiresApproval: true,
      expectedExposed: false,
      expectedSchemaKeys: [],
    },
  ])(
    "applies the terminal exposure risk matrix: $label",
    ({ input, requiresApproval, expectedExposed, expectedSchemaKeys }) => {
      registerCapability({
        ...terminalSessionTool,
        definition: {
          ...terminalSessionTool.definition,
          capabilities: {
            ...terminalSessionTool.definition.capabilities,
            requiresApproval,
          },
        },
      });

      const decision = resolveHarnessToolExposure(input);
      const terminalDefinition = decision.visibleDefinitions.find(
        (definition) => definition.id === "terminal_session",
      );
      const schemaKeys = terminalDefinition
        ? Object.keys((terminalDefinition.inputSchema.properties ?? {}) as Record<string, unknown>)
        : [];

      expect(decision.exposedToolIds.includes("terminal_session")).toBe(expectedExposed);
      expect(schemaKeys).toEqual(expectedSchemaKeys);
      if (terminalDefinition) {
        expect(terminalDefinition.capabilities.requiresApproval).toBe(true);
      }
    },
  );

  it("hides read fallback aliases from agent_intent exposure while keeping tools_list intact", () => {
    registerCapability(readTool);
    registerCapability(readSliceTool);

    const toolsListIds = resolveHarnessToolExposure({
      source: "tools_list",
    }).visibleDefinitions.map((definition) => definition.id);
    const intentIds = resolveHarnessToolExposure({
      source: "agent_intent",
      query: "open README.md",
    }).visibleDefinitions.map((definition) => definition.id);

    expect(toolsListIds).toEqual(expect.arrayContaining(["read", "read_slice"]));
    expect(intentIds).not.toContain("read");
    expect(intentIds).not.toContain("read_slice");
  });

  it("hides web_search from chat_surface when the query is a workspace file request", () => {
    registerCapability(webSearchTool);

    const chatIds = resolveHarnessToolExposure({
      source: "chat_surface",
      query: "帮我看看当前工作空间里有哪些文件",
    }).visibleDefinitions.map((definition) => definition.id);

    expect(chatIds).toContain("web_search");
  });

  it("keeps web_search in chat_surface when the query is realtime-oriented", () => {
    registerCapability(webSearchTool);

    const chatIds = resolveHarnessToolExposure({
      source: "chat_surface",
      query: "今天的新闻是什么",
    }).visibleDefinitions.map((definition) => definition.id);

    expect(chatIds).toContain("web_search");
  });

  it("hides web_search from agent_intent for workspace-local folder/readme requests", () => {
    registerCapability(readOpenTool);
    registerCapability(webSearchTool);

    const decision = resolveHarnessToolExposure({
      source: "agent_intent",
      query: "看看文件夹下面有无读我文件，有的话，内容是啥",
    });

    expect(decision.exposedToolIds).toContain("web_search");
    expect(decision.exposedToolIds).toContain("read_open");
  });

  it("hides web_search from agent_intent for README Runtime file-content requests", () => {
    registerCapability(readOpenTool);
    registerCapability(webSearchTool);

    const decision = resolveHarnessToolExposure({
      source: "agent_intent",
      query: "README.md 的 Runtime 一节具体列了哪些运行组件？请基于文件内容回答。",
    });

    expect(decision.exposedToolIds).toContain("read_open");
    expect(decision.exposedToolIds).toContain("web_search");
  });

  it("keeps web_search in agent_intent for explicit external web queries", () => {
    registerCapability(webSearchTool);

    const decision = resolveHarnessToolExposure({
      source: "agent_intent",
      query: "请联网搜索今天最新的 release notes",
    });

    expect(decision.exposedToolIds).toContain("web_search");
  });

  it("keeps external capabilities out of agent_intent unless allowExternal is enabled", () => {
    registerCapability(externalFakeTool);

    const hiddenIds = resolveHarnessToolExposure({
      source: "agent_intent",
      query: "use external system",
    }).exposedToolIds;
    const visibleIds = resolveHarnessToolExposure({
      source: "agent_intent",
      query: "use external system",
      allowExternal: true,
      allowedExternalToolIds: ["external_fake_tool"],
    }).exposedToolIds;

    expect(hiddenIds).not.toContain("external_fake_tool");
    expect(visibleIds).toContain("external_fake_tool");
  });

  it("never opens external capabilities with an empty or non-registry allowlist", () => {
    registerCapability(externalFakeTool);

    expect(resolveHarnessToolExposure({
      source: "agent_intent",
      allowExternal: true,
      allowedExternalToolIds: [],
    }).exposedToolIds).not.toContain("external_fake_tool");
    expect(resolveHarnessToolExposure({
      source: "agent_intent",
      allowExternal: true,
      allowedExternalToolIds: ["mcp:missing-server:tool:missing"],
    }).exposedToolIds).not.toContain("external_fake_tool");
  });

  it("does not expose registered external capabilities omitted from the eligible allowlist", () => {
    registerCapability(externalFakeTool);

    const decision = resolveHarnessToolExposure({
      source: "agent_intent",
      allowExternal: true,
      allowedExternalToolIds: ["mcp:other-server:tool:eligible"],
    });

    expect(decision.exposedToolIds).not.toContain("external_fake_tool");
    expect(decision.blockedCapabilityReasons.external_fake_tool).toMatch(/allowlist/i);
  });

  it.each([
    {
       label: "workspace README wording does not hide web_search",
      input: {
        source: "agent_intent" as const,
        query: "README.md 的 Runtime 一节具体列了哪些运行组件？请基于文件内容回答。",
      },
      tools: [readOpenTool, webSearchTool, externalFakeTool],
       expectedExposed: ["read_open", "web_search"],
       expectedBlocked: ["external_fake_tool"],
       expectedReasons: ["External MCP capabilities are hidden unless explicitly enabled."],
    },
    {
      label: "workspace discovery exposes read_discover",
      input: {
        source: "agent_intent" as const,
        query: "帮我看看工作区目录里有哪些文件夹",
      },
      tools: [readDiscoverTool, externalFakeTool],
      expectedExposed: ["read_discover"],
      expectedBlocked: ["external_fake_tool"],
      expectedReasons: ["External MCP capabilities are hidden unless explicitly enabled."],
    },
    {
      label: "workspace discovery covers fuzzy lookup",
      input: {
        source: "agent_intent" as const,
        query: "帮我找一下 settings 相关文件",
      },
      tools: [readDiscoverTool, externalFakeTool],
      expectedExposed: ["read_discover"],
      expectedBlocked: ["external_fake_tool"],
      expectedReasons: ["External MCP capabilities are hidden unless explicitly enabled."],
    },
    {
      label: "chat surface keeps only safe domains",
      input: {
        source: "chat_surface" as const,
        query: "今天最新新闻是什么",
      },
      tools: [readOpenTool, webSearchTool, terminalSessionTool, externalFakeTool],
      expectedExposed: ["read_open", "web_search"],
      expectedBlocked: ["terminal_session", "external_fake_tool"],
      expectedReasons: ["Chat-visible tool surface is restricted to safe built-in domains."],
    },
    {
      label: "terminal command keeps requiresApproval schema",
      input: {
        source: "agent_intent" as const,
        query: "run pnpm check",
        sandboxProfiles: { command: true },
      },
      tools: [terminalSessionTool, externalFakeTool],
      expectedExposed: ["terminal_session"],
      expectedBlocked: ["external_fake_tool"],
      expectedReasons: ["External MCP capabilities are hidden unless explicitly enabled."],
      expectedApprovalToolId: "terminal_session",
    },
    {
       label: "non-command wording does not hide terminal",
      input: {
        source: "agent_intent" as const,
        query: "帮我总结 README.md",
      },
      tools: [terminalSessionTool, externalFakeTool],
       expectedExposed: ["terminal_session"],
       expectedBlocked: ["external_fake_tool"],
       expectedReasons: ["External MCP capabilities are hidden unless explicitly enabled."],
    },
    {
       label: "small talk does not change exposure",
      input: {
        source: "agent_intent" as const,
        query: "谢谢",
      },
      tools: [readOpenTool, webSearchTool, terminalSessionTool, externalFakeTool],
       expectedExposed: ["read_open", "web_search", "terminal_session"],
       expectedBlocked: ["external_fake_tool"],
       expectedReasons: ["External MCP capabilities are hidden unless explicitly enabled."],
    },
    {
      label: "allowExternal is required before external MCP becomes visible",
      input: {
        source: "agent_intent" as const,
        query: "use external system",
        allowExternal: true,
        allowedExternalToolIds: ["external_fake_tool"],
      },
      tools: [externalFakeTool],
      expectedExposed: ["external_fake_tool"],
      expectedBlocked: [],
      expectedReasons: [],
    },
  ])(
    "applies the exposure regression pack directly: $label",
    ({ input, tools, expectedExposed, expectedBlocked, expectedReasons, expectedApprovalToolId }) => {
      for (const tool of tools) {
        registerCapability(tool);
      }

      const decision = resolveHarnessToolExposure(input);

      expect(decision.exposedToolIds).toEqual(expectedExposed);
      expect(decision.blockedCapabilityIds).toEqual(expect.arrayContaining(expectedBlocked));
      for (const reason of expectedReasons) {
        expect(decision.reasons).toContain(reason);
      }
      if (expectedApprovalToolId) {
        const definition = decision.visibleDefinitions.find((item) => item.id === expectedApprovalToolId);
        expect(definition?.capabilities.requiresApproval).toBe(true);
      }
    },
  );

  it("exposes only the two public read contracts to Planner", () => {
    registerCapability(readDiscoverTool);
    registerCapability(readOpenTool);
    registerCapability(readListTool);
    registerCapability(readLocateTool);
    registerCapability(readTool);
    registerCapability(readSliceTool);

    const decision = resolveHarnessToolExposure({ source: "agent_intent", query: "read workspace" });

    expect(decision.exposedToolIds).toEqual(["read_discover", "read_open"]);
    expect(decision.blockedCapabilityIds).toEqual(
      expect.arrayContaining(["read_list", "read_locate", "read", "read_slice"]),
    );
  });
});
