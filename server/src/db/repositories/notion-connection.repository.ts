import { getSqlite } from "../index.js";
import { decryptSecret, encryptSecret } from "@/utils/crypto.js";

export type NotionConnectionStatus = "unconfigured" | "validating" | "connected" | "error" | "disabled";

export type NotionConnectionRecord = {
  id: string;
  name: string;
  workspaceId: string | null;
  workspaceName: string | null;
  token: string;
  enabled: boolean;
  defaultReadOnly: boolean;
  status: NotionConnectionStatus;
  lastValidatedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};

const ensureTable = () => {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS notion_connections (
      id TEXT PRIMARY KEY NOT NULL DEFAULT 'default',
      name TEXT NOT NULL DEFAULT 'Notion Workspace',
      workspace_id TEXT,
      workspace_name TEXT,
      token_encrypted TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      default_read_only INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'unconfigured',
      last_validated_at TEXT,
      last_error_code TEXT,
      last_error_message TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
};

const read = (): NotionConnectionRecord | null => {
  const row = getSqlite().prepare(`SELECT * FROM notion_connections WHERE id = 'default'`).get() as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: "default",
    name: String(row.name ?? "Notion Workspace"),
    workspaceId: typeof row.workspace_id === "string" ? row.workspace_id : null,
    workspaceName: typeof row.workspace_name === "string" ? row.workspace_name : null,
    token: decryptSecret(typeof row.token_encrypted === "string" ? row.token_encrypted : null),
    enabled: Boolean(row.enabled),
    defaultReadOnly: Boolean(row.default_read_only),
    status: String(row.status ?? "unconfigured") as NotionConnectionStatus,
    lastValidatedAt: typeof row.last_validated_at === "string" ? row.last_validated_at : null,
    lastErrorCode: typeof row.last_error_code === "string" ? row.last_error_code : null,
    lastErrorMessage: typeof row.last_error_message === "string" ? row.last_error_message : null,
  };
};

export const notionConnectionRepository = {
  initialize() {
    ensureTable();
  },
  get() {
    ensureTable();
    return read();
  },
  upsert(input: Partial<Omit<NotionConnectionRecord, "id">>) {
    ensureTable();
    const current = read();
    const next = {
      name: input.name ?? current?.name ?? "Notion Workspace",
      workspaceId: input.workspaceId === undefined ? current?.workspaceId ?? null : input.workspaceId,
      workspaceName: input.workspaceName === undefined ? current?.workspaceName ?? null : input.workspaceName,
      token: input.token === undefined ? current?.token ?? "" : input.token,
      enabled: input.enabled ?? current?.enabled ?? true,
      defaultReadOnly: input.defaultReadOnly ?? current?.defaultReadOnly ?? true,
      status: input.status ?? current?.status ?? "unconfigured",
      lastValidatedAt: input.lastValidatedAt === undefined ? current?.lastValidatedAt ?? null : input.lastValidatedAt,
      lastErrorCode: input.lastErrorCode === undefined ? current?.lastErrorCode ?? null : input.lastErrorCode,
      lastErrorMessage: input.lastErrorMessage === undefined ? current?.lastErrorMessage ?? null : input.lastErrorMessage,
    };
    getSqlite().prepare(`
      INSERT INTO notion_connections
        (id, name, workspace_id, workspace_name, token_encrypted, enabled, default_read_only, status, last_validated_at, last_error_code, last_error_message, updated_at)
      VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name, workspace_id=excluded.workspace_id, workspace_name=excluded.workspace_name,
        token_encrypted=excluded.token_encrypted, enabled=excluded.enabled, default_read_only=excluded.default_read_only,
        status=excluded.status, last_validated_at=excluded.last_validated_at,
        last_error_code=excluded.last_error_code, last_error_message=excluded.last_error_message, updated_at=datetime('now')
    `).run(next.name.trim(), next.workspaceId, next.workspaceName, encryptSecret(next.token), next.enabled ? 1 : 0, next.defaultReadOnly ? 1 : 0, next.status, next.lastValidatedAt, next.lastErrorCode, next.lastErrorMessage);
    return read()!;
  },
};
