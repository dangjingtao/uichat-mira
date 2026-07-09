import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  ManagedJsonRpcSession,
  type ManagedJsonRpcExitInfo,
} from "./managed-jsonrpc-session.js";
import type {
  ManagedCodeGraphDetectResult,
  ManagedCodeGraphHealthProbe,
  ManagedCodeGraphProcessManagerOptions,
  ManagedCodeGraphStatusSnapshot,
  ManagedCodeGraphTelemetryStatus,
  ManagedCodeGraphRuntimeStatus,
} from "./types.js";

type InitializeResult = {
  protocolVersion?: string;
  serverInfo?: {
    name?: string;
    version?: string;
  };
  capabilities?: Record<string, unknown>;
};

const DEFAULT_PROTOCOL_VERSION = "2025-06-18";
const DEFAULT_TIMEOUT_MS = 2_000;
const DEFAULT_STOP_TIMEOUT_MS = 1_000;
const DEFAULT_DISABLED_TOKENS = ["disabled", "off", "0", "false", "verified_off"];
const INITIALIZED_NOTIFICATION_METHOD = "notifications/initialized";

const now = () => Date.now();

const resolvePath = (value: string) => path.resolve(value);

const toWorkspaceHash = (workspaceRoot: string) =>
  createHash("sha256").update(resolvePath(workspaceRoot)).digest("hex").slice(0, 16);

const isVerifiedOffTelemetry = (value: string | null | undefined, disabledTokens: string[]) => {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return disabledTokens.some((token) => normalized.includes(token.toLowerCase()));
};

const parseProviderVersion = (value: string | null) => {
  if (!value) {
    return null;
  }

  const firstLine = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine ?? null;
};

const cloneSnapshot = (snapshot: ManagedCodeGraphStatusSnapshot): ManagedCodeGraphStatusSnapshot => ({
  ...snapshot,
});

const normalizeExitCode = (message: string, fallback: number | null) => {
  if (fallback !== null) {
    return fallback;
  }

  const match = message.match(/code\s+(-?\d+)/i);
  return match ? Number(match[1]) : null;
};

const makeLeaseKey = (
  workspaceHash: string,
  providerVersion: string | null,
  indexRoot: string,
) => `${workspaceHash}::${providerVersion ?? "unknown"}::${resolvePath(indexRoot)}`;

export class ManagedCodeGraphProcessManager {
  private static readonly leaseRegistry = new Map<string, ManagedCodeGraphProcessManager>();

  private readonly workspaceRoot: string;
  private readonly allowedWorkspaceRoot: string;
  private readonly logRoot: string;
  private readonly indexRoot: string;
  private readonly workspaceHash: string;

  private session: ManagedJsonRpcSession | null = null;
  private detectCache: ManagedCodeGraphDetectResult | null = null;
  private primaryLeaseKey: string | null = null;
  private delegateOwner: ManagedCodeGraphProcessManager | null = null;
  private stoppingIntentional = false;

  private snapshot: ManagedCodeGraphStatusSnapshot;

