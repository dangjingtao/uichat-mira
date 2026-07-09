import path from "node:path";

import { createManagedCodeGraphWorkspaceHash } from "./managed-codegraph-process-manager.js";

const parseJsonArrayEnv = (
  rawValue: string | undefined,
  fallback: string[],
): string[] => {
  if (!rawValue?.trim()) {
    return [...fallback];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (
      Array.isArray(parsed) &&
      parsed.every((item) => typeof item === "string")
    ) {
      return parsed;
    }
  } catch {
    // Fall back to the default args when the env is malformed.
  }

  return [...fallback];
};

export const isCodebaseExplorePlannerExposureEnabled = () =>
  process.env.UI_CHAT_CODEGRAPH_PLANNER_ENABLED === "1";

export const resolveManagedCodeGraphPlannerConfig = (workspaceRoot: string) => {
  const workspaceHash = createManagedCodeGraphWorkspaceHash(workspaceRoot);
  const artifactRoot = path.resolve(
    process.cwd(),
    ".artifacts",
    "managed-codegraph",
    workspaceHash,
  );

  return {
    command: (process.env.UI_CHAT_CODEGRAPH_COMMAND ?? "codegraph").trim(),
    startArgs: parseJsonArrayEnv(
      process.env.UI_CHAT_CODEGRAPH_START_ARGS,
      ["mcp", "serve"],
    ),
    versionProbeArgs: parseJsonArrayEnv(
      process.env.UI_CHAT_CODEGRAPH_VERSION_ARGS,
      ["--version"],
    ),
    telemetryProbeArgs: parseJsonArrayEnv(
      process.env.UI_CHAT_CODEGRAPH_TELEMETRY_ARGS,
      ["telemetry", "status"],
    ),
    logRoot: path.join(artifactRoot, "logs"),
    indexRoot: path.join(artifactRoot, "index"),
  };
};
