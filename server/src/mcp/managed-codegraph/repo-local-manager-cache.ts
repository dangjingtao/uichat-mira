import path from "node:path";

import {
  canUseDeclaredRepoLocalCodeGraphCapability,
  type RepoLocalCodeGraphGate,
} from "./repo-local-capability.js";
import { ManagedCodeGraphProcessManager } from "./repo-local-process-manager.js";

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
 * Runtime ownership is workspace-scoped. Studio smoke owns its own binding, while
 * Agent calls for the same active workspace share one managed runtime regardless
 * of conversation/thread. Provider configuration changes are handled by the
 * runtime fingerprint and replace the cached manager when necessary.
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
    !context.draft.command.trim() ||
    !context.plannerStorage.logRoot ||
    !context.plannerStorage.indexRoot
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

  // The CodeGraph microapp supplies provider configuration only. Every Agent
  // invocation binds that configuration to the active workspace selected by the
  // conversation. The Studio debug workspace is never an Agent authorization or
  // ownership boundary.
  //
  // A repo-pollution guard is meaningful only when the provider explicitly says
  // it cannot relocate its index and therefore requires the declared repo-local
  // `.codegraph` path. Providers with external-index support must not be blocked
  // merely because the target workspace already contains a `.codegraph` folder.
  const repoPollutionGuard =
    context.externalIndexSupport.status === "blocked"
      ? {
          status: context.externalIndexSupport.status,
          repoDataDirName: context.externalIndexSupport.repoDataDirName,
          blockedReason: context.externalIndexSupport.reason,
        }
      : undefined;

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
    ...(repoPollutionGuard ? { repoPollutionGuard } : {}),
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
  _threadId?: string,
) => {
  if (!access.microAppEnabled) {
    return null;
  }

  // A CodeGraph microapp configuration is global provider configuration. Agent
  // conversations may bind it to any active workspace; threads sharing a
  // workspace reuse the same healthy runtime/index instead of spawning one
  // process per conversation.
  return await getOrCreateRepoLocalManager(
    workspaceRoot,
    context,
    "agent-workspace",
  );
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