  constructor(private readonly options: ManagedCodeGraphProcessManagerOptions) {
    this.workspaceRoot = resolvePath(this.options.workspaceRoot);
    this.allowedWorkspaceRoot = resolvePath(this.options.allowedWorkspaceRoot);
    this.logRoot = resolvePath(this.options.logRoot);
    this.indexRoot = resolvePath(this.options.indexRoot);
    this.workspaceHash = toWorkspaceHash(this.options.workspaceRoot);
    this.snapshot = {
      status: "unavailable",
      providerVersion: null,
      telemetryStatus: "unavailable",
      handshakeStatus: "not_started",
      initializedNotificationSent: false,
      workspaceHash: this.workspaceHash,
      workspaceRoot: this.workspaceRoot,
      allowedWorkspaceRoot: this.allowedWorkspaceRoot,
      workspaceMatches: this.workspaceRoot === this.allowedWorkspaceRoot,
      logRoot: this.logRoot,
      indexRoot: this.indexRoot,
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
  }

  getStatus(): ManagedCodeGraphStatusSnapshot {
    if (this.delegateOwner) {
      const delegated = this.delegateOwner.getStatus();
      return {
        ...delegated,
        startDisposition: "reused_existing" as const,
      };
    }
    return cloneSnapshot(this.snapshot);
  }

  async detect(): Promise<ManagedCodeGraphDetectResult> {
    const reasons: string[] = [];
    const commandFound = this.commandExists();
    const logRootReady = this.ensureWritableDirectory(this.logRoot);
    const indexRootReady = this.ensureWritableDirectory(this.indexRoot);
    const workspaceAllowed = this.workspaceRoot === this.allowedWorkspaceRoot;

    let providerVersion: string | null = null;
    if (commandFound) {
      providerVersion = parseProviderVersion(
        this.runProbe(this.options.versionProbe.args).stdout,
      );
      if (!providerVersion) {
        reasons.push("provider_version_unreadable");
      }
    } else {
      reasons.push("provider_missing");
    }

    const telemetryStatus = commandFound
      ? this.readTelemetryStatus()
      : "unavailable";

    if (!workspaceAllowed) {
      reasons.push("workspace_mismatch");
    }
    if (!logRootReady) {
      reasons.push("log_root_unavailable");
    }
    if (!indexRootReady) {
      reasons.push("index_root_unavailable");
    }
    if (telemetryStatus === "not_verified") {
      reasons.push("telemetry_not_verified");
    }

    let status: ManagedCodeGraphRuntimeStatus = "stopped";
    if (!commandFound || !providerVersion || !logRootReady || !indexRootReady) {
      status = "unavailable";
    } else if (!workspaceAllowed || telemetryStatus !== "verified_off") {
      status = "blocked";
    }

    this.detectCache = {
      status,
      commandFound,
      providerVersion,
      telemetryStatus,
      workspaceHash: this.workspaceHash,
      workspaceAllowed,
      logRootReady,
      indexRootReady,
      reasons,
    };

    this.snapshot = {
      ...this.snapshot,
      status,
      providerVersion,
      telemetryStatus,
      workspaceMatches: workspaceAllowed,
    };

    return this.detectCache;
  }

  async start() {
    if (this.delegateOwner) {
      return this.getStatus();
    }

    const detectResult = await this.detect();
    if (detectResult.status === "unavailable" || detectResult.status === "blocked") {
      return this.getStatus();
    }

    const leaseKey = makeLeaseKey(
      this.workspaceHash,
      detectResult.providerVersion,
      this.indexRoot,
    );

    const existingLease = ManagedCodeGraphProcessManager.leaseRegistry.get(leaseKey);
    if (existingLease && existingLease !== this) {
      const existingStatus = await existingLease.health();
      if (
        existingStatus.status === "ready" ||
        existingStatus.status === "starting" ||
        existingStatus.processAlive
      ) {
        this.delegateOwner = existingLease;
        return {
          ...existingStatus,
          startDisposition: "reused_existing",
        };
      }
      ManagedCodeGraphProcessManager.leaseRegistry.delete(leaseKey);
    }

    if (this.session?.isAlive()) {
      this.snapshot = {
        ...this.snapshot,
        startDisposition: "already_running",
      };
      return await this.health();
    }

    this.primaryLeaseKey = leaseKey;
    this.stoppingIntentional = false;
    this.snapshot = {
      ...this.snapshot,
      status: "starting",
      startDisposition: "primary",
      handshakeStatus: "not_started",
      initializedNotificationSent: false,
      startedAt: now(),
      stoppedAt: null,
      durationMs: null,
      exitCode: null,
      lastError: null,
      processAlive: false,
    };

    this.writeManagerLog(`start requested for ${this.workspaceHash}`);
    this.session = new ManagedJsonRpcSession({
      command: this.options.command,
      args: this.options.startArgs,
      cwd: this.workspaceRoot,
      env: {
        ...this.options.env,
        CODEGRAPH_WORKSPACE_ROOT: this.workspaceRoot,
        CODEGRAPH_WORKSPACE_HASH: this.workspaceHash,
        CODEGRAPH_LOG_ROOT: this.logRoot,
        CODEGRAPH_INDEX_ROOT: this.indexRoot,
      },
      stdoutLogPath: path.join(this.logRoot, "codegraph-stdout.log"),
      stderrLogPath: path.join(this.logRoot, "codegraph-stderr.log"),
      onExit: (info) => {
        this.handleExit(info);
      },
    });

    try {
      this.session.start();
      const initialize = await this.session.request<InitializeResult>(
        "initialize",
        {
          protocolVersion: this.options.protocolVersion ?? DEFAULT_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: {
            name: "uichat-mira-managed-codegraph-spike",
            version: "0.0.0",
          },
        },
        this.options.startTimeoutMs ?? DEFAULT_TIMEOUT_MS,
      );

      this.snapshot = {
        ...this.snapshot,
        handshakeStatus: "ok",
        providerVersion:
          initialize.serverInfo?.version ??
          detectResult.providerVersion ??
          this.snapshot.providerVersion,
        processAlive: this.session.isAlive(),
      };

      this.session.notify(INITIALIZED_NOTIFICATION_METHOD);
      this.snapshot = {
        ...this.snapshot,
        initializedNotificationSent: true,
      };

      ManagedCodeGraphProcessManager.leaseRegistry.set(leaseKey, this);
      this.writeManagerLog(`initialize ok for ${this.workspaceHash}`);
      return await this.health();
    } catch (error) {
      this.snapshot = {
        ...this.snapshot,
        status: "failed",
        handshakeStatus: "failed",
        initializedNotificationSent: false,
        processAlive: Boolean(this.session?.isAlive()),
        lastError: error instanceof Error ? error.message : String(error),
      };
      this.writeManagerLog(`start failed: ${this.snapshot.lastError}`);
      if (this.primaryLeaseKey) {
        ManagedCodeGraphProcessManager.leaseRegistry.delete(this.primaryLeaseKey);
      }
      return this.getStatus();
    }
  }

  async health() {
    if (this.delegateOwner) {
      const delegated = this.delegateOwner.getStatus();
      return {
        ...delegated,
        startDisposition: "reused_existing",
      };
    }

    if (!this.session) {
      return this.getStatus();
    }

    if (!this.snapshot.initializedNotificationSent) {
      this.snapshot = {
        ...this.snapshot,
        status: this.session.isAlive() ? "degraded" : "failed",
        processAlive: this.session.isAlive(),
        lastError: "notifications/initialized was not sent before health",
      };
      return this.getStatus();
    }

    if (!this.session.isAlive()) {
      if (this.snapshot.status === "ready" || this.snapshot.status === "starting") {
        this.snapshot = {
          ...this.snapshot,
          status: "degraded",
          processAlive: false,
        };
      }
      return this.getStatus();
    }

    try {
      const probe = await this.session.request<ManagedCodeGraphHealthProbe>(
        "codegraph/health",
        {
          workspaceHash: this.workspaceHash,
          workspaceRoot: this.workspaceRoot,
          indexRoot: this.indexRoot,
          logRoot: this.logRoot,
        },
        this.options.healthTimeoutMs ?? DEFAULT_TIMEOUT_MS,
      );

      const providerVersion = probe.providerVersion ?? this.snapshot.providerVersion;
      const telemetryStatus = isVerifiedOffTelemetry(
        probe.telemetryStatus,
        this.options.telemetryProbe?.disabledTokens ?? DEFAULT_DISABLED_TOKENS,
      )
        ? "verified_off"
        : "not_verified";
      const workspaceMatches = probe.workspaceHash === this.workspaceHash;

      let status: ManagedCodeGraphRuntimeStatus = "ready";
      let lastError: string | null = null;

      if (!workspaceMatches) {
        status = "blocked";
        lastError = "workspace_mismatch";
      } else if (telemetryStatus !== "verified_off") {
        status = "blocked";
        lastError = "telemetry_not_verified";
      } else if ((probe.status ?? "").toLowerCase() === "degraded") {
        status = "degraded";
      }

      this.snapshot = {
        ...this.snapshot,
        status,
        providerVersion,
        telemetryStatus,
        workspaceMatches,
        processAlive: this.session.isAlive(),
        lastError,
      };
      return this.getStatus();
    } catch (error) {
      this.snapshot = {
        ...this.snapshot,
        status: this.session.isAlive() ? "degraded" : "failed",
        processAlive: this.session.isAlive(),
        lastError: error instanceof Error ? error.message : String(error),
      };
      return this.getStatus();
    }
  }

  async request<T>(
    method: string,
    params: Record<string, unknown>,
    timeoutMs = this.options.healthTimeoutMs ?? DEFAULT_TIMEOUT_MS,
  ): Promise<T> {
    if (this.delegateOwner) {
      return await this.delegateOwner.request<T>(method, params, timeoutMs);
    }

    if (!this.session || !this.session.isAlive()) {
      throw new Error("Managed CodeGraph process is not ready");
    }

    if (!this.snapshot.initializedNotificationSent) {
      throw new Error(
        "Managed CodeGraph process has not sent notifications/initialized yet",
      );
    }

    return await this.session.request<T>(method, params, timeoutMs);
  }

  async stop() {
    if (this.delegateOwner) {
      this.delegateOwner = null;
      this.snapshot = {
        ...this.snapshot,
        status: "stopped",
        initializedNotificationSent: false,
        stoppedAt: now(),
        processAlive: false,
      };
      return this.getStatus();
    }

    const priorStatus = this.snapshot.status;
    this.snapshot = {
      ...this.snapshot,
      lastStatus: priorStatus,
    };

    if (!this.session) {
      this.snapshot = {
        ...this.snapshot,
        status: "stopped",
        initializedNotificationSent: false,
        stoppedAt: now(),
        durationMs: this.snapshot.startedAt ? now() - this.snapshot.startedAt : null,
        processAlive: false,
      };
      return this.getStatus();
    }

    this.stoppingIntentional = true;
    this.writeManagerLog(`stop requested for ${this.workspaceHash}`);
    try {
      this.session.notify("shutdown", {
        workspaceHash: this.workspaceHash,
      });
    } catch (error) {
      this.writeManagerLog(
        `shutdown notify failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    try {
      const exitInfo = await this.session.waitForExit(
        this.options.stopTimeoutMs ?? DEFAULT_STOP_TIMEOUT_MS,
      );
      this.finalizeStop(exitInfo, priorStatus);
    } catch {
      this.session.forceKill();
      try {
        const exitInfo = await this.session.waitForExit(
          this.options.stopTimeoutMs ?? DEFAULT_STOP_TIMEOUT_MS,
        );
        this.finalizeStop(exitInfo, priorStatus);
      } catch (error) {
        this.snapshot = {
          ...this.snapshot,
          status: "failed",
          initializedNotificationSent: false,
          processAlive: false,
          stoppedAt: now(),
          durationMs: this.snapshot.startedAt ? now() - this.snapshot.startedAt : null,
          lastStatus: priorStatus,
          lastError: error instanceof Error ? error.message : String(error),
        };
      }
    }

    if (this.primaryLeaseKey) {
      ManagedCodeGraphProcessManager.leaseRegistry.delete(this.primaryLeaseKey);
    }

    this.session = null;
    return this.getStatus();
  }

  private finalizeStop(exitInfo: ManagedJsonRpcExitInfo, priorStatus: ManagedCodeGraphRuntimeStatus) {
    this.snapshot = {
      ...this.snapshot,
      status: "stopped",
      initializedNotificationSent: false,
      processAlive: false,
      stoppedAt: now(),
      durationMs: this.snapshot.startedAt ? now() - this.snapshot.startedAt : null,
      exitCode: normalizeExitCode(exitInfo.message, exitInfo.code),
      lastStatus: priorStatus,
      lastError: null,
    };
    this.writeManagerLog(`stop completed with code ${this.snapshot.exitCode ?? "null"}`);
  }

  private commandExists() {
    const trimmed = this.options.command.trim();
    if (!trimmed) {
      return false;
    }

    if (/[\\/]/.test(trimmed)) {
      return fs.existsSync(resolvePath(trimmed));
    }

    const probe = spawnSync(
      process.platform === "win32" ? "where.exe" : "which",
      [trimmed],
      {
        windowsHide: true,
        encoding: "utf8",
        stdio: "pipe",
      },
    );
    return probe.status === 0;
  }

  private runProbe(args: string[]) {
    const result = spawnSync(this.options.command, args, {
      cwd: this.workspaceRoot,
      env: {
        ...process.env,
        ...(this.options.env ?? {}),
        CODEGRAPH_WORKSPACE_ROOT: this.workspaceRoot,
        CODEGRAPH_WORKSPACE_HASH: this.workspaceHash,
        CODEGRAPH_LOG_ROOT: this.logRoot,
        CODEGRAPH_INDEX_ROOT: this.indexRoot,
      },
      windowsHide: true,
      encoding: "utf8",
      stdio: "pipe",
    });

    if (result.error || result.status !== 0) {
      return {
        stdout: null,
        stderr: result.error instanceof Error ? result.error.message : (result.stderr ?? "").trim(),
      };
    }

    return {
      stdout: (result.stdout ?? "").trim(),
      stderr: (result.stderr ?? "").trim(),
    };
  }

  private readTelemetryStatus(): ManagedCodeGraphTelemetryStatus {
    if (!this.options.telemetryProbe) {
      return "unavailable";
    }

    const probe = this.runProbe(this.options.telemetryProbe.args);
    return isVerifiedOffTelemetry(
      probe.stdout,
      this.options.telemetryProbe.disabledTokens ?? DEFAULT_DISABLED_TOKENS,
    )
      ? "verified_off"
      : "not_verified";
  }

  private ensureWritableDirectory(targetPath: string) {
    try {
      fs.mkdirSync(targetPath, { recursive: true });
      fs.accessSync(targetPath, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  private writeManagerLog(message: string) {
    try {
      fs.mkdirSync(this.logRoot, { recursive: true });
      fs.appendFileSync(
        path.join(this.logRoot, "codegraph-manager.log"),
        `[${new Date().toISOString()}] ${message}\n`,
        "utf8",
      );
    } catch {
      // Manager log failures should not break the isolated spike.
    }
  }

  private handleExit(info: ManagedJsonRpcExitInfo) {
    const intentional = this.stoppingIntentional;
    const priorStatus = this.snapshot.status;
    this.snapshot = {
      ...this.snapshot,
      processAlive: false,
      exitCode: normalizeExitCode(info.message, info.code),
      stoppedAt: now(),
      durationMs: this.snapshot.startedAt ? now() - this.snapshot.startedAt : null,
      lastStatus: priorStatus,
      lastError: intentional ? null : info.message,
      status: intentional
        ? "stopped"
        : priorStatus === "ready" || priorStatus === "starting"
          ? "degraded"
          : "failed",
      initializedNotificationSent: intentional
        ? false
        : this.snapshot.initializedNotificationSent,
      crashCount: intentional ? this.snapshot.crashCount : this.snapshot.crashCount + 1,
    };
    this.writeManagerLog(`process exit: ${info.message}`);
    if (!intentional && this.primaryLeaseKey) {
      ManagedCodeGraphProcessManager.leaseRegistry.delete(this.primaryLeaseKey);
    }
  }
}

export const createManagedCodeGraphWorkspaceHash = toWorkspaceHash;
