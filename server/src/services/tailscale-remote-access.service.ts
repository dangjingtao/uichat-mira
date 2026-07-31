import { execFile } from "node:child_process";
import CONFIG from "@/config/index.js";
import {
  tailscaleRemoteAccessRepository,
  type TailscalePairedDevice,
  type TailscaleRemoteAccessConfig,
} from "@/db/repositories/tailscale-remote-access.repository.js";

export type TailscaleRemoteRuntimeState =
  | "not_installed"
  | "needs_login"
  | "connecting"
  | "connected"
  | "serve_conflict"
  | "serve_not_configured"
  | "unreachable"
  | "ready"
  | "error";

export type TailscaleRuntimeSnapshot = {
  state: TailscaleRemoteRuntimeState;
  installed: boolean;
  backendState: string | null;
  version: string | null;
  deviceName: string | null;
  dnsName: string | null;
  tailnetName: string | null;
  tailnetDomain: string | null;
  tailscaleIps: string[];
  serveConfigured: boolean;
  serveManagedByMira: boolean;
  accessUrl: string | null;
  healthOk: boolean | null;
  checkedAt: string;
  error: string | null;
};

export type TailscaleRemoteAccessSnapshot = {
  config: TailscaleRemoteAccessConfig;
  runtime: TailscaleRuntimeSnapshot;
  pairedDevices: TailscalePairedDevice[];
};

export type CommandResult = {
  stdout: string;
  stderr: string;
};

export type TailscaleCommandRunner = (
  args: string[],
) => Promise<CommandResult>;

export type TailscaleHealthChecker = (url: string) => Promise<boolean>;

export type TailscaleRemoteAccessErrorCode =
  | "TAILSCALE_NOT_INSTALLED"
  | "TAILSCALE_NOT_CONNECTED"
  | "TAILSCALE_SERVE_CONFLICT"
  | "TAILSCALE_COMMAND_FAILED";

export class TailscaleRemoteAccessError extends Error {
  constructor(
    public readonly code: TailscaleRemoteAccessErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TailscaleRemoteAccessError";
  }
}

type TailscaleStatusJson = {
  Version?: unknown;
  BackendState?: unknown;
  TailscaleIPs?: unknown;
  Self?: {
    HostName?: unknown;
    DNSName?: unknown;
    Online?: unknown;
    TailscaleIPs?: unknown;
  } | null;
  CurrentTailnet?: {
    Name?: unknown;
    MagicDNSSuffix?: unknown;
    MagicDNSEnabled?: unknown;
  } | null;
};

const COMMAND_TIMEOUT_MS = 10_000;
const HEALTH_TIMEOUT_MS = 4_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const normalizeDnsName = (value: string | null) =>
  value ? value.replace(/\.+$/, "") : null;

const parseJson = (value: string): unknown => {
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }

  return JSON.parse(trimmed) as unknown;
};

const defaultCommandRunner: TailscaleCommandRunner = (args) =>
  new Promise((resolve, reject) => {
    execFile(
      "tailscale",
      args,
      {
        windowsHide: true,
        timeout: COMMAND_TIMEOUT_MS,
        maxBuffer: 2 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }

        resolve({
          stdout: String(stdout ?? ""),
          stderr: String(stderr ?? ""),
        });
      },
    );
  });

