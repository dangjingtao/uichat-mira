import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import CONFIG from "@/config/index.js";
import {
  ManagedCodeGraphProcessManager,
  createManagedCodeGraphPlannerStorageFromAppDataRoot,
  createManagedCodeGraphWorkspaceHash,
  resolveManagedCodeGraphExternalIndexSupport,
  resolveManagedCodeGraphPlannerConfig,
  type ManagedCodeGraphDetectResult,
  type ManagedCodeGraphExternalIndexSupport,
  type ManagedCodeGraphPlannerStorage,
  type ManagedCodeGraphRepoPollutionGuard,
  type ManagedCodeGraphStatusSnapshot,
} from "@/mcp/managed-codegraph/index.js";
import { badRequest } from "@/utils/route-errors.js";

export type CodeGraphStudioStatus =
  | "ready"
  | "blocked"
  | "unavailable"
  | "degraded"
  | "stopped";

export type CodeGraphStudioBlockedReasonCode =
  | "external_index_root_unsupported"
  | "repo_pollution_risk"
  | "telemetry_not_verified_off"
  | "app_data_root_unavailable"
  | "provider_missing";

export type CodeGraphStudioConfigDraft = {
  microAppEnabled: boolean;
  agentCapabilityEnabled: boolean;
  command: string;
  startArgs: string[];
  versionProbeArgs: string[];
  telemetryProbeArgs: string[];
  appDataRoot: string;
  timeoutMs: number;
  maxResults: number;
  queryLimit: number;
};

export type CodeGraphStudioConfig = CodeGraphStudioConfigDraft & {
  workspaceRoot: string;
  appDataRootResolved: string | null;
  logRoot: string | null;
  indexRoot: string | null;
  capabilityRegistered: boolean;
};

export type CodeGraphStudioCapabilityGateReasonCode =
  | "microapp_disabled"
  | "agent_capability_disabled"
  | "runtime_not_ready"
  | "telemetry_not_verified_off"
  | "workspace_mismatch"
  | "repo_pollution_risk"
  | "app_data_root_unavailable"
  | "registration_unavailable";

export type CodeGraphStudioCapabilityGate = {
  available: boolean;
  registered: boolean;
  reasons: Array<{
    code: CodeGraphStudioCapabilityGateReasonCode;
    message: string;
  }>;
  checks: {
    microAppEnabled: boolean;
    agentCapabilityEnabled: boolean;
    runtimeReady: boolean;
    telemetryVerifiedOff: boolean;
    workspaceMatched: boolean;
    repoPollutionSafe: boolean;
    appDataRootValid: boolean;
    capabilityRegistrationReady: boolean;
  };
};

type CodeGraphCapabilityStatusSource = {
  status: ManagedCodeGraphStatusSnapshot["status"];
  telemetryStatus?: ManagedCodeGraphStatusSnapshot["telemetryStatus"];
  workspaceMatches?: boolean;
} | null;

type CodeGraphStudioSnapshotShape = {
  status: ManagedCodeGraphStatusSnapshot["status"];
  telemetryStatus: ManagedCodeGraphStatusSnapshot["telemetryStatus"];
  workspaceMatches: boolean;
  providerVersion: string | null;
  handshakeStatus: ManagedCodeGraphStatusSnapshot["handshakeStatus"];
  initializedNotificationSent: boolean;
  processAlive: boolean;
  startedAt: number | null;
  stoppedAt: number | null;
  durationMs: number | null;
  exitCode: number | null;
  lastStatus: ManagedCodeGraphStatusSnapshot["lastStatus"];
  lastError: string | null;
  crashCount: number;
  startDisposition: string | null;
};

type CodeGraphRuntimeConfigFields = Pick<
  CodeGraphStudioConfigDraft,
  | "command"
  | "startArgs"
  | "versionProbeArgs"
  | "telemetryProbeArgs"
  | "appDataRoot"
  | "timeoutMs"
>;

type CodeGraphRuntimeTransitionState =
  | {
      inProgress: false;
      reason: null;
    }
  | {
      inProgress: true;
      reason: "reconfiguring" | "stopping";
    };

export type CodeGraphStudioBlockedReason = {
  code: CodeGraphStudioBlockedReasonCode;
  label: string;
  message: string;
};

export type CodeGraphStudioPollutionGuard = {
  status: "ready" | "blocked";
  repoDataDirName: string;
  repoDataDirPath: string;
  exists: boolean;
  blockedReason: string | null;
};

export type CodeGraphStudioDebugReport = {
  workspaceHash: string;
  plannerStorage: ManagedCodeGraphPlannerStorage;
  externalIndexSupport: ManagedCodeGraphExternalIndexSupport;
  detectReasons: string[];
  rawManagerStatus: ManagedCodeGraphStatusSnapshot["status"];
};

export type CodeGraphStudioRuntimeReport = {
  providerVersion: string | null;
  telemetryStatus: ManagedCodeGraphStatusSnapshot["telemetryStatus"];
  handshakeStatus: ManagedCodeGraphStatusSnapshot["handshakeStatus"];
  initializedNotificationSent: boolean;
  processAlive: boolean;
  startedAt: number | null;
  stoppedAt: number | null;
  durationMs: number | null;
  exitCode: number | null;
  lastStatus: ManagedCodeGraphStatusSnapshot["lastStatus"];
  lastError: string | null;
  crashCount: number;
  startDisposition: string | null;
};

export type CodeGraphStudioReport = {
  status: CodeGraphStudioStatus;
  blockedReasons: CodeGraphStudioBlockedReason[];
  config: CodeGraphStudioConfig;
  capability: CodeGraphStudioCapabilityGate;
  pollutionGuard: CodeGraphStudioPollutionGuard;
  runtime: CodeGraphStudioRuntimeReport;
  debug: CodeGraphStudioDebugReport;
};

export type CodeGraphStudioSmokeResult = {
  kind: "status" | "query";
  ok: boolean;
  message: string;
  payload: unknown;
  report: CodeGraphStudioReport;
};

type CodeGraphStudioStatusSource =
  | ManagedCodeGraphDetectResult
  | ManagedCodeGraphStatusSnapshot
  | {
      status: ManagedCodeGraphStatusSnapshot["status"];
      providerVersion?: string | null;
      telemetryStatus?: ManagedCodeGraphStatusSnapshot["telemetryStatus"];
      handshakeStatus?: ManagedCodeGraphStatusSnapshot["handshakeStatus"];
      initializedNotificationSent?: boolean;
      processAlive?: boolean;
      startedAt?: number | null;
      stoppedAt?: number | null;
      durationMs?: number | null;
      exitCode?: number | null;
      lastStatus?: ManagedCodeGraphStatusSnapshot["lastStatus"];
      lastError?: string | null;
      crashCount?: number;
      startDisposition?: string | null;
    };

const DEFAULT_TIMEOUT_MS = 2_000;
const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_QUERY_LIMIT = 5;
const DEFAULT_REPO_DATA_DIR_NAME = ".codegraph";

const normalizeText = (value: string | undefined, fallback = "") =>
  value?.trim() || fallback;

const normalizeStringArray = (value: unknown, fallback: string[]) => {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizePositiveNumber = (value: unknown, fallback: number) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const next = Math.trunc(value);
  return next > 0 ? next : fallback;
};

const normalizeBoolean = (value: unknown, fallback: boolean) => {
  if (typeof value !== "boolean") {
    return fallback;
  }

  return value;
};

const toComparableRuntimeConfig = (
  draft: CodeGraphStudioConfigDraft,
): CodeGraphRuntimeConfigFields => ({
  command: draft.command,
  startArgs: [...draft.startArgs],
  versionProbeArgs: [...draft.versionProbeArgs],
  telemetryProbeArgs: [...draft.telemetryProbeArgs],
  appDataRoot: draft.appDataRoot,
  timeoutMs: draft.timeoutMs,
});

const hasRuntimeConfigChanged = (
  current: CodeGraphStudioConfigDraft,
  next: CodeGraphStudioConfigDraft,
) =>
  JSON.stringify(toComparableRuntimeConfig(current)) !==
  JSON.stringify(toComparableRuntimeConfig(next));

const createRuntimeFingerprint = (input: {
  command: string;
  startArgs: string[];
  versionProbeArgs: string[];
  telemetryProbeArgs: string[];
  workspaceRoot: string;
  logRoot: string;
  indexRoot: string;
  timeoutMs: number;
}) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        command: input.command,
        startArgs: input.startArgs,
        versionProbeArgs: input.versionProbeArgs,
        telemetryProbeArgs: input.telemetryProbeArgs,
        workspaceRoot: normalizeComparablePath(input.workspaceRoot),
        logRoot: normalizeComparablePath(input.logRoot),
        indexRoot: normalizeComparablePath(input.indexRoot),
        timeoutMs: input.timeoutMs,
      }),
    )
    .digest("hex");

const parseJsonFile = <T>(filePath: string, fallback: T): T => {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
};

const ensureDirectory = (targetPath: string) => {
  fs.mkdirSync(targetPath, { recursive: true });
};

const normalizeComparablePath = (targetPath: string) => {
  const resolved = path.resolve(targetPath).replace(/[\\/]+$/, "");
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
};

const isSamePath = (leftPath: string, rightPath: string) =>
  normalizeComparablePath(leftPath) === normalizeComparablePath(rightPath);

const isPathInside = (candidatePath: string, containerPath: string) => {
  const relativePath = path.relative(
    normalizeComparablePath(containerPath),
    normalizeComparablePath(candidatePath),
  );

  return (
    relativePath.length > 0 &&
    !relativePath.startsWith("..") &&
    !path.isAbsolute(relativePath)
  );
};

const validateAppDataRoot = (
  appDataRoot: string,
  workspaceRoot: string,
  repoDataDirPath: string,
) => {
  const trimmed = appDataRoot.trim();
  if (!trimmed) {
    return {
      appDataRootResolved: null,
      error: null,
    };
  }

  const appDataRootResolved = path.resolve(trimmed);
  if (!path.isAbsolute(appDataRootResolved)) {
    return {
      appDataRootResolved,
      error: "App Data Root must resolve to an absolute path.",
    };
  }

  if (
    isSamePath(appDataRootResolved, repoDataDirPath) ||
    isPathInside(appDataRootResolved, repoDataDirPath)
  ) {
    return {
      appDataRootResolved,
      error: "App Data Root cannot point to repo-root `.codegraph` or any path inside it.",
    };
  }

  if (isSamePath(appDataRootResolved, workspaceRoot)) {
    return {
      appDataRootResolved,
      error: "App Data Root cannot be the workspace root.",
    };
  }

  if (isPathInside(appDataRootResolved, workspaceRoot)) {
    return {
      appDataRootResolved,
      error: "App Data Root must stay outside the workspace root.",
    };
  }

  return {
    appDataRootResolved,
    error: null,
  };
};

const resolveDatabaseDir = () => {
  const rawDatabaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  if (rawDatabaseUrl.startsWith("file:")) {
    const filePath = rawDatabaseUrl.slice("file:".length);
    if (filePath) {
      return path.dirname(path.resolve(filePath));
    }
  }

  return path.resolve(process.cwd(), CONFIG.DATABASE_DIR);
};

const resolveStudioStorageRoot = () =>
  path.join(resolveDatabaseDir(), "microapps", "codegraph-studio");

const createDefaultDraft = (workspaceRoot: string): CodeGraphStudioConfigDraft => {
  const plannerConfig = resolveManagedCodeGraphPlannerConfig(workspaceRoot);
  return {
    microAppEnabled: true,
    agentCapabilityEnabled: false,
    command: plannerConfig.command,
    startArgs: [...plannerConfig.startArgs],
    versionProbeArgs: [...plannerConfig.versionProbeArgs],
    telemetryProbeArgs: [...plannerConfig.telemetryProbeArgs],
    appDataRoot: plannerConfig.storage.appDataRoot ?? "",
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxResults: DEFAULT_MAX_RESULTS,
    queryLimit: DEFAULT_QUERY_LIMIT,
  };
};

const toBlockedReason = (
  code: CodeGraphStudioBlockedReasonCode,
  message: string,
): CodeGraphStudioBlockedReason => ({
  code,
  message,
  label: code
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" "),
});

export const createCodeGraphStudioService = (options?: {
  workspaceRoot?: string;
  storageRoot?: string;
  onStateChanged?: () => void;
  getCapabilityRegistrationState?: () => boolean;
}) => {
  const workspaceRoot = path.resolve(options?.workspaceRoot ?? process.cwd());
  const storageRoot = path.resolve(options?.storageRoot ?? resolveStudioStorageRoot());
  const onStateChanged = options?.onStateChanged;
  const getCapabilityRegistrationState =
    options?.getCapabilityRegistrationState ?? (() => false);
  const workspaceHash = createManagedCodeGraphWorkspaceHash(workspaceRoot);
  const configFilePath = path.join(storageRoot, `${workspaceHash}.json`);
  let manager: ManagedCodeGraphProcessManager | null = null;
  let latestCapabilityStatusSource: CodeGraphCapabilityStatusSource = null;
  let runtimeTransitionState: CodeGraphRuntimeTransitionState = {
    inProgress: false,
    reason: null,
  };

  const updateLatestCapabilityStatusSource = (snapshot: {
    status: ManagedCodeGraphStatusSnapshot["status"];
    telemetryStatus?: ManagedCodeGraphStatusSnapshot["telemetryStatus"];
    workspaceMatches?: boolean;
  } | null) => {
    latestCapabilityStatusSource = snapshot
      ? {
          status: snapshot.status,
          telemetryStatus: snapshot.telemetryStatus,
          workspaceMatches: snapshot.workspaceMatches,
        }
      : null;
  };

  const setRuntimeTransitionState = (
    nextState: CodeGraphRuntimeTransitionState,
    options?: { clearSnapshot?: boolean },
  ) => {
    runtimeTransitionState = nextState;
    if (options?.clearSnapshot) {
      updateLatestCapabilityStatusSource(null);
    }
    onStateChanged?.();
  };

  const handleManagerStatusChanged = (snapshot: ManagedCodeGraphStatusSnapshot) => {
    updateLatestCapabilityStatusSource(snapshot);
    if (!snapshot.processAlive && manager?.getStatus().workspaceHash === snapshot.workspaceHash) {
      const managerLifecycleClosed =
        snapshot.status === "failed" ||
        (snapshot.status === "stopped" && snapshot.startedAt !== null);
      if (managerLifecycleClosed) {
        manager = null;
      }
    }
    onStateChanged?.();
  };

  const getDraft = (): CodeGraphStudioConfigDraft => {
    const defaults = createDefaultDraft(workspaceRoot);
    const saved = parseJsonFile<Partial<CodeGraphStudioConfigDraft>>(configFilePath, {});
    return {
      microAppEnabled: normalizeBoolean(saved.microAppEnabled, defaults.microAppEnabled),
      agentCapabilityEnabled: normalizeBoolean(
        saved.agentCapabilityEnabled,
        defaults.agentCapabilityEnabled,
      ),
      command: normalizeText(saved.command, defaults.command),
      startArgs: normalizeStringArray(saved.startArgs, defaults.startArgs),
      versionProbeArgs: normalizeStringArray(
        saved.versionProbeArgs,
        defaults.versionProbeArgs,
      ),
      telemetryProbeArgs: normalizeStringArray(
        saved.telemetryProbeArgs,
        defaults.telemetryProbeArgs,
      ),
      appDataRoot: normalizeText(saved.appDataRoot, defaults.appDataRoot),
      timeoutMs: normalizePositiveNumber(saved.timeoutMs, defaults.timeoutMs),
      maxResults: normalizePositiveNumber(saved.maxResults, defaults.maxResults),
      queryLimit: normalizePositiveNumber(saved.queryLimit, defaults.queryLimit),
    };
  };

  const buildRuntimeConfig = (draft = getDraft()) => {
    const plannerConfig = resolveManagedCodeGraphPlannerConfig(workspaceRoot);
    const externalIndexSupport = resolveManagedCodeGraphExternalIndexSupport(
      draft.command,
    );
    const repoDataDirName =
      externalIndexSupport.repoDataDirName.trim() || DEFAULT_REPO_DATA_DIR_NAME;
    const repoDataDirPath = path.join(workspaceRoot, repoDataDirName);
    const appDataRootValidation = validateAppDataRoot(
      draft.appDataRoot,
      workspaceRoot,
      repoDataDirPath,
    );
    const appDataRootResolved = draft.appDataRoot
      ? appDataRootValidation.appDataRootResolved
      : plannerConfig.storage.appDataRoot;
    const plannerStorage =
      appDataRootValidation.error && appDataRootValidation.appDataRootResolved
        ? {
            status: "blocked" as const,
            source: "unresolved" as const,
            appDataRoot: appDataRootValidation.appDataRootResolved,
            logRoot: null,
            indexRoot: null,
            reason: appDataRootValidation.error,
          }
        : appDataRootResolved
          ? createManagedCodeGraphPlannerStorageFromAppDataRoot(
              workspaceHash,
              appDataRootResolved,
            )
          : plannerConfig.storage;
    const pollutionGuard: CodeGraphStudioPollutionGuard = {
      status:
        externalIndexSupport.status === "blocked" ? "blocked" : "ready",
      repoDataDirName,
      repoDataDirPath,
      exists: fs.existsSync(repoDataDirPath),
      blockedReason: externalIndexSupport.reason,
    };

    return {
      draft,
      plannerStorage,
      externalIndexSupport,
      pollutionGuard,
      runtimeFingerprint:
        plannerStorage.logRoot && plannerStorage.indexRoot
          ? createRuntimeFingerprint({
              command: draft.command,
              startArgs: draft.startArgs,
              versionProbeArgs: draft.versionProbeArgs,
              telemetryProbeArgs: draft.telemetryProbeArgs,
              workspaceRoot,
              logRoot: plannerStorage.logRoot,
              indexRoot: plannerStorage.indexRoot,
              timeoutMs: draft.timeoutMs,
            })
          : null,
      config: {
        workspaceRoot,
        appDataRootResolved,
        logRoot: plannerStorage.logRoot,
        indexRoot: plannerStorage.indexRoot,
        microAppEnabled: draft.microAppEnabled,
        agentCapabilityEnabled: draft.agentCapabilityEnabled,
        capabilityRegistered: getCapabilityRegistrationState(),
      } satisfies Omit<
        CodeGraphStudioConfig,
        | "command"
        | "startArgs"
        | "versionProbeArgs"
        | "telemetryProbeArgs"
        | "appDataRoot"
        | "timeoutMs"
        | "maxResults"
        | "queryLimit"
      >,
    };
  };

  const toRepoPollutionGuard = (
    report: ReturnType<typeof buildRuntimeConfig>,
  ): ManagedCodeGraphRepoPollutionGuard => ({
    status: report.externalIndexSupport.status,
    repoDataDirName: report.pollutionGuard.repoDataDirName,
    blockedReason: report.externalIndexSupport.reason,
  });

  const ensureManager = () => {
    if (runtimeTransitionState.inProgress) {
      return null;
    }

    const runtime = buildRuntimeConfig();
    if (!runtime.plannerStorage.logRoot || !runtime.plannerStorage.indexRoot) {
      manager = null;
      return null;
    }

    if (
      manager &&
      manager.getRuntimeFingerprint() === runtime.runtimeFingerprint &&
      manager.getStatus().workspaceRoot === workspaceRoot &&
      manager.getStatus().logRoot === runtime.plannerStorage.logRoot &&
      manager.getStatus().indexRoot === runtime.plannerStorage.indexRoot
    ) {
      return manager;
    }

    manager = new ManagedCodeGraphProcessManager({
      command: runtime.draft.command,
      startArgs: runtime.draft.startArgs,
      versionProbe: {
        args: runtime.draft.versionProbeArgs,
      },
      telemetryProbe: {
        args: runtime.draft.telemetryProbeArgs,
      },
      runtimeFingerprint: runtime.runtimeFingerprint ?? undefined,
      workspaceRoot,
      allowedWorkspaceRoot: workspaceRoot,
      logRoot: runtime.plannerStorage.logRoot,
      indexRoot: runtime.plannerStorage.indexRoot,
      startTimeoutMs: runtime.draft.timeoutMs,
      healthTimeoutMs: runtime.draft.timeoutMs,
      stopTimeoutMs: runtime.draft.timeoutMs,
      repoPollutionGuard: toRepoPollutionGuard(runtime),
      onStatusChanged: handleManagerStatusChanged,
    });
    return manager;
  };

  const mapStudioStatus = (
    rawStatus: ManagedCodeGraphStatusSnapshot["status"] | ManagedCodeGraphDetectResult["status"],
  ): CodeGraphStudioStatus => {
    if (rawStatus === "ready") {
      return "ready";
    }
    if (rawStatus === "blocked") {
      return "blocked";
    }
    if (rawStatus === "unavailable") {
      return "unavailable";
    }
    if (rawStatus === "stopped") {
      return "stopped";
    }
    return "degraded";
  };

  const buildCapabilityGate = (
    runtime: ReturnType<typeof buildRuntimeConfig>,
    statusSource?: CodeGraphCapabilityStatusSource,
    requestedWorkspaceRoot?: string,
  ): CodeGraphStudioCapabilityGate => {
    if (runtimeTransitionState.inProgress) {
      return {
        available: false,
        registered: false,
        reasons: [
          {
            code: "runtime_not_ready",
            message:
              runtimeTransitionState.reason === "reconfiguring"
                ? "CodeGraph runtime is reconfiguring."
                : "CodeGraph runtime is stopping.",
          },
        ],
        checks: {
          microAppEnabled: runtime.draft.microAppEnabled,
          agentCapabilityEnabled: runtime.draft.agentCapabilityEnabled,
          runtimeReady: false,
          telemetryVerifiedOff: false,
          workspaceMatched: requestedWorkspaceRoot
            ? isSamePath(requestedWorkspaceRoot, workspaceRoot)
            : true,
          repoPollutionSafe:
            runtime.externalIndexSupport.status === "ready" &&
            !runtime.pollutionGuard.exists &&
            runtime.pollutionGuard.status === "ready",
          appDataRootValid: runtime.plannerStorage.status === "ready",
          capabilityRegistrationReady: false,
        },
      };
    }

    const activeManager = ensureManager();
    const snapshot =
      statusSource ??
      activeManager?.getStatus() ??
      latestCapabilityStatusSource ??
      null;
    const workspaceMatched = requestedWorkspaceRoot
      ? isSamePath(requestedWorkspaceRoot, workspaceRoot)
      : (snapshot?.workspaceMatches ?? true);
    const runtimeReady = snapshot?.status === "ready";
    const telemetryVerifiedOff = snapshot?.telemetryStatus === "verified_off";
    const repoPollutionSafe =
      runtime.externalIndexSupport.status === "ready" &&
      !runtime.pollutionGuard.exists &&
      runtime.pollutionGuard.status === "ready";
    const appDataRootValid = runtime.plannerStorage.status === "ready";
    const capabilityRegistrationReady =
      runtime.draft.microAppEnabled &&
      runtime.draft.agentCapabilityEnabled &&
      runtimeReady &&
      telemetryVerifiedOff &&
      workspaceMatched &&
      repoPollutionSafe &&
      appDataRootValid;
    const reasons: CodeGraphStudioCapabilityGate["reasons"] = [];

    if (!runtime.draft.microAppEnabled) {
      reasons.push({
        code: "microapp_disabled",
        message: "CodeGraph microapp is disabled.",
      });
    }
    if (!runtime.draft.agentCapabilityEnabled) {
      reasons.push({
        code: "agent_capability_disabled",
        message: "Owner has not allowed the agent to use CodeGraph.",
      });
    }
    if (!runtimeReady) {
      reasons.push({
        code: "runtime_not_ready",
        message: "CodeGraph runtime is not ready.",
      });
    }
    if (!telemetryVerifiedOff) {
      reasons.push({
        code: "telemetry_not_verified_off",
        message: "Telemetry is not verified off.",
      });
    }
    if (!workspaceMatched) {
      reasons.push({
        code: "workspace_mismatch",
        message: "The active workspace does not match the CodeGraph studio workspace.",
      });
    }
    if (!repoPollutionSafe) {
      reasons.push({
        code: "repo_pollution_risk",
        message:
          runtime.pollutionGuard.blockedReason ??
          "Repo pollution protection is blocking CodeGraph capability registration.",
      });
    }
    if (!appDataRootValid) {
      reasons.push({
        code: "app_data_root_unavailable",
        message:
          runtime.plannerStorage.reason ?? "CodeGraph app-data root is unavailable.",
      });
    }

    return {
      available: capabilityRegistrationReady,
      registered: capabilityRegistrationReady && getCapabilityRegistrationState(),
      reasons,
      checks: {
        microAppEnabled: runtime.draft.microAppEnabled,
        agentCapabilityEnabled: runtime.draft.agentCapabilityEnabled,
        runtimeReady,
        telemetryVerifiedOff,
        workspaceMatched,
        repoPollutionSafe,
        appDataRootValid,
        capabilityRegistrationReady,
      },
    };
  };

  const toRuntimeSnapshot = (
    snapshot: CodeGraphStudioStatusSource | null,
    detect: ManagedCodeGraphDetectResult | null,
  ): CodeGraphStudioSnapshotShape => {
    const managedSnapshot =
      snapshot && "handshakeStatus" in snapshot
        ? (snapshot as ManagedCodeGraphStatusSnapshot)
        : null;

    if (managedSnapshot) {
      return {
        status: managedSnapshot.status,
        telemetryStatus: managedSnapshot.telemetryStatus,
        workspaceMatches: managedSnapshot.workspaceMatches,
        providerVersion: managedSnapshot.providerVersion,
        handshakeStatus: managedSnapshot.handshakeStatus,
        initializedNotificationSent: managedSnapshot.initializedNotificationSent,
        processAlive: managedSnapshot.processAlive,
        startedAt: managedSnapshot.startedAt,
        stoppedAt: managedSnapshot.stoppedAt,
        durationMs: managedSnapshot.durationMs,
        exitCode: managedSnapshot.exitCode,
        lastStatus: managedSnapshot.lastStatus,
        lastError: managedSnapshot.lastError,
        crashCount: managedSnapshot.crashCount,
        startDisposition: managedSnapshot.startDisposition,
      };
    }

    return {
      status: snapshot?.status ?? detect?.status ?? "unavailable",
      telemetryStatus: snapshot?.telemetryStatus ?? detect?.telemetryStatus ?? "unavailable",
      workspaceMatches:
        snapshot && "workspaceMatches" in snapshot && typeof snapshot.workspaceMatches === "boolean"
          ? snapshot.workspaceMatches
          : true,
      providerVersion: detect?.providerVersion ?? null,
      handshakeStatus: "not_started",
      initializedNotificationSent: false,
      processAlive: false,
      startedAt: null,
      stoppedAt: null,
      durationMs: null,
      exitCode: null,
      lastStatus: null,
      lastError: null,
      crashCount: 0,
      startDisposition: null,
    };
  };

  const collectBlockedReasons = (
    runtime: ReturnType<typeof buildRuntimeConfig>,
    detect: ManagedCodeGraphDetectResult | null,
  ) => {
    const blockedReasons: CodeGraphStudioBlockedReason[] = [];

    if (runtime.plannerStorage.status === "blocked") {
      blockedReasons.push(
        toBlockedReason(
          "app_data_root_unavailable",
          runtime.plannerStorage.reason ?? "CodeGraph app-data root is unavailable.",
        ),
      );
    }
    if (detect && !detect.commandFound) {
      blockedReasons.push(
        toBlockedReason(
          "provider_missing",
          "CodeGraph provider command was not found.",
        ),
      );
    }
    if (runtime.externalIndexSupport.status === "blocked") {
      blockedReasons.push(
        toBlockedReason(
          "external_index_root_unsupported",
          runtime.externalIndexSupport.reason ??
            "The current CodeGraph provider cannot use a reliable external index root.",
        ),
      );
    }
    if (runtime.pollutionGuard.exists) {
      blockedReasons.push(
        toBlockedReason(
          "repo_pollution_risk",
          `Repo-root CodeGraph data was found at ${runtime.pollutionGuard.repoDataDirPath}.`,
        ),
      );
    } else if (runtime.pollutionGuard.blockedReason) {
      blockedReasons.push(
        toBlockedReason(
          "repo_pollution_risk",
          runtime.pollutionGuard.blockedReason,
        ),
      );
    }
    if (detect?.telemetryStatus === "not_verified") {
      blockedReasons.push(
        toBlockedReason(
          "telemetry_not_verified_off",
          "Telemetry status could not be verified as off.",
        ),
      );
    }

    return blockedReasons;
  };

  const buildReport = async (
    statusSource?: CodeGraphStudioStatusSource | null,
    detectOverride?: ManagedCodeGraphDetectResult | null,
  ): Promise<CodeGraphStudioReport> => {
    const runtimeConfig = buildRuntimeConfig();
    const activeManager = ensureManager();
    const liveSnapshot = activeManager?.getStatus() ?? null;
    const snapshot =
      statusSource && "processAlive" in statusSource
        ? statusSource
        : liveSnapshot ?? latestCapabilityStatusSource;
    const detect =
      detectOverride ??
      ((!liveSnapshot || !liveSnapshot.processAlive) && activeManager
        ? await activeManager.detect()
        : null);
    const runtimeSnapshot = toRuntimeSnapshot(snapshot, detect);
    updateLatestCapabilityStatusSource(
      liveSnapshot
        ? {
            status: liveSnapshot.status,
            telemetryStatus: liveSnapshot.telemetryStatus,
            workspaceMatches: liveSnapshot.workspaceMatches,
          }
        : snapshot
          ? {
              status: snapshot.status,
              telemetryStatus: snapshot.telemetryStatus,
              workspaceMatches:
                "workspaceMatches" in snapshot &&
                typeof snapshot.workspaceMatches === "boolean"
                  ? snapshot.workspaceMatches
                  : undefined,
            }
          : null,
    );
    const rawStatus = runtimeSnapshot.status;
    const blockedReasons = collectBlockedReasons(runtimeConfig, detect);

    return {
      status: blockedReasons.length > 0 ? "blocked" : mapStudioStatus(rawStatus),
      blockedReasons,
      config: {
        workspaceRoot: runtimeConfig.config.workspaceRoot,
        appDataRootResolved: runtimeConfig.config.appDataRootResolved,
        logRoot: runtimeConfig.config.logRoot,
        indexRoot: runtimeConfig.config.indexRoot,
        capabilityRegistered: runtimeConfig.config.capabilityRegistered,
        ...runtimeConfig.draft,
      },
      capability: buildCapabilityGate(runtimeConfig, snapshot),
      pollutionGuard: runtimeConfig.pollutionGuard,
      runtime: {
        providerVersion: runtimeSnapshot.providerVersion,
        telemetryStatus: runtimeSnapshot.telemetryStatus,
        handshakeStatus: runtimeSnapshot.handshakeStatus,
        initializedNotificationSent: runtimeSnapshot.initializedNotificationSent,
        processAlive: runtimeSnapshot.processAlive,
        startedAt: runtimeSnapshot.startedAt,
        stoppedAt: runtimeSnapshot.stoppedAt,
        durationMs: runtimeSnapshot.durationMs,
        exitCode: runtimeSnapshot.exitCode,
        lastStatus: runtimeSnapshot.lastStatus,
        lastError: runtimeSnapshot.lastError,
        crashCount: runtimeSnapshot.crashCount,
        startDisposition: runtimeSnapshot.startDisposition,
      },
      debug: {
        workspaceHash,
        plannerStorage: runtimeConfig.plannerStorage,
        externalIndexSupport: runtimeConfig.externalIndexSupport,
        detectReasons: detect?.reasons ?? [],
        rawManagerStatus: runtimeSnapshot.status,
      },
    };
  };

  return {
    getStoragePath() {
      return configFilePath;
    },

    getDraft,

    async getReport() {
      return await buildReport();
    },

    async saveConfig(input: Partial<CodeGraphStudioConfigDraft>) {
      const current = getDraft();
      const next: CodeGraphStudioConfigDraft = {
        microAppEnabled: normalizeBoolean(input.microAppEnabled, current.microAppEnabled),
        agentCapabilityEnabled: normalizeBoolean(
          input.agentCapabilityEnabled,
          current.agentCapabilityEnabled,
        ),
        command:
          typeof input.command === "string"
            ? normalizeText(input.command, current.command)
            : current.command,
        startArgs:
          input.startArgs !== undefined
            ? normalizeStringArray(input.startArgs, current.startArgs)
            : current.startArgs,
        versionProbeArgs:
          input.versionProbeArgs !== undefined
            ? normalizeStringArray(input.versionProbeArgs, current.versionProbeArgs)
            : current.versionProbeArgs,
        telemetryProbeArgs:
          input.telemetryProbeArgs !== undefined
            ? normalizeStringArray(
                input.telemetryProbeArgs,
                current.telemetryProbeArgs,
              )
            : current.telemetryProbeArgs,
        appDataRoot:
          typeof input.appDataRoot === "string"
            ? input.appDataRoot.trim()
            : current.appDataRoot,
        timeoutMs: normalizePositiveNumber(input.timeoutMs, current.timeoutMs),
        maxResults: normalizePositiveNumber(input.maxResults, current.maxResults),
        queryLimit: normalizePositiveNumber(input.queryLimit, current.queryLimit),
      };
      const runtime = buildRuntimeConfig(next);
      if (runtime.plannerStorage.status === "blocked" && next.appDataRoot.trim()) {
        throw badRequest(
          runtime.plannerStorage.reason ?? "App Data Root is invalid.",
        );
      }
      if (runtime.config.appDataRootResolved) {
        next.appDataRoot = runtime.config.appDataRootResolved;
      }

      const runtimeConfigChanged = hasRuntimeConfigChanged(current, next);
      const currentManager = manager;
      if (runtimeConfigChanged && currentManager) {
        setRuntimeTransitionState(
          {
            inProgress: true,
            reason: "reconfiguring",
          },
          { clearSnapshot: true },
        );
        manager = null;
        await currentManager.dispose();
        updateLatestCapabilityStatusSource(null);
      } else if (runtimeConfigChanged) {
        setRuntimeTransitionState(
          {
            inProgress: true,
            reason: "reconfiguring",
          },
          { clearSnapshot: true },
        );
        updateLatestCapabilityStatusSource(null);
      }

      ensureDirectory(storageRoot);
      fs.writeFileSync(configFilePath, JSON.stringify(next, null, 2), "utf8");
      if (runtimeConfigChanged) {
        setRuntimeTransitionState({
          inProgress: false,
          reason: null,
        });
      } else {
        onStateChanged?.();
      }
      return next;
    },

    getCapabilityGate(requestedWorkspaceRoot?: string) {
      const activeManager = ensureManager();
      return buildCapabilityGate(
        buildRuntimeConfig(),
        activeManager?.getStatus() ?? latestCapabilityStatusSource ?? null,
        requestedWorkspaceRoot,
      );
    },

    getManagedCapabilityContext(requestedWorkspaceRoot: string) {
      const runtime = buildRuntimeConfig();
      const activeManager = ensureManager();
      const gate = buildCapabilityGate(
        runtime,
        activeManager?.getStatus() ?? latestCapabilityStatusSource ?? null,
        requestedWorkspaceRoot,
      );

      if (!gate.available || !activeManager) {
        return {
          ok: false as const,
          gate,
          draft: runtime.draft,
          plannerStorage: runtime.plannerStorage,
          externalIndexSupport: runtime.externalIndexSupport,
        };
      }

      return {
        ok: true as const,
        gate,
        draft: runtime.draft,
        manager: activeManager,
      };
    },

    async detect() {
      const activeManager = ensureManager();
      const detect = activeManager ? await activeManager.detect() : null;
      updateLatestCapabilityStatusSource(
        activeManager?.getStatus() ?? (detect ? { status: detect.status, telemetryStatus: detect.telemetryStatus, workspaceMatches: detect.workspaceAllowed } : null),
      );
      onStateChanged?.();
      return {
        report: await buildReport(detect, detect),
      };
    },

    async start() {
      const activeManager = ensureManager();
      const started = activeManager ? await activeManager.start() : null;
      updateLatestCapabilityStatusSource(started ?? null);
      onStateChanged?.();
      return {
        report: await buildReport(started),
      };
    },

    async health() {
      const activeManager = ensureManager();
      const status = activeManager ? await activeManager.health() : null;
      updateLatestCapabilityStatusSource(status ?? null);
      onStateChanged?.();
      return {
        report: await buildReport(status),
      };
    },

    async stop() {
      const activeManager = ensureManager();
      if (activeManager) {
        setRuntimeTransitionState({
          inProgress: true,
          reason: "stopping",
        });
      }
      const status = activeManager ? await activeManager.stop() : null;
      if (activeManager && manager === activeManager) {
        manager = null;
      }
      updateLatestCapabilityStatusSource(status ?? null);
      if (activeManager) {
        setRuntimeTransitionState({
          inProgress: false,
          reason: null,
        });
      } else {
        onStateChanged?.();
      }
      return {
        report: await buildReport(status),
      };
    },

    async smokeStatus(): Promise<CodeGraphStudioSmokeResult> {
      const activeManager = ensureManager();
      const report = await buildReport(activeManager ? await activeManager.health() : null);
      if (report.status !== "ready" || !activeManager) {
        return {
          kind: "status",
          ok: false,
          message: "CodeGraph is not ready for smoke status.",
          payload: null,
          report,
        };
      }

      try {
        const payload = await activeManager.callTool("codegraph_status", {});
        return {
          kind: "status",
          ok: !payload.isError,
          message: payload.isError
            ? "CodeGraph status tool reported an error."
            : "CodeGraph status tool completed.",
          payload,
          report: await buildReport(await activeManager.health()),
        };
      } catch (error) {
        return {
          kind: "status",
          ok: false,
          message: error instanceof Error ? error.message : String(error),
          payload: null,
          report,
        };
      }
    },

    async smokeQuery(query: string): Promise<CodeGraphStudioSmokeResult> {
      const activeManager = ensureManager();
      const report = await buildReport(activeManager ? await activeManager.health() : null);
      if (report.status !== "ready" || !activeManager) {
        return {
          kind: "query",
          ok: false,
          message: "CodeGraph is not ready for smoke query.",
          payload: null,
          report,
        };
      }

      const draft = getDraft();
      try {
        const payload = await activeManager.request(
          "codegraph/query",
          {
            query: query.trim(),
            limit: draft.queryLimit,
            maxResults: draft.maxResults,
          },
          draft.timeoutMs,
        );
        return {
          kind: "query",
          ok: true,
          message: "CodeGraph smoke query completed.",
          payload,
          report: await buildReport(await activeManager.health()),
        };
      } catch (error) {
        return {
          kind: "query",
          ok: false,
          message: error instanceof Error ? error.message : String(error),
          payload: null,
          report,
        };
      }
    },
  };
};

export type CodeGraphStudioService = ReturnType<
  typeof createCodeGraphStudioService
>;

let activeCodeGraphStudioService: CodeGraphStudioService | null = null;

export const setActiveCodeGraphStudioService = (
  service: CodeGraphStudioService | null,
) => {
  activeCodeGraphStudioService = service;
};

export const getActiveCodeGraphStudioService = () => activeCodeGraphStudioService;
