import { getSqlite } from "../index.js";

export type TailscaleRemoteAccessConfig = {
  enabled: boolean;
  servePort: number;
  updatedAt: string | null;
};

export type TailscalePairedDevice = {
  id: string;
  name: string;
  platform: string;
  permissions: string[];
  createdAt: string;
  lastSeenAt: string | null;
};

type ConfigRow = {
  enabled: number;
  serve_port: number;
  updated_at: string | null;
};

type DeviceRow = {
  id: string;
  name: string;
  platform: string;
  permissions_json: string;
  created_at: string;
  last_seen_at: string | null;
};

const DEFAULT_SERVE_PORT = 443;

const normalizeServePort = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_SERVE_PORT;
  }

  const port = Math.trunc(value);
  return port >= 1 && port <= 65535 ? port : DEFAULT_SERVE_PORT;
};

const parsePermissions = (value: string) => {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

const ensureTables = () => {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tailscale_remote_access_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER NOT NULL DEFAULT 0,
      serve_port INTEGER NOT NULL DEFAULT 443,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS tailscale_remote_devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'unknown',
      permissions_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      last_seen_at TEXT,
      revoked_at TEXT
    );
  `);

  const now = new Date().toISOString();
  sqlite
    .prepare(
      `INSERT OR IGNORE INTO tailscale_remote_access_settings
       (id, enabled, serve_port, created_at, updated_at)
       VALUES (1, 0, ?, ?, NULL)`,
    )
    .run(DEFAULT_SERVE_PORT, now);
};

const toConfig = (row: ConfigRow): TailscaleRemoteAccessConfig => ({
  enabled: row.enabled === 1,
  servePort: normalizeServePort(row.serve_port),
  updatedAt: row.updated_at,
});

export const tailscaleRemoteAccessRepository = {
  initialize() {
    ensureTables();
  },

  getConfig(): TailscaleRemoteAccessConfig {
    ensureTables();
    const row = getSqlite()
      .prepare(
        `SELECT enabled, serve_port, updated_at
         FROM tailscale_remote_access_settings
         WHERE id = 1`,
      )
      .get() as ConfigRow | undefined;

    if (!row) {
      throw new Error("Failed to initialize Tailscale remote access settings");
    }

    return toConfig(row);
  },

  updateConfig(
    input: Partial<Pick<TailscaleRemoteAccessConfig, "enabled" | "servePort">>,
  ): TailscaleRemoteAccessConfig {
    const current = this.getConfig();
    const nextEnabled =
      typeof input.enabled === "boolean" ? input.enabled : current.enabled;
    const nextServePort =
      typeof input.servePort === "number"
        ? normalizeServePort(input.servePort)
        : current.servePort;
    const updatedAt = new Date().toISOString();

    getSqlite()
      .prepare(
        `UPDATE tailscale_remote_access_settings
         SET enabled = ?, serve_port = ?, updated_at = ?
         WHERE id = 1`,
      )
      .run(nextEnabled ? 1 : 0, nextServePort, updatedAt);

    return this.getConfig();
  },

  listDevices(): TailscalePairedDevice[] {
    ensureTables();
    const rows = getSqlite()
      .prepare(
        `SELECT id, name, platform, permissions_json, created_at, last_seen_at
         FROM tailscale_remote_devices
         WHERE revoked_at IS NULL
         ORDER BY COALESCE(last_seen_at, created_at) DESC`,
      )
      .all() as DeviceRow[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      platform: row.platform,
      permissions: parsePermissions(row.permissions_json),
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
    }));
  },

  revokeDevice(id: string): boolean {
    ensureTables();
    const result = getSqlite()
      .prepare(
        `UPDATE tailscale_remote_devices
         SET revoked_at = ?
         WHERE id = ? AND revoked_at IS NULL`,
      )
      .run(new Date().toISOString(), id);

    return result.changes > 0;
  },
};
