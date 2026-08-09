import { randomBytes } from "node:crypto";
import { getSqlite } from "../index.js";
import { decryptSecret, encryptSecret } from "@/utils/crypto.js";

export const REMOTE_RELAY_ENDPOINT_MODES = ["default", "custom"] as const;
export type RemoteRelayEndpointMode =
  (typeof REMOTE_RELAY_ENDPOINT_MODES)[number];

export type RemoteRelaySettingsRecord = {
  enabled: boolean;
  endpointMode: RemoteRelayEndpointMode;
  customUrl: string;
  relayId: string;
  hostToken: string;
  clientToken: string;
  updatedAt: string | null;
};

type RelaySettingsRow = {
  enabled: number;
  endpoint_mode: string;
  custom_url: string;
  relay_id: string;
  host_token_encrypted: string | null;
  client_token_encrypted: string | null;
  updated_at: string | null;
};

const createRelayId = () => `relay_${randomBytes(18).toString("base64url")}`;
const createRelayToken = () => randomBytes(32).toString("base64url");

const normalizeMode = (value: unknown): RemoteRelayEndpointMode =>
  value === "custom" ? "custom" : "default";

const ensureTable = () => {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS remote_relay_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER NOT NULL DEFAULT 0,
      endpoint_mode TEXT NOT NULL DEFAULT 'default',
      custom_url TEXT NOT NULL DEFAULT '',
      relay_id TEXT NOT NULL DEFAULT '',
      host_token_encrypted TEXT,
      client_token_encrypted TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );
  `);

  const now = new Date().toISOString();
  sqlite
    .prepare(
      `INSERT OR IGNORE INTO remote_relay_settings (
        id, enabled, endpoint_mode, custom_url, relay_id,
        host_token_encrypted, client_token_encrypted, created_at, updated_at
      ) VALUES (1, 0, 'default', '', '', NULL, NULL, ?, NULL)`,
    )
    .run(now);
};

const readRow = () => {
  ensureTable();
  return getSqlite()
    .prepare(
      `SELECT enabled, endpoint_mode, custom_url, relay_id,
              host_token_encrypted, client_token_encrypted, updated_at
       FROM remote_relay_settings
       WHERE id = 1`,
    )
    .get() as RelaySettingsRow | undefined;
};

const ensureIdentity = (row: RelaySettingsRow): RelaySettingsRow => {
  const hostToken = decryptSecret(row.host_token_encrypted);
  const clientToken = decryptSecret(row.client_token_encrypted);
  if (row.relay_id && hostToken && clientToken) {
    return row;
  }

  const relayId = row.relay_id || createRelayId();
  const nextHostToken = hostToken || createRelayToken();
  const nextClientToken = clientToken || createRelayToken();
  const updatedAt = row.updated_at ?? new Date().toISOString();

  getSqlite()
    .prepare(
      `UPDATE remote_relay_settings
       SET relay_id = ?, host_token_encrypted = ?, client_token_encrypted = ?, updated_at = ?
       WHERE id = 1`,
    )
    .run(
      relayId,
      encryptSecret(nextHostToken),
      encryptSecret(nextClientToken),
      updatedAt,
    );

  const refreshed = readRow();
  if (!refreshed) {
    throw new Error("Failed to initialize Mira Relay identity");
  }
  return refreshed;
};

const toRecord = (row: RelaySettingsRow): RemoteRelaySettingsRecord => {
  const hostToken = decryptSecret(row.host_token_encrypted);
  const clientToken = decryptSecret(row.client_token_encrypted);
  if (!row.relay_id || !hostToken || !clientToken) {
    throw new Error("Mira Relay identity is incomplete");
  }

  return {
    enabled: row.enabled === 1,
    endpointMode: normalizeMode(row.endpoint_mode),
    customUrl: row.custom_url.trim(),
    relayId: row.relay_id,
    hostToken,
    clientToken,
    updatedAt: row.updated_at,
  };
};

export const remoteRelaySettingsRepository = {
  initialize() {
    const row = readRow();
    if (!row) {
      throw new Error("Failed to initialize Mira Relay settings");
    }
    ensureIdentity(row);
  },

  get(): RemoteRelaySettingsRecord {
    const row = readRow();
    if (!row) {
      throw new Error("Failed to read Mira Relay settings");
    }
    return toRecord(ensureIdentity(row));
  },

  update(input: {
    enabled?: boolean;
    endpointMode?: RemoteRelayEndpointMode;
    customUrl?: string;
  }): RemoteRelaySettingsRecord {
    const current = this.get();
    const nextEnabled =
      typeof input.enabled === "boolean" ? input.enabled : current.enabled;
    const nextMode = input.endpointMode ?? current.endpointMode;
    const nextCustomUrl =
      typeof input.customUrl === "string"
        ? input.customUrl.trim()
        : current.customUrl;
    const updatedAt = new Date().toISOString();

    getSqlite()
      .prepare(
        `UPDATE remote_relay_settings
         SET enabled = ?, endpoint_mode = ?, custom_url = ?, updated_at = ?
         WHERE id = 1`,
      )
      .run(nextEnabled ? 1 : 0, nextMode, nextCustomUrl, updatedAt);

    return this.get();
  },
};
