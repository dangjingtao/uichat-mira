import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import fg from "fast-glob";
import type { McpExecutionEnvironment } from "../core/definitions.js";
import { mcpBadRequest, mcpInternalError } from "../core/errors.js";
import { getWorkspaceRoot, resolveWorkspacePath } from "../workspace.js";
import type { ReadLocateMatch, ReadLocateResult } from "./types.js";

export type ReadLocateArgs = {
  query: string;
  path?: string;
  searchMode?: "auto" | "path" | "content";
  extensions?: string[];
  limit?: number;
};

type LocateProviderCapability = McpExecutionEnvironment["read"]["capabilities"][number];

const DEFAULT_LIMIT = 20;
const PREVIEW_MAX_LENGTH = 120;

const assertEnvironment = (environment?: McpExecutionEnvironment) => {
  if (!environment || environment.source !== "harness") {
    throw mcpInternalError("Read locate requires a harness environment snapshot");
  }

  return environment;
};

const clampLimit = (limit: unknown) => {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), 100);
};

const normalizeExtensions = (extensions: unknown) => {
  if (!Array.isArray(extensions)) {
    return [];
  }

  return extensions
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => (value.startsWith(".") ? value.toLowerCase() : `.${value.toLowerCase()}`));
};

const resolveScope = (inputPath: unknown) => {
  const workspaceRoot = getWorkspaceRoot();
  if (typeof inputPath !== "string" || !inputPath.trim()) {
    return {
      workspaceRoot,
      basePath: workspaceRoot,
      relativeBasePath: ".",
    };
  }

  const resolved = resolveWorkspacePath(inputPath);
  const stat = fs.statSync(resolved);
  const basePath = stat.isDirectory() ? resolved : path.dirname(resolved);
  const relativeBasePath = path.relative(workspaceRoot, basePath) || ".";

  return {
    workspaceRoot,
    basePath,
    relativeBasePath,
  };
};

const sortCapabilities = (environment: McpExecutionEnvironment) =>
  [...environment.read.capabilities]
    .filter((capability) => capability.available)
    .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));

const matchesExtension = (filePath: string, extensions: string[]) =>
  extensions.length === 0 || extensions.includes(path.extname(filePath).toLowerCase());

const normalizeRelativePath = (filePath: string) => filePath.replace(/\\/g, "/");

const shortenPreview = (value: string) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= PREVIEW_MAX_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, PREVIEW_MAX_LENGTH - 3).trimEnd()}...`;
};

const buildPathPatterns = (query: string) => {
  const escaped = query.replace(/\\/g, "/");
  return [`**/*${escaped}*`];
};

const locateByPath = async ({
  query,
  workspaceRoot,
  basePath,
  extensions,
  limit,
  provider,
}: {
  query: string;
  workspaceRoot: string;
  basePath: string;
  extensions: string[];
  limit: number;
  provider: LocateProviderCapability;
}): Promise<ReadLocateMatch[]> => {
  const entries = await fg(buildPathPatterns(query), {
    cwd: basePath,
    onlyFiles: true,
    dot: true,
    unique: true,
    suppressErrors: true,
  });

  return entries
    .map((entry) => normalizeRelativePath(path.relative(workspaceRoot, path.resolve(basePath, entry))))
    .filter((entryPath) => matchesExtension(entryPath, extensions))
    .slice(0, limit)
    .map((entryPath) => ({
      path: entryPath,
      matchType: "path" as const,
    }));
};

const locateByRipgrep = ({
  query,
  workspaceRoot,
  basePath,
  extensions,
  limit,
  provider,
}: {
  query: string;
  workspaceRoot: string;
  basePath: string;
  extensions: string[];
  limit: number;
  provider: LocateProviderCapability;
}): ReadLocateMatch[] => {
  const extensionGlobs = extensions.flatMap((extension) => ["-g", `*${extension}`]);
  const command = [
    "--json",
    "--line-number",
    "--column",
    "--max-count",
    String(limit),
    ...extensionGlobs,
    query,
    basePath,
  ];
  const result = spawnSync("rg", command, {
    encoding: "utf-8",
    windowsHide: true,
  });

  if (result.error) {
    throw mcpInternalError("ripgrep locate provider failed", { cause: result.error });
  }

  if (result.status !== 0 && result.status !== 1) {
    throw mcpInternalError(`ripgrep exited with status ${result.status}`);
  }

  const matches: ReadLocateMatch[] = [];
  for (const line of result.stdout.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }

    const payload = JSON.parse(line) as Record<string, any>;
    if (payload.type !== "match") {
      continue;
    }

    const data = payload.data;
    const absolutePath = String(data.path.text);
    const relativePath = normalizeRelativePath(path.relative(workspaceRoot, absolutePath));

    matches.push({
      path: relativePath,
      matchType: "content",
      line: Number(data.line_number),
      column: Number(data.submatches?.[0]?.start ?? 0) + 1,
      preview: shortenPreview(String(data.lines.text)),
    });

    if (matches.length >= limit) {
      break;
    }
  }

  return matches;
};

const locateByNodeContentScan = ({
  query,
  workspaceRoot,
  basePath,
  extensions,
  limit,
  provider,
}: {
  query: string;
  workspaceRoot: string;
  basePath: string;
  extensions: string[];
  limit: number;
  provider: LocateProviderCapability;
}): ReadLocateMatch[] => {
  const entries = fg.sync(["**/*"], {
    cwd: basePath,
    onlyFiles: true,
    dot: true,
    unique: true,
    suppressErrors: true,
  });
  const loweredQuery = query.toLowerCase();
  const matches: ReadLocateMatch[] = [];

  for (const entry of entries) {
    if (matches.length >= limit) {
      break;
    }

    const absolutePath = path.resolve(basePath, entry);
    const relativePath = normalizeRelativePath(path.relative(workspaceRoot, absolutePath));
    if (!matchesExtension(relativePath, extensions)) {
      continue;
    }

    const buffer = fs.readFileSync(absolutePath);
    if (buffer.includes(0)) {
      continue;
    }

    const content = buffer.toString("utf-8");
    const matchIndex = content.toLowerCase().indexOf(loweredQuery);
    if (matchIndex < 0) {
      continue;
    }

    const prefix = content.slice(0, matchIndex);
    const line = prefix.split(/\r?\n/).length;
    const lineText = content.split(/\r?\n/)[line - 1] ?? "";
    const column = matchIndex - prefix.lastIndexOf("\n");

    matches.push({
      path: relativePath,
      matchType: "content",
      line,
      column,
      preview: shortenPreview(lineText),
    });
  }

  return matches;
};

