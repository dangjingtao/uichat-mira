import path from "node:path";

import {
  canUseDeclaredRepoLocalCodeGraphCapability,
  type RepoLocalCodeGraphGate,
} from "./repo-local-capability.js";
import {
  isRealCodeGraphCommand,
  ManagedCodeGraphProcessManager,
} from "./repo-local-process-manager.js";

export type RepoLocalRuntimeContext = {
  draft: {
    command: string;
    startArgs: string[];
    versionProbeArgs: string[];
    telemetryProbeArgs: string[];
    timeoutMs: number;
  };
  plannerStorage: {
    logRoot: string | null;
    indexRoot: string | null;
  };
  externalIndexSupport: {
    status: "ready" | "blocked";
    repoDataDirName: string;
    reason: string | null;
  };
};

export type RepoLocalManagedContext = RepoLocalRuntimeContext & {
  gate: RepoLocalCodeGraphGate;
};

type CachedRepoLocalManager = {
  fingerprint: string;
  manager: ManagedCodeGraphProcessManager;
};

const repoLocalManagerCache = new Map<string, CachedRepoLocalManager>();

const normalizeWorkspaceRoot = (workspaceRoot: string) => {
  const resolved = path.resolve(workspaceRoot).replace(/[\\/]+$/, "");
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
};

/**
 * Runtime ownership is scoped to the caller binding plus workspace root.
 * Agent callers use thread:<threadId>; Studio smoke uses studio. The lower-level
 * process manager may still share one healthy provider process for the same project.
 */
export const createRepoLocalManagerCacheKey = (
  workspaceRoot: string,
  bindingKey = "workspace",
) => `${bindingKey.trim() || "workspace"}::${normalizeWorkspaceRoot(workspaceRoot)}`;

const isPathInside = (parent: string, candidate: string) => {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
};

const createRepoLocalRuntimeFingerprint = (
  workspaceRoot: string,
  context: RepoLocalRuntimeContext,
) =>
  JSON.stringify({
    workspaceRoot: normalizeWorkspaceRoot(workspaceRoot),
    command: context.draft.command,
    startArgs: context.draft.startArgs,
    versionProbeArgs: context.draft.versionProbeArgs,
    telemetryProbeArgs: context.draft.telemetryProbeArgs,
    logRoot: context.plannerStorage.logRoot,
    indexRoot: context.plannerStorage.indexRoot,
    timeoutMs: context.draft.timeoutMs,
  });

const getOrCreateRepoLocalManager = async (
  workspaceRoot: string,
  context: RepoLocalRuntimeContext,
  bindingKey?: string,
) => {
  if (
    !context.plannerStorage.logRoot ||
    !context.plannerStorage.indexRoot ||
    !isRealCodeGraphCommand(context.draft.command)
  ) {
    return null;
  }

  if (
    isPathInside(workspaceRoot, context.plannerStorage.logRoot) ||
    isPathInside(workspaceRoot, context.plannerStorage.indexRoot)
  ) {
    return null;
  }

  const fingerprint = createRepoLocalRuntimeFingerprint(workspaceRoot, context);
  const cacheKey = createRepoLocalManagerCacheKey(workspaceRoot, bindingKey);
  const cached = repoLocalManagerCache.get(cacheKey);
  if (cached?.fingerprint === fingerprint) {
    return cached.manager;
  }

  if (cached) {
    await cached.manager.dispose();
    repoLocalManagerCache.delete(cacheKey);
  }

  const manager = new ManagedCodeGraphProcessManager({
    command: context.draft.command,
    startArgs: [...context.draft.startArgs],
    versionProbe: {
      args: [...context.draft.versionProbeArgs],
    },
    telemetryProbe: {
      args: [...context.draft.telemetryProbeArgs],
    },
    runtimeFingerprint: fingerprint,
    workspaceRoot,
    allowedWorkspaceRoot: workspaceRoot,
    logRoot: context.plannerStorage.logRoot,
    indexRoot: context.plannerStorage.indexRoot,
    startTimeoutMs: context.draft.timeoutMs,
    healthTimeoutMs: context.draft.timeoutMs,
    stopTimeoutMs: context.draft.timeoutMs,
    repoPollutionGuard: {
      status: context.externalIndexSupport.status,
      repoDataDirName: context.externalIndexSupport.repoDataDirName,
      blockedReason: context.externalIndexSupport.reason,
    },
  });

  repoLocalManagerCache.set(cacheKey, {
    fingerprint,
    manager,
  });
  return manager;
};

export const getRepoLocalManagedCodeGraphManager = async (
  workspaceRoot: string,
  context: RepoLocalManagedContext,
) => {
  if (!canUseDeclaredRepoLocalCodeGraphCapability(context.gate)) {
    return null;
  }
  return await getOrCreateRepoLocalManager(workspaceRoot, context);
};

export const getRepoLocalManagedCodeGraphManagerForAgentWorkspace = async (
  workspaceRoot: string,
  context: RepoLocalRuntimeContext,
  access: {
    microAppEnabled: boolean;
    /** Legacy compatibility only; product access now follows microAppEnabled. */
    agentCapabilityEnabled: boolean;
  },
  threadId?: string,
) => {
  if (!access.microAppEnabled) {
    return null;
  }
  const bindingKey = threadId?.trim()
    ? `thread:${threadId.trim()}`
    : "agent-workspace";
  return await getOrCreateRepoLocalManager(workspaceRoot, context, bindingKey);
};

/**
 * Studio smoke validates the runtime itself and therefore does not depend on
 * the product enable switch that grants Planner access to `codebase_explore`.
 */
export const getRepoLocalManagedCodeGraphManagerForStudio = async (
  workspaceRoot: string,
  context: RepoLocalRuntimeContext,
) => await getOrCreateRepoLocalManager(workspaceRoot, context, "studio");

export const disposeRepoLocalManagedCodeGraphManagers = async () => {
  const managers = [...repoLocalManagerCache.values()].map((entry) => entry.manager);
  repoLocalManagerCache.clear();
  await Promise.allSettled(managers.map(async (manager) => await manager.dispose()));
};

export const getRepoLocalManagedCodeGraphManagerCount = () =>
  repoLocalManagerCache.size;