const defaultHealthChecker: TailscaleHealthChecker = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  try {
    const response = await fetch(`${url.replace(/\/+$/, "")}/health`, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

const getErrorCode = (error: unknown) =>
  isRecord(error) && typeof error.code === "string" ? error.code : null;

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const hasServeConfiguration = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (!isRecord(value)) {
    return false;
  }

  return Object.keys(value).length > 0;
};

const containsManagedTarget = (value: unknown, backendPort: number) => {
  const serialized = JSON.stringify(value).toLowerCase();
  return (
    serialized.includes(`127.0.0.1:${backendPort}`) ||
    serialized.includes(`localhost:${backendPort}`)
  );
};

const buildAccessUrl = (dnsName: string | null, servePort: number) => {
  if (!dnsName) {
    return null;
  }

  return servePort === 443
    ? `https://${dnsName}`
    : `https://${dnsName}:${servePort}`;
};

const createBaseRuntime = (
  patch: Partial<TailscaleRuntimeSnapshot> = {},
): TailscaleRuntimeSnapshot => ({
  state: "error",
  installed: false,
  backendState: null,
  version: null,
  deviceName: null,
  dnsName: null,
  tailnetName: null,
  tailnetDomain: null,
  tailscaleIps: [],
  serveConfigured: false,
  serveManagedByMira: false,
  accessUrl: null,
  healthOk: null,
  checkedAt: new Date().toISOString(),
  error: null,
  ...patch,
});

export class TailscaleRemoteAccessService {
  constructor(
    private readonly runCommand: TailscaleCommandRunner = defaultCommandRunner,
    private readonly checkHealth: TailscaleHealthChecker = defaultHealthChecker,
  ) {}

  private async readStatus(): Promise<TailscaleStatusJson> {
    try {
      const result = await this.runCommand(["status", "--json"]);
      const parsed = parseJson(result.stdout);
      if (!isRecord(parsed)) {
        throw new Error("Unexpected Tailscale status response");
      }
      return parsed as TailscaleStatusJson;
    } catch (error) {
      if (getErrorCode(error) === "ENOENT") {
        throw new TailscaleRemoteAccessError(
          "TAILSCALE_NOT_INSTALLED",
          "Tailscale CLI is not installed or is not available on PATH",
        );
      }
      throw error;
    }
  }

  private async readServeStatus(): Promise<unknown> {
    try {
      const result = await this.runCommand(["serve", "status", "--json"]);
      return parseJson(result.stdout);
    } catch (error) {
      const message = errorMessage(error).toLowerCase();
      if (
        message.includes("no serve config") ||
        message.includes("not configured")
      ) {
        return {};
      }
      throw error;
    }
  }

  private connectionState(status: TailscaleStatusJson) {
    const backendState = asString(status.BackendState);
    const online = status.Self?.Online === true;

    if (
      backendState === "NeedsLogin" ||
      backendState === "NoState" ||
      backendState === "Stopped"
    ) {
      return "needs_login" as const;
    }

    if (backendState === "Running" && online) {
      return "connected" as const;
    }

    return "connecting" as const;
  }

  async getSnapshot(options: { verifyHealth?: boolean } = {}): Promise<TailscaleRemoteAccessSnapshot> {
    const config = tailscaleRemoteAccessRepository.getConfig();
    const pairedDevices = tailscaleRemoteAccessRepository.listDevices();

    try {
      const status = await this.readStatus();
      const connectionState = this.connectionState(status);
      const dnsName = normalizeDnsName(asString(status.Self?.DNSName));
      const tailnetDomain = asString(status.CurrentTailnet?.MagicDNSSuffix);
      const tailscaleIps = [
        ...asStringArray(status.Self?.TailscaleIPs),
        ...asStringArray(status.TailscaleIPs),
      ].filter((value, index, values) => values.indexOf(value) === index);
      const accessUrl = buildAccessUrl(dnsName, config.servePort);
      const common = {
        installed: true,
        backendState: asString(status.BackendState),
        version: asString(status.Version),
        deviceName: asString(status.Self?.HostName),
        dnsName,
        tailnetName: asString(status.CurrentTailnet?.Name),
        tailnetDomain,
        tailscaleIps,
        accessUrl,
      };

      if (connectionState !== "connected") {
        return {
          config,
          pairedDevices,
          runtime: createBaseRuntime({
            ...common,
            state: connectionState,
          }),
        };
      }

      const serveStatus = await this.readServeStatus();
      const serveConfigured = hasServeConfiguration(serveStatus);
      const serveManagedByMira = containsManagedTarget(
        serveStatus,
        CONFIG.PORT,
      );

      if (serveConfigured && !serveManagedByMira) {
        return {
          config,
          pairedDevices,
          runtime: createBaseRuntime({
            ...common,
            state: "serve_conflict",
            serveConfigured: true,
            error:
              "An existing Tailscale Serve configuration is present and is not managed by Mira",
          }),
        };
      }

      if (config.enabled && !serveManagedByMira) {
        return {
          config,
          pairedDevices,
          runtime: createBaseRuntime({
            ...common,
            state: "serve_not_configured",
            serveConfigured,
            serveManagedByMira,
          }),
        };
      }

      if (!config.enabled) {
        return {
          config,
          pairedDevices,
          runtime: createBaseRuntime({
            ...common,
            state: "connected",
            serveConfigured,
            serveManagedByMira,
          }),
        };
      }

      const healthOk =
        options.verifyHealth === false || !accessUrl
          ? null
          : await this.checkHealth(accessUrl);

      return {
        config,
        pairedDevices,
        runtime: createBaseRuntime({
          ...common,
          state: healthOk === false ? "unreachable" : "ready",
          serveConfigured: true,
          serveManagedByMira: true,
          healthOk,
        }),
      };
    } catch (error) {
      if (
        error instanceof TailscaleRemoteAccessError &&
        error.code === "TAILSCALE_NOT_INSTALLED"
      ) {
        return {
          config,
          pairedDevices,
          runtime: createBaseRuntime({
            state: "not_installed",
            error: error.message,
          }),
        };
      }

      return {
        config,
        pairedDevices,
        runtime: createBaseRuntime({
          state: "error",
          installed: true,
          error: errorMessage(error),
        }),
      };
    }
  }

  async updateEnabled(enabled: boolean): Promise<TailscaleRemoteAccessSnapshot> {
    const currentConfig = tailscaleRemoteAccessRepository.getConfig();
    const status = await this.readStatus();

    if (this.connectionState(status) !== "connected") {
      throw new TailscaleRemoteAccessError(
        "TAILSCALE_NOT_CONNECTED",
        "Connect this device to a Tailnet before changing remote access",
      );
    }

    const serveStatus = await this.readServeStatus();
    const serveConfigured = hasServeConfiguration(serveStatus);
    const serveManagedByMira = containsManagedTarget(
      serveStatus,
      CONFIG.PORT,
    );

    if (serveConfigured && !serveManagedByMira) {
      throw new TailscaleRemoteAccessError(
        "TAILSCALE_SERVE_CONFLICT",
        "Mira did not change Tailscale Serve because another configuration already exists",
      );
    }

    try {
      if (enabled && !serveManagedByMira) {
        await this.runCommand([
          "serve",
          "--bg",
          "--yes",
          `--https=${currentConfig.servePort}`,
          `127.0.0.1:${CONFIG.PORT}`,
        ]);
      } else if (!enabled && serveManagedByMira) {
        await this.runCommand([
          "serve",
          `--https=${currentConfig.servePort}`,
          "off",
        ]);
      }
    } catch (error) {
      throw new TailscaleRemoteAccessError(
        "TAILSCALE_COMMAND_FAILED",
        errorMessage(error),
      );
    }

    tailscaleRemoteAccessRepository.updateConfig({ enabled });
    return this.getSnapshot({ verifyHealth: true });
  }

  async check(): Promise<TailscaleRemoteAccessSnapshot> {
    return this.getSnapshot({ verifyHealth: true });
  }

  revokeDevice(id: string): boolean {
    return tailscaleRemoteAccessRepository.revokeDevice(id);
  }
}

export const tailscaleRemoteAccessService = new TailscaleRemoteAccessService();