export const describeLocatePlan = (
  environment: McpExecutionEnvironment | undefined,
  args: ReadLocateArgs,
) => {
  const harnessEnvironment = assertEnvironment(environment);
  const mode = args.searchMode ?? "auto";
  const chain = sortCapabilities(harnessEnvironment)
    .filter((capability) => capability.kind === "locate")
    .filter((capability) => {
      if (mode === "path") {
        return capability.id === "fast-glob-locate";
      }

      if (mode === "content") {
        return capability.id !== "fast-glob-locate";
      }

      return true;
    })
    .map((capability) => ({
      id: capability.id,
      priority: capability.priority,
    }));

  return {
    mode,
    chain,
  };
};

export const executeReadLocate = async (
  environment: McpExecutionEnvironment | undefined,
  rawArgs: Record<string, unknown>,
) => {
  const harnessEnvironment = assertEnvironment(environment);
  const query = typeof rawArgs.query === "string" ? rawArgs.query.trim() : "";
  if (!query) {
    throw mcpBadRequest("query is required");
  }

  const searchMode =
    rawArgs.searchMode === "path" || rawArgs.searchMode === "content" || rawArgs.searchMode === "auto"
      ? rawArgs.searchMode
      : "auto";
  const limit = clampLimit(rawArgs.limit);
  const extensions = normalizeExtensions(rawArgs.extensions);
  const scope = resolveScope(rawArgs.path);

  const capabilities = sortCapabilities(harnessEnvironment).filter(
    (capability) => capability.kind === "locate",
  );
  const selected = capabilities.filter((capability) => {
    if (searchMode === "path") {
      return capability.id === "fast-glob-locate";
    }

    if (searchMode === "content") {
      return capability.id !== "fast-glob-locate";
    }

    return true;
  });

  const plan = describeLocatePlan(harnessEnvironment, {
    query,
    path: typeof rawArgs.path === "string" ? rawArgs.path : undefined,
    searchMode,
    extensions,
    limit,
  });
  if (plan.chain.length > 0) {
    // Keep the progress text capability-level only; provider names stay internal.
    void plan;
  }

  const matches = new Map<string, ReadLocateMatch>();

  for (const capability of selected) {
    let nextMatches: ReadLocateMatch[] = [];

    if (capability.id === "fast-glob-locate") {
      nextMatches = await locateByPath({
        query,
        workspaceRoot: scope.workspaceRoot,
        basePath: scope.basePath,
        extensions,
        limit,
        provider: capability,
      });
    } else if (capability.id === "ripgrep-locate") {
      nextMatches = locateByRipgrep({
        query,
        workspaceRoot: scope.workspaceRoot,
        basePath: scope.basePath,
        extensions,
        limit,
        provider: capability,
      });
    } else if (capability.id === "node-content-scan-locate") {
      nextMatches = locateByNodeContentScan({
        query,
        workspaceRoot: scope.workspaceRoot,
        basePath: scope.basePath,
        extensions,
        limit,
        provider: capability,
      });
    }

    for (const match of nextMatches) {
      const key = `${match.path}:${match.matchType}:${match.line ?? 0}:${match.column ?? 0}`;
      if (!matches.has(key)) {
        matches.set(key, match);
      }
    }

    if (matches.size >= limit) {
      break;
    }
  }

  const result: ReadLocateResult = {
    type: "locate",
    matches: [...matches.values()].slice(0, limit),
    scope: scope.relativeBasePath,
    query,
    searchMode,
  };
  return result;
};
