import { afterEach, describe, expect, it } from "vitest";
import { clearHarnessRegistry, registerCapability } from "./registry.js";
import { resolveHarnessToolExposure } from "./exposure.js";
import { terminalSessionTool } from "../tools/terminal-session.tool.js";
import { readTool } from "../tools/read.tool.js";
import { readSliceTool } from "../tools/read-slice.tool.js";
import { webSearchTool } from "../tools/web-search.tool.js";

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

  it("hides terminal session-management fields from agent_intent exposure", () => {
    registerCapability(terminalSessionTool);

    const [definition] = resolveHarnessToolExposure({
      source: "agent_intent",
      query: "run a local command",
    }).visibleDefinitions;

    const properties = (definition?.inputSchema.properties ?? {}) as Record<string, unknown>;

    expect(properties.command).toBeDefined();
    expect(properties.cwd).toBeDefined();
    expect(properties.timeoutMs).toBeDefined();
    expect(properties.env).toBeUndefined();
    expect(properties.attachSessionId).toBeUndefined();
    expect(properties.sessionMode).toBeUndefined();
    expect(definition?.inputSchema.additionalProperties).toBe(false);
  });

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

    expect(chatIds).not.toContain("web_search");
  });

  it("keeps web_search in chat_surface when the query is realtime-oriented", () => {
    registerCapability(webSearchTool);

    const chatIds = resolveHarnessToolExposure({
      source: "chat_surface",
      query: "今天的新闻是什么",
    }).visibleDefinitions.map((definition) => definition.id);

    expect(chatIds).toContain("web_search");
  });

  it("keeps external capabilities out of agent_intent unless allowExternal is enabled", () => {
    registerCapability({
      definition: {
        id: "external_fake_tool",
        title: "External Fake Tool",
        description: "external fake",
        domain: "external_mcp",
        source: "external",
        mode: "sync",
        inputSchema: {},
        tags: ["external", "mcp"],
        capabilities: {
          sideEffect: "network",
          requiresApproval: false,
        },
      },
      execute() {
        return {};
      },
    });

    const hiddenIds = resolveHarnessToolExposure({
      source: "agent_intent",
      query: "use external system",
    }).exposedToolIds;
    const visibleIds = resolveHarnessToolExposure({
      source: "agent_intent",
      query: "use external system",
      allowExternal: true,
    }).exposedToolIds;

    expect(hiddenIds).not.toContain("external_fake_tool");
    expect(visibleIds).toContain("external_fake_tool");
  });
});
