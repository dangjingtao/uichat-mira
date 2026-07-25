import { getSqlite } from "../index.js";
import { decryptSecret, encryptSecret } from "@/utils/crypto.js";

export type GitHubConnectionStatus =
  | "unconfigured"
  | "authorizing"
  | "connected"
  | "error"
  | "disabled";

export type GitHubConnectionRecord = {
  id: string;
  clientId: string;
  appSlug: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  userId: string | null;
  login: string | null;
  avatarUrl: string | null;
  enabled: boolean;
  status: GitHubConnectionStatus;
  lastValidatedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};

const BUILTIN_GITHUB_APP_CLIENT_ID = "Iv23li60DOYKM6wpvuXn";
const BUILTIN_GITHUB_APP_SLUG = "uichat-mira-local-dev";

const resolveGitHubAppConfig = () => ({
  clientId:
    (process.env.UI_CHAT_GITHUB_APP_CLIENT_ID ?? "").trim() ||
    BUILTIN_GITHUB_APP_CLIENT_ID,
  appSlug:
    (process.env.UI_CHAT_GITHUB_APP_SLUG ?? "").trim() ||
    BUILTIN_GITHUB_APP_SLUG,
});

const ensureTable = () => {
  getSqlite().exec(`
    CREATE TABLE IF NOT EXISTS github_connections (
      id TEXT PRIMARY KEY NOT NULL DEFAULT 'default',
      client_id TEXT NOT NULL DEFAULT '',
      app_slug TEXT NOT NULL DEFAULT '',
      access_token_encrypted TEXT,
      refresh_token_encrypted TEXT,
      token_expires_at TEXT,
      refresh_token_expires_at TEXT,
      user_id TEXT,
      login TEXT,
      avatar_url TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'unconfigured',
      last_validated_at TEXT,
      last_error_code TEXT,
      last_error_message TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
};

const read = (): GitHubConnectionRecord | null => {
  const row = getSqlite()
    .prepare(`SELECT * FROM github_connections WHERE id = 'default'`)
    .get() as Record<string, unknown> | undefined;
  if (!row) return null;

  return {
    id: "default",
    clientId: String(row.client_id ?? ""),
    appSlug: String(row.app_slug ?? ""),
    accessToken: decryptSecret(
      typeof row.access_token_encrypted === "string"
        ? row.access_token_encrypted
        : null,
    ),
    refreshToken: decryptSecret(
      typeof row.refresh_token_encrypted === "string"
        ? row.refresh_token_encrypted
        : null,
    ),
    tokenExpiresAt:
      typeof row.token_expires_at === "string" ? row.token_expires_at : null,
    refreshTokenExpiresAt:
      typeof row.refresh_token_expires_at === "string"
        ? row.refresh_token_expires_at
        : null,
    userId: typeof row.user_id === "string" ? row.user_id : null,
    login: typeof row.login === "string" ? row.login : null,
    avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : null,
    enabled: Boolean(row.enabled),
    status: String(row.status ?? "unconfigured") as GitHubConnectionStatus,
    lastValidatedAt:
      typeof row.last_validated_at === "string"
        ? row.last_validated_at
        : null,
    lastErrorCode:
      typeof row.last_error_code === "string" ? row.last_error_code : null,
    lastErrorMessage:
      typeof row.last_error_message === "string"
        ? row.last_error_message
        : null,
  };
};

const withRuntimeDefaults = (
  connection: GitHubConnectionRecord | null,
): GitHubConnectionRecord | null => {
  if (!connection) return null;

  const appConfig = resolveGitHubAppConfig();
  return {
    ...connection,
    clientId: appConfig.clientId,
    appSlug: appConfig.appSlug,
  };
};

const upsert = (
  input: Partial<Omit<GitHubConnectionRecord, "id">>,
): GitHubConnectionRecord => {
  ensureTable();
  const current = read();
  const next = {
    clientId: input.clientId ?? current?.clientId ?? "",
    appSlug: input.appSlug ?? current?.appSlug ?? "",
    accessToken: input.accessToken ?? current?.accessToken ?? "",
    refreshToken: input.refreshToken ?? current?.refreshToken ?? "",
    tokenExpiresAt:
      input.tokenExpiresAt === undefined
        ? current?.tokenExpiresAt ?? null
        : input.tokenExpiresAt,
    refreshTokenExpiresAt:
      input.refreshTokenExpiresAt === undefined
        ? current?.refreshTokenExpiresAt ?? null
        : input.refreshTokenExpiresAt,
    userId: input.userId === undefined ? current?.userId ?? null : input.userId,
    login: input.login === undefined ? current?.login ?? null : input.login,
    avatarUrl:
      input.avatarUrl === undefined
        ? current?.avatarUrl ?? null
        : input.avatarUrl,
    enabled: input.enabled ?? current?.enabled ?? true,
    status: input.status ?? current?.status ?? "unconfigured",
    lastValidatedAt:
      input.lastValidatedAt === undefined
        ? current?.lastValidatedAt ?? null
        : input.lastValidatedAt,
    lastErrorCode:
      input.lastErrorCode === undefined
        ? current?.lastErrorCode ?? null
        : input.lastErrorCode,
    lastErrorMessage:
      input.lastErrorMessage === undefined
        ? current?.lastErrorMessage ?? null
        : input.lastErrorMessage,
  };

  getSqlite()
    .prepare(`
      INSERT INTO github_connections (
        id, client_id, app_slug, access_token_encrypted,
        refresh_token_encrypted, token_expires_at,
        refresh_token_expires_at, user_id, login, avatar_url,
        enabled, status, last_validated_at, last_error_code,
        last_error_message, updated_at
      ) VALUES (
        'default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
      )
      ON CONFLICT(id) DO UPDATE SET
        client_id=excluded.client_id,
        app_slug=excluded.app_slug,
        access_token_encrypted=excluded.access_token_encrypted,
        refresh_token_encrypted=excluded.refresh_token_encrypted,
        token_expires_at=excluded.token_expires_at,
        refresh_token_expires_at=excluded.refresh_token_expires_at,
        user_id=excluded.user_id,
        login=excluded.login,
        avatar_url=excluded.avatar_url,
        enabled=excluded.enabled,
        status=excluded.status,
        last_validated_at=excluded.last_validated_at,
        last_error_code=excluded.last_error_code,
        last_error_message=excluded.last_error_message,
        updated_at=datetime('now')
    `)
    .run(
      next.clientId.trim(),
      next.appSlug.trim(),
      encryptSecret(next.accessToken),
      encryptSecret(next.refreshToken),
      next.tokenExpiresAt,
      next.refreshTokenExpiresAt,
      next.userId,
      next.login,
      next.avatarUrl,
      next.enabled ? 1 : 0,
      next.status,
      next.lastValidatedAt,
      next.lastErrorCode,
      next.lastErrorMessage,
    );

  return withRuntimeDefaults(read())!;
};

export const githubConnectionRepository = {
  initialize() {
    ensureTable();
  },
  get() {
    ensureTable();
    return withRuntimeDefaults(read());
  },
  upsert,
  clearAuthorization() {
    return upsert({
      accessToken: "",
      refreshToken: "",
      tokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      userId: null,
      login: null,
      avatarUrl: null,
      status: "unconfigured",
      lastValidatedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    });
  },
};
