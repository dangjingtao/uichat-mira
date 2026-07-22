import { spawnSync } from "node:child_process";
import path from "node:path";

import { resolveTerminalRuntimeExecutable } from "../terminal/dev-runtime.js";
import type { ReadLocateMatch } from "./types.js";

export type RipgrepSearchProvider = "bundled-ripgrep" | "system-ripgrep";

type RipgrepResolution = {
  source: "bundled" | "system" | "unavailable";
  executablePath?: string;
};

type RipgrepSpawnResult = {
  error?: Error;
  status: number | null;
  stdout: string;
};

type RipgrepSpawn = (
  executablePath: string,
  args: string[],
  options: {
    cwd?: string;
    encoding: "utf-8";
    windowsHide: true;
    maxBuffer: number;
  },
) => RipgrepSpawnResult;

export type RipgrepProviderDependencies = {
  resolveExecutable?: () => RipgrepResolution;
  spawn?: RipgrepSpawn;
};

export type RipgrepSearchResult =
  | {
      status: "success";
      provider: RipgrepSearchProvider;
      matches: ReadLocateMatch[];
    }
  | {
      status: "unavailable" | "failed";
      provider?: RipgrepSearchProvider;
      reason: string;
      matches: [];
    };

const PREVIEW_MAX_LENGTH = 120;
const RIPGREP_MAX_BUFFER_BYTES = 8 * 1024 * 1024;

const defaultSpawn: RipgrepSpawn = (executablePath, args, options) => {
  const result = spawnSync(executablePath, args, options);
  return {
    ...(result.error ? { error: result.error } : {}),
    status: result.status,
    stdout: typeof result.stdout === "string" ? result.stdout : "",
  };
};

const resolveExecutable = (dependencies: RipgrepProviderDependencies) =>
  dependencies.resolveExecutable?.() ?? resolveTerminalRuntimeExecutable("ripgrep");

const toProvider = (
  source: RipgrepResolution["source"],
): RipgrepSearchProvider | undefined => {
  if (source === "bundled") return "bundled-ripgrep";
  if (source === "system") return "system-ripgrep";
  return undefined;
};

const normalizeRelativePath = (filePath: string) => filePath.replace(/\\/g, "/");

const shortenPreview = (value: string) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= PREVIEW_MAX_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, PREVIEW_MAX_LENGTH - 3).trimEnd()}...`;
};

const readJsonText = (value: unknown) => {
  if (!value || typeof value !== "object") return "";
  const record = value as { text?: unknown; bytes?: unknown };
  if (typeof record.text === "string") return record.text;
  if (typeof record.bytes === "string") {
    return Buffer.from(record.bytes, "base64").toString("utf-8");
  }
  return "";
};

const buildArgs = ({
  query,
  extensions,
  limit,
}: {
  query: string;
  extensions: string[];
  limit: number;
}) => [
  "--json",
  "--line-number",
  "--column",
  "--smart-case",
  "--max-count",
  String(limit),
  ...extensions.flatMap((extension) => ["--glob", `*${extension}`]),
  "--",
  query,
  ".",
];

export const probeRipgrepProvider = (
  dependencies: RipgrepProviderDependencies = {},
) => {
  const resolution = resolveExecutable(dependencies);
  const provider = toProvider(resolution.source);
  if (!provider || !resolution.executablePath) {
    return { available: false as const, provider: undefined };
  }

  const spawn = dependencies.spawn ?? defaultSpawn;
  const result = spawn(resolution.executablePath, ["--version"], {
    encoding: "utf-8",
    windowsHide: true,
    maxBuffer: RIPGREP_MAX_BUFFER_BYTES,
  });

  return {
    available: !result.error && result.status === 0,
    provider,
  };
};

export const searchWithRipgrep = (
  {
    query,
    workspaceRoot,
    basePath,
    extensions,
    limit,
  }: {
    query: string;
    workspaceRoot: string;
    basePath: string;
    extensions: string[];
    limit: number;
  },
  dependencies: RipgrepProviderDependencies = {},
): RipgrepSearchResult => {
  const resolution = resolveExecutable(dependencies);
  const provider = toProvider(resolution.source);
  if (!provider || !resolution.executablePath) {
    return {
      status: "unavailable",
      reason: "runtime-unavailable",
      matches: [],
    };
  }

  const spawn = dependencies.spawn ?? defaultSpawn;
  const result = spawn(
    resolution.executablePath,
    buildArgs({ query, extensions, limit }),
    {
      cwd: basePath,
      encoding: "utf-8",
      windowsHide: true,
      maxBuffer: RIPGREP_MAX_BUFFER_BYTES,
    },
  );

  if (result.error) {
    return {
      status: "failed",
      provider,
      reason: "spawn-error",
      matches: [],
    };
  }

  if (result.status !== 0 && result.status !== 1) {
    return {
      status: "failed",
      provider,
      reason: `exit-status-${result.status ?? "unknown"}`,
      matches: [],
    };
  }

  const matches: ReadLocateMatch[] = [];
  try {
    for (const line of result.stdout.split(/\r?\n/)) {
      if (!line.trim()) continue;

      const payload = JSON.parse(line) as {
        type?: string;
        data?: {
          path?: unknown;
          lines?: unknown;
          line_number?: unknown;
          submatches?: Array<{ start?: unknown }>;
        };
      };
      if (payload.type !== "match" || !payload.data) continue;

      const reportedPath = readJsonText(payload.data.path);
      if (!reportedPath) continue;
      const absolutePath = path.isAbsolute(reportedPath)
        ? reportedPath
        : path.resolve(basePath, reportedPath);
      const firstSubmatch = payload.data.submatches?.[0];

      matches.push({
        path: normalizeRelativePath(path.relative(workspaceRoot, absolutePath)),
        matchType: "content",
        line: Number(payload.data.line_number),
        column: Number(firstSubmatch?.start ?? 0) + 1,
        preview: shortenPreview(readJsonText(payload.data.lines)),
      });

      if (matches.length >= limit) break;
    }
  } catch {
    return {
      status: "failed",
      provider,
      reason: "invalid-json-output",
      matches: [],
    };
  }

  return {
    status: "success",
    provider,
    matches,
  };
};
