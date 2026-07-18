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

export type ManagedCodeGraphPlannerStorageSource =
  | "explicit_app_data_root"
  | "log_dir_parent"
  | "database_dir_parent"
  | "unresolved";

export type ManagedCodeGraphPlannerStorage = {
  status: "ready" | "blocked";
  source: ManagedCodeGraphPlannerStorageSource;
  appDataRoot: string | null;
  logRoot: string | null;
  indexRoot: string | null;
  reason: string | null;
};

export type ManagedCodeGraphExternalIndexSupport = {
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

export const createManagedCodeGraphPlannerStorageFromAppDataRoot = (
  workspaceHash: string,
  appDataRoot: string | null,
): ManagedCodeGraphPlannerStorage => {
  if (!appDataRoot?.trim()) {
    return {
      status: "blocked",
      source: "unresolved",
      appDataRoot: null,
      logRoot: null,
      indexRoot: null,
      reason:
        "Managed CodeGraph planner exposure requires an app-data root. Set UI_CHAT_CODEGRAPH_APP_DATA_ROOT or provide an absolute UI_CHAT_LOG_DIR / UI_CHAT_DATABASE_DIR.",
    };
  }

  const resolvedRoot = path.resolve(appDataRoot.trim());
  const artifactRoot = path.join(resolvedRoot, "managed-codegraph", workspaceHash);
  return {
    status: "ready",
    source: "explicit_app_data_root",
    appDataRoot: resolvedRoot,
    logRoot: path.join(artifactRoot, "logs"),
    indexRoot: path.join(artifactRoot, "index"),
    reason: null,
  };
};

export const resolveManagedCodeGraphPlannerStorage = (
  workspaceHash: string,
): ManagedCodeGraphPlannerStorage => {
  const explicitRoot = toAbsoluteIfPresent(process.env.UI_CHAT_CODEGRAPH_APP_DATA_ROOT);
  if (explicitRoot) {
    return createManagedCodeGraphPlannerStorageFromAppDataRoot(
      workspaceHash,
      explicitRoot,
    );
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

export const resolveManagedCodeGraphExternalIndexSupport = (
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
    status: "ready",
    externalIndexRootSupported: false,
    repoDataDirName: DEFAULT_REPO_DATA_DIR_NAME,
    reason:
      "CodeGraph 1.3.x stores its index in workspace/.codegraph because serve --mcp does not expose a reliable external index-root override. UIChat Mira treats that directory as declared repo-local runtime data for the controlled codebase_explore capability; logs and other managed artifacts remain outside the workspace.",
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
