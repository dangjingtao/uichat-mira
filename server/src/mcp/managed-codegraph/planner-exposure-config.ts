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

type ManagedCodeGraphExternalIndexSupport = {
  status: "ready" | "blocked";
  externalIndexRootSupported: boolean;
  repoDataDirName: string;
  reason: string | null;
  investigation: {
    cliArgSupported: boolean;
    envPathSupported: boolean;
    configFilePathSupported: boolean;
    cwdProjectSeparationSupported: boolean;
    serveMcpProjectIndexSeparationSupported: boolean;
    dataDirEnvName: string | null;
  };
};

const DEFAULT_REPO_DATA_DIR_NAME = ".codegraph";

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

const isLikelyRealCodeGraphCommand = (command: string) => {
  const normalized = command.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  const baseName = path.basename(normalized);
  return baseName === "codegraph" || baseName === "codegraph.cmd" || baseName === "codegraph.exe";
};

const resolveManagedCodeGraphExternalIndexSupport = (
  command: string,
): ManagedCodeGraphExternalIndexSupport => {
  if (!isLikelyRealCodeGraphCommand(command)) {
    return {
      status: "ready",
      externalIndexRootSupported: true,
      repoDataDirName: DEFAULT_REPO_DATA_DIR_NAME,
      reason: null,
      investigation: {
        cliArgSupported: false,
        envPathSupported: false,
        configFilePathSupported: false,
        cwdProjectSeparationSupported: true,
        serveMcpProjectIndexSeparationSupported: false,
        dataDirEnvName: null,
      },
    };
  }

  return {
    status: "blocked",
    externalIndexRootSupported: false,
    repoDataDirName: DEFAULT_REPO_DATA_DIR_NAME,
    reason:
      "CodeGraph 1.3.0 does not provide a reliable external index root. `serve --mcp` has no index-root CLI flag, `CODEGRAPH_DIR` only accepts a single directory name inside the project root, and current docs/source do not expose a config-file path override for repo-external index data. Managed CodeGraph must stay blocked because using the real provider would require a repo-root .codegraph directory.",
    investigation: {
      cliArgSupported: false,
      envPathSupported: false,
      configFilePathSupported: false,
      cwdProjectSeparationSupported: true,
      serveMcpProjectIndexSeparationSupported: false,
      dataDirEnvName: "CODEGRAPH_DIR",
    },
  };
};

export const resolveManagedCodeGraphPlannerConfig = (workspaceRoot: string) => {
  const workspaceHash = createManagedCodeGraphWorkspaceHash(workspaceRoot);
  const storage = resolveManagedCodeGraphPlannerStorage(workspaceHash);
  const command = (process.env.UI_CHAT_CODEGRAPH_COMMAND ?? "codegraph").trim();
  const externalIndexSupport = resolveManagedCodeGraphExternalIndexSupport(command);

  return {
    command,
    startArgs: parseJsonArrayEnv(
      process.env.UI_CHAT_CODEGRAPH_START_ARGS,
      ["serve", "--mcp"],
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
    externalIndexSupport,
    logRoot: storage.logRoot,
    indexRoot: storage.indexRoot,
  };
};
