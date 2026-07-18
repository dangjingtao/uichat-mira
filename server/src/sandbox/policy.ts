import { mcpBadRequest } from "@/mcp/core/errors.js";

const normalizeTokens = (command: string) =>
  command
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

export const assertSandboxCommandPolicy = (command: string) => {
  const tokens = normalizeTokens(command);
  if (tokens.length === 0) {
    throw mcpBadRequest("command is required");
  }

  const executable = tokens[0]?.toLowerCase() ?? "";
  const args = tokens.slice(1).map((token) => token.toLowerCase());

  // Runtime command forms such as `python -c`, `python -m`, `node -e`,
  // `npm exec`, `npm create`, and `npm init` are normal terminal capabilities.
  // They are intentionally not blocked here. Approval, workspace/runtime context,
  // timeout, output limits, cancellation, and process-tree ownership are enforced
  // by their dedicated layers instead of a command-shape blacklist.

  if (executable === "git" && args[0] === "config") {
    if (args.includes("--global") || args.includes("--system")) {
      throw mcpBadRequest(
        "git config outside local workspace scope is blocked by sandbox policy",
      );
    }
  }
};