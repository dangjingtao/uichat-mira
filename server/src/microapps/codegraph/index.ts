import fs from "node:fs";
import path from "node:path";

import CONFIG from "@/config/index.js";
import {
  ManagedCodeGraphProcessManager,
  createManagedCodeGraphPlannerStorageFromAppDataRoot,
  createManagedCodeGraphWorkspaceHash,
  isCodebaseExplorePlannerExposureEnabled,
  resolveManagedCodeGraphExternalIndexSupport,
  resolveManagedCodeGraphPlannerConfig,
  type ManagedCodeGraphDetectResult,
  type ManagedCodeGraphExternalIndexSupport,
  type ManagedCodeGraphPlannerStorage,
  type ManagedCodeGraphRepoPollutionGuard,
  type ManagedCodeGraphStatusSnapshot,
} from "@/mcp/managed-codegraph/index.js";

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
  plannerExposureEnabled: boolean;
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
}) => {
  const workspaceRoot = path.resolve(options?.workspaceRoot ?? process.cwd());
  const storageRoot = path.resolve(options?.storageRoot ?? resolveStudioStorageRoot());
  const workspaceHash = createManagedCodeGraphWorkspaceHash(workspaceRoot);
  const configFilePath = path.join(storageRoot, `${workspaceHash}.json`);
  let manager: ManagedCodeGraphProcessManager | null = null;

  const getDraft = (): CodeGraphStudioConfigDraft => {
    const defaults = createDefaultDraft(workspaceRoot);
    const saved = parseJsonFile<Partial<CodeGraphStudioConfigDraft>>(configFilePath, {});
    return {
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
    const appDataRootResolved = draft.appDataRoot
      ? path.resolve(draft.appDataRoot)
      : plannerConfig.storage.appDataRoot;
    const plannerStorage = appDataRootResolved
      ? createManagedCodeGraphPlannerStorageFromAppDataRoot(
          workspaceHash,
          appDataRootResolved,
        )
      : plannerConfig.storage;
    const externalIndexSupport = resolveManagedCodeGraphExternalIndexSupport(
      draft.command,
    );
    const pollutionGuard: CodeGraphStudioPollutionGuard = {
      status:
        externalIndexSupport.status === "blocked" ? "blocked" : "ready",
      repoDataDirName:
        externalIndexSupport.repoDataDirName.trim() || DEFAULT_REPO_DATA_DIR_NAME,
      repoDataDirPath: path.join(
        workspaceRoot,
        externalIndexSupport.repoDataDirName.trim() || DEFAULT_REPO_DATA_DIR_NAME,
      ),
      exists: fs.existsSync(
        path.join(
          workspaceRoot,
          externalIndexSupport.repoDataDirName.trim() ||
            DEFAULT_REPO_DATA_DIR_NAME,
        ),
      ),
      blockedReason: externalIndexSupport.reason,
    };

    return {
      draft,
      plannerStorage,
      externalIndexSupport,
      pollutionGuard,
      config: {
        workspaceRoot,
        appDataRootResolved,
        logRoot: plannerStorage.logRoot,
        indexRoot: plannerStorage.indexRoot,
        plannerExposureEnabled: isCodebaseExplorePlannerExposureEnabled(),
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
    const runtime = buildRuntimeConfig();
    if (!runtime.plannerStorage.logRoot || !runtime.plannerStorage.indexRoot) {
      manager = null;
      return null;
    }

    if (
      manager &&
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
      workspaceRoot,
      allowedWorkspaceRoot: workspaceRoot,
      logRoot: runtime.plannerStorage.logRoot,
      indexRoot: runtime.plannerStorage.indexRoot,
      startTimeoutMs: runtime.draft.timeoutMs,
      healthTimeoutMs: runtime.draft.timeoutMs,
      stopTimeoutMs: runtime.draft.timeoutMs,
      repoPollutionGuard: toRepoPollutionGuard(runtime),
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
    const detect = detectOverride ?? (activeManager ? await activeManager.detect() : null);
    const snapshot =
      statusSource && "processAlive" in statusSource
        ? statusSource
        : activeManager?.getStatus() ?? null;
    const rawStatus = snapshot?.status ?? statusSource?.status ?? detect?.status ?? "unavailable";
    const blockedReasons = collectBlockedReasons(runtimeConfig, detect);

    return {
      status: blockedReasons.length > 0 ? "blocked" : mapStudioStatus(rawStatus),
      blockedReasons,
      config: {
        workspaceRoot: runtimeConfig.config.workspaceRoot,
        appDataRootResolved: runtimeConfig.config.appDataRootResolved,
        logRoot: runtimeConfig.config.logRoot,
        indexRoot: runtimeConfig.config.indexRoot,
        plannerExposureEnabled: runtimeConfig.config.plannerExposureEnabled,
        ...runtimeConfig.draft,
      },
      pollutionGuard: runtimeConfig.pollutionGuard,
      runtime: {
        providerVersion: snapshot?.providerVersion ?? detect?.providerVersion ?? null,
        telemetryStatus:
          snapshot?.telemetryStatus ?? detect?.telemetryStatus ?? "unavailable",
        handshakeStatus: snapshot?.handshakeStatus ?? "not_started",
        initializedNotificationSent: snapshot?.initializedNotificationSent ?? false,
        processAlive: snapshot?.processAlive ?? false,
        startedAt: snapshot?.startedAt ?? null,
        stoppedAt: snapshot?.stoppedAt ?? null,
        durationMs: snapshot?.durationMs ?? null,
        exitCode: snapshot?.exitCode ?? null,
        lastStatus: snapshot?.lastStatus ?? null,
        lastError: snapshot?.lastError ?? null,
        crashCount: snapshot?.crashCount ?? 0,
        startDisposition: snapshot?.startDisposition ?? null,
      },
      debug: {
        workspaceHash,
        plannerStorage: runtimeConfig.plannerStorage,
        externalIndexSupport: runtimeConfig.externalIndexSupport,
        detectReasons: detect?.reasons ?? [],
        rawManagerStatus: rawStatus,
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

    saveConfig(input: Partial<CodeGraphStudioConfigDraft>) {
      const current = getDraft();
      const next: CodeGraphStudioConfigDraft = {
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

      ensureDirectory(storageRoot);
      fs.writeFileSync(configFilePath, JSON.stringify(next, null, 2), "utf8");
      manager = null;
      return next;
    },

    async detect() {
      const activeManager = ensureManager();
      const detect = activeManager ? await activeManager.detect() : null;
      return {
        report: await buildReport(detect, detect),
      };
    },

    async start() {
      const activeManager = ensureManager();
      const started = activeManager ? await activeManager.start() : null;
      return {
        report: await buildReport(started),
      };
    },

    async health() {
      const activeManager = ensureManager();
      const status = activeManager ? await activeManager.health() : null;
      return {
        report: await buildReport(status),
      };
    },

    async stop() {
      const activeManager = ensureManager();
      const status = activeManager ? await activeManager.stop() : null;
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
