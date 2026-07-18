import path from "node:path";

import {
  ManagedCodeGraphProcessManager as BaseManagedCodeGraphProcessManager,
  createManagedCodeGraphWorkspaceHash,
} from "./managed-codegraph-process-manager.js";
import type { ManagedCodeGraphProcessManagerOptions } from "./types.js";

const DEFAULT_REPO_DATA_DIR_NAME = ".codegraph";
const DECLARED_REPO_LOCAL_REASON =
  /external index|index-root|workspace[\\/].*\.codegraph|serve --mcp/i;

export const isRealCodeGraphCommand = (command: string) => {
  const normalized = command.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  const baseName = path.basename(normalized);
  return (
    baseName === "codegraph" ||
    baseName === "codegraph.cmd" ||
    baseName === "codegraph.exe"
  );
};

/**
 * CodeGraph 1.3.x only supports a workspace-local `.codegraph` index. The owner
 * still has to enable the controlled Agent capability, telemetry must remain
 * verified off, and workspace verification still applies. This helper only
 * converts that one known storage shape from a hard pollution block into
 * declared repo-local runtime data.
 */
export const shouldAllowDeclaredRepoLocalCodeGraphData = (
  options: ManagedCodeGraphProcessManagerOptions,
) => {
  const guard = options.repoPollutionGuard;
  const repoDataDirName =
    guard?.repoDataDirName.trim() || DEFAULT_REPO_DATA_DIR_NAME;
  const knownStorageConstraint =
    guard?.status === "ready" ||
    DECLARED_REPO_LOCAL_REASON.test(guard?.blockedReason ?? "");

  return (
    isRealCodeGraphCommand(options.command) &&
    repoDataDirName === DEFAULT_REPO_DATA_DIR_NAME &&
    knownStorageConstraint
  );
};

const normalizeRepoLocalOptions = (
  options: ManagedCodeGraphProcessManagerOptions,
): ManagedCodeGraphProcessManagerOptions => {
  if (!shouldAllowDeclaredRepoLocalCodeGraphData(options)) {
    return options;
  }

  return {
    ...options,
    // Base manager keeps its strict default for every other provider. The real
    // CodeGraph command is the only declared exception because its index path
    // cannot currently be relocated outside the workspace.
    repoPollutionGuard: undefined,
    env: {
      ...options.env,
      UI_CHAT_CODEGRAPH_REPO_LOCAL_DATA: "declared",
    },
  };
};

export class ManagedCodeGraphProcessManager extends BaseManagedCodeGraphProcessManager {
  constructor(options: ManagedCodeGraphProcessManagerOptions) {
    super(normalizeRepoLocalOptions(options));
  }
}

export { createManagedCodeGraphWorkspaceHash };
