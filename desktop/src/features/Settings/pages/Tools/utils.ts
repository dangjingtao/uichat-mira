import type { McpArtifact, McpToolDefinition } from "@/shared/api/tools";
import type { ToolWorkbenchDomain } from "./types";

export const TOOL_DOMAIN_ORDER: ToolWorkbenchDomain[] = [
  "read",
  "edit",
  "web_search",
  "terminal",
];

export function compactJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export type TerminalResultSummary = {
  command?: string;
  cwd?: string;
  sessionId?: string;
  exitCode?: number | null;
  timedOut?: boolean;
  reusedSession?: boolean;
  sessionMode?: "ephemeral" | "persistent";
  streamMode?: "split" | "merged";
  stderrSeparated?: boolean;
  stdout?: string;
  stderr?: string;
};

export function getTerminalResultSummary(value: unknown): TerminalResultSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.command !== "string" ||
    typeof candidate.cwd !== "string" ||
    !("streamMode" in candidate)
  ) {
    return null;
  }

  return {
    command: typeof candidate.command === "string" ? candidate.command : undefined,
    cwd: typeof candidate.cwd === "string" ? candidate.cwd : undefined,
    sessionId: typeof candidate.sessionId === "string" ? candidate.sessionId : undefined,
    exitCode: typeof candidate.exitCode === "number" || candidate.exitCode === null ? (candidate.exitCode as number | null) : undefined,
    timedOut: typeof candidate.timedOut === "boolean" ? candidate.timedOut : undefined,
    reusedSession:
      typeof candidate.reusedSession === "boolean" ? candidate.reusedSession : undefined,
    sessionMode:
      candidate.sessionMode === "ephemeral" || candidate.sessionMode === "persistent"
        ? candidate.sessionMode
        : undefined,
    streamMode:
      candidate.streamMode === "split" || candidate.streamMode === "merged"
        ? candidate.streamMode
        : undefined,
    stderrSeparated:
      typeof candidate.stderrSeparated === "boolean" ? candidate.stderrSeparated : undefined,
    stdout: typeof candidate.stdout === "string" ? candidate.stdout : undefined,
    stderr: typeof candidate.stderr === "string" ? candidate.stderr : undefined,
  };
}

export function findPrimaryArtifact(artifacts: McpArtifact[]) {
  return (
    artifacts.find((artifact) => artifact.kind === "search-results") ??
    artifacts.find((artifact) => artifact.kind === "document") ??
    artifacts.find((artifact) => artifact.kind === "table") ??
    artifacts.find((artifact) => artifact.kind === "text") ??
    artifacts.find((artifact) => artifact.kind === "code") ??
    null
  );
}

export function buildToolDraft(tool: McpToolDefinition) {
  switch (tool.id) {
    case "read":
    case "read_open":
      return compactJson({ path: "docs/role.md" });
    case "read_list":
      return compactJson({ path: "docs" });
    case "read_locate":
      return compactJson({ query: "role", searchMode: "path", limit: 10 });
    case "read_extract":
      return compactJson({ path: "docs/role.md", startLine: 1, endLine: 40 });
    case "read_slice":
      return compactJson({ text: "line1\nline2\nline3", startLine: 1, endLine: 2 });
    case "edit_file":
      return compactJson({
        path: "docs/example.md",
        operation: "replace_block",
        expectedOldText: "old text",
        newText: "new text",
      });
    case "web_search":
      return compactJson({ query: "OpenAI Codex" });
    case "terminal_session":
      return compactJson({ command: "pwd", sessionMode: "ephemeral", timeoutMs: 2000 });
    default:
      return compactJson({});
  }
}
