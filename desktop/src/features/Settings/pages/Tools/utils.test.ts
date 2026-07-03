import { describe, expect, it } from "vitest";
import {
  buildToolDraft,
  compactJson,
  findPrimaryArtifact,
  getTerminalResultSummary,
  TOOL_DOMAIN_ORDER,
} from "./utils";
import type { McpArtifact, McpToolDefinition } from "@/shared/api/tools";

const createArtifact = (kind: McpArtifact["kind"]): McpArtifact => ({
  id: `${kind}-1`,
  kind,
  title: kind,
});

const createTool = (id: McpToolDefinition["id"]): McpToolDefinition => ({
  id,
  title: id,
  description: "",
  domain: "read",
  source: "internal",
  mode: "sync",
  inputSchema: {},
  tags: [],
  capabilities: {
    sideEffect: "none",
    requiresApproval: false,
  },
});

describe("TOOL_DOMAIN_ORDER", () => {
  it("contains the expected domains in order", () => {
    expect(TOOL_DOMAIN_ORDER).toEqual([
      "read",
      "edit",
      "web_search",
      "terminal",
    ]);
  });
});

describe("compactJson", () => {
  it("formats JSON with 2-space indentation", () => {
    expect(compactJson({ a: 1 })).toBe('{\n  "a": 1\n}');
  });
});

describe("getTerminalResultSummary", () => {
  it("returns null for non-object values", () => {
    expect(getTerminalResultSummary(null)).toBeNull();
    expect(getTerminalResultSummary("text")).toBeNull();
    expect(getTerminalResultSummary([])).toBeNull();
  });

  it("returns null when required fields are missing or invalid", () => {
    expect(getTerminalResultSummary({})).toBeNull();
    expect(
      getTerminalResultSummary({ command: 123, cwd: "/tmp", streamMode: "split" }),
    ).toBeNull();
  });

  it("extracts known terminal result fields", () => {
    const result = getTerminalResultSummary({
      command: "ls",
      cwd: "/tmp",
      streamMode: "merged",
      exitCode: 0,
      timedOut: false,
      stdout: "file.txt",
    });

    expect(result).toEqual({
      command: "ls",
      cwd: "/tmp",
      streamMode: "merged",
      exitCode: 0,
      timedOut: false,
      stdout: "file.txt",
    });
  });

  it("ignores unknown streamMode values", () => {
    const result = getTerminalResultSummary({
      command: "ls",
      cwd: "/tmp",
      streamMode: "invalid",
    });

    expect(result).toEqual({
      command: "ls",
      cwd: "/tmp",
      streamMode: undefined,
    });
  });
});

describe("findPrimaryArtifact", () => {
  it("returns null for empty artifacts", () => {
    expect(findPrimaryArtifact([])).toBeNull();
  });

  it("prefers search-results over others", () => {
    const artifacts = [createArtifact("text"), createArtifact("search-results")];
    expect(findPrimaryArtifact(artifacts)).toEqual(createArtifact("search-results"));
  });

  it("falls back to the first available kind by priority", () => {
    const artifacts = [createArtifact("text"), createArtifact("code")];
    expect(findPrimaryArtifact(artifacts)).toEqual(createArtifact("text"));
  });
});

describe("buildToolDraft", () => {
  it.each([
    ["read", '{\n  "path": "docs/role.md"\n}'],
    ["read_list", '{\n  "path": "docs"\n}'],
    ["web_search", '{\n  "query": "OpenAI Codex"\n}'],
    ["terminal_session", '{\n  "command": "pwd",\n  "sessionMode": "ephemeral",\n  "timeoutMs": 2000\n}'],
  ])("builds draft for %s", (id, expected) => {
    expect(buildToolDraft(createTool(id as McpToolDefinition["id"]))).toBe(expected);
  });

  it("returns empty JSON for unknown tool ids", () => {
    expect(buildToolDraft(createTool("unknown" as McpToolDefinition["id"]))).toBe(
      "{}",
    );
  });
});
