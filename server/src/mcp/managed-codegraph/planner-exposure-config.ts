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

type ManagedCodeGraphPlannerStorageSource =
  | "explicit_app_data_root"
  | "log_dir_parent"
  | "database_dir_parent"
  | "unresolved";

type ManagedCodeGraphPlannerStorage = {
  status: "ready" | "blocked";
  source: ManagedCodeGraphPlannerStorageSource;
  appDataRoot: string | null;
  logRoot: string | null;
  indexRoot: string | null;
  reason: string | null;
};

const toAbsoluteIfPresent = (value: string | undefined) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return path.resolve(trimmed);
};

const resolveManagedCodeGraphPlannerStorage = (
  workspaceHash: string,
): ManagedCodeGraphPlannerStorage => {
  const explicitRoot = toAbsoluteIfPresent(process.env.UI_CHAT_CODEGRAPH_APP_DATA_ROOT);
  if (explicitRoot) {
    const artifactRoot = path.join(explicitRoot, "managed-codegraph", workspaceHash);
    return {
      status: "ready",
      source: "explicit_app_data_root",
      appDataRoot: explicitRoot,
      logRoot: path.join(artifactRoot, "logs"),
      indexRoot: path.join(artifactRoot, "index"),
      reason: null,
    };
  }

  const configuredLogDir = toAbsoluteIfPresent(process.env.UI_CHAT_LOG_DIR);
  if (configuredLogDir) {
    const appDataRoot = path.dirname(configuredLogDir);
    const artifactRoot = path.join(appDataRoot, "managed-codegraph", workspaceHash);
    return {
      status: "ready",
      source: "log_dir_parent",
      appDataRoot,
      logRoot: path.join(artifactRoot, "logs"),
      indexRoot: path.join(artifactRoot, "index"),
      reason: null,
    };
  }

  const configuredDatabaseDir = toAbsoluteIfPresent(process.env.UI_CHAT_DATABASE_DIR);
  if (configuredDatabaseDir) {
    const appDataRoot = path.dirname(configuredDatabaseDir);
    const artifactRoot = path.join(appDataRoot, "managed-codegraph", workspaceHash);
    return {
      status: "ready",
      source: "database_dir_parent",
      appDataRoot,
      logRoot: path.join(artifactRoot, "logs"),
      indexRoot: path.join(artifactRoot, "index"),
      reason: null,
    };
  }

  return {
    status: "blocked",
    source: "unresolved",
    appDataRoot: null,
    logRoot: null,
    indexRoot: null,
    reason:
      "Managed CodeGraph planner exposure requires an app-data root. Set UI_CHAT_CODEGRAPH_APP_DATA_ROOT or provide an absolute UI_CHAT_LOG_DIR / UI_CHAT_DATABASE_DIR.",
  };
};

export const resolveManagedCodeGraphPlannerConfig = (workspaceRoot: string) => {
  const workspaceHash = createManagedCodeGraphWorkspaceHash(workspaceRoot);
  const storage = resolveManagedCodeGraphPlannerStorage(workspaceHash);

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
    storage,
    logRoot: storage.logRoot,
    indexRoot: storage.indexRoot,
  };
};
