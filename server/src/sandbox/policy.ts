import { mcpBadRequest } from "@/mcp/core/errors.js";

const normalizeTokens = (command: string) =>
  command
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

const startsWithAny = (value: string, prefixes: string[]) =>
  prefixes.some((prefix) => value === prefix || value.startsWith(`${prefix}=`));

export const assertSandboxCommandPolicy = (command: string) => {
  const tokens = normalizeTokens(command);
  if (tokens.length === 0) {
    throw mcpBadRequest("command is required");
  }

  const executable = tokens[0]?.toLowerCase() ?? "";
  const args = tokens.slice(1).map((token) => token.toLowerCase());

  if (executable === "node") {
    if (args.some((token) => startsWithAny(token, ["-e", "--eval", "-p", "--print"]))) {
      throw mcpBadRequest("inline Node execution is blocked by sandbox policy");
    }
  }

  if (executable === "python" || executable === "python3" || executable === "py") {
    if (args.some((token) => startsWithAny(token, ["-c", "-m"]))) {
      throw mcpBadRequest("inline or module Python execution is blocked by sandbox policy");
    }
  }

  if (executable === "npm") {
    const blockedSubcommand = args.find((token) =>
      ["exec", "create", "init"].includes(token),
    );
    if (blockedSubcommand) {
      throw mcpBadRequest(`npm ${blockedSubcommand} is blocked by sandbox policy`);
    }
  }

  if (executable === "git" && args[0] === "config") {
    if (args.includes("--global") || args.includes("--system")) {
      throw mcpBadRequest("git config outside local workspace scope is blocked by sandbox policy");
    }
  }
};
