import { and, desc, eq } from "drizzle-orm";
import { getDb, getSqlite } from "../index";
import { mailAccounts } from "../schema";
import { decryptSecret, encryptSecret } from "@/utils/crypto.js";
import { nowIso } from "@/utils/time.js";

export type MailAccountStatus = "idle" | "connected" | "error";

export type MailAccountRecord = {
  id: string;
  userId: number;
  name: string;
  emailAddress: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPassword: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUsername: string;
  imapPassword: string;
  inboxFolderPath: string;
  status: MailAccountStatus;
  lastError: string | null;
  lastSyncedAt: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type MailAccountInput = Partial<
  Omit<MailAccountRecord, "id" | "createdAt" | "updatedAt" | "status" | "lastError" | "lastSyncedAt">
> & {
  userId?: number;
};

const normalizeText = (value: string) => value.trim();

const ensureTable = () => {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mail_accounts (
      id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      email_address TEXT NOT NULL DEFAULT '',
      smtp_host TEXT NOT NULL DEFAULT '',
      smtp_port INTEGER NOT NULL DEFAULT 587,
      smtp_secure INTEGER NOT NULL DEFAULT 0,
      smtp_username TEXT NOT NULL DEFAULT '',
      smtp_password_encrypted TEXT,
      imap_host TEXT NOT NULL DEFAULT '',
      imap_port INTEGER NOT NULL DEFAULT 993,
      imap_secure INTEGER NOT NULL DEFAULT 1,
      imap_username TEXT NOT NULL DEFAULT '',
      imap_password_encrypted TEXT,
      inbox_folder_path TEXT NOT NULL DEFAULT 'INBOX',
      status TEXT NOT NULL DEFAULT 'idle',
      last_error TEXT,
      last_synced_at TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_mail_accounts_user_id
    ON mail_accounts(user_id)
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_mail_accounts_status
    ON mail_accounts(status)
  `);
  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_mail_accounts_user_default
    ON mail_accounts(user_id, is_default)
    WHERE is_default = 1
  `);
};

const toRecord = (row: typeof mailAccounts.$inferSelect): MailAccountRecord => ({
  id: row.id,
  userId: row.userId,
  name: normalizeText(row.name),
  emailAddress: normalizeText(row.emailAddress),
  smtpHost: normalizeText(row.smtpHost),
  smtpPort: row.smtpPort,
  smtpSecure: Boolean(row.smtpSecure),
  smtpUsername: normalizeText(row.smtpUsername),
  smtpPassword: decryptSecret(row.smtpPasswordEncrypted ?? null),
  imapHost: normalizeText(row.imapHost),
  imapPort: row.imapPort,
  imapSecure: Boolean(row.imapSecure),
  imapUsername: normalizeText(row.imapUsername),
  imapPassword: decryptSecret(row.imapPasswordEncrypted ?? null),
  inboxFolderPath: normalizeText(row.inboxFolderPath) || "INBOX",
  status: row.status,
  lastError: row.lastError ?? null,
  lastSyncedAt: row.lastSyncedAt ?? null,
  isDefault: Boolean(row.isDefault),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const clearDefaultIfNeeded = (userId: number, nextIsDefault: boolean) => {
  if (!nextIsDefault) {
    return;
  }

  getDb()
    .update(mailAccounts)
    .set({
      isDefault: false,
      updatedAt: nowIso(),
    })
    .where(and(eq(mailAccounts.userId, userId), eq(mailAccounts.isDefault, true)))
    .run();
};

export const mailAccountsRepository = {
  initialize() {
    ensureTable();
  },

  listByUser(userId: number) {
    return getDb()
      .select()
      .from(mailAccounts)
      .where(eq(mailAccounts.userId, userId))
      .orderBy(desc(mailAccounts.isDefault), desc(mailAccounts.updatedAt))
      .all()
      .map(toRecord);
  },

  getById(id: string) {
    const row = getDb()
      .select()
      .from(mailAccounts)
      .where(eq(mailAccounts.id, id))
      .get();
    return row ? toRecord(row) : null;
  },

  getByIdForUser(id: string, userId: number) {
    const row = getDb()
      .select()
      .from(mailAccounts)
      .where(and(eq(mailAccounts.id, id), eq(mailAccounts.userId, userId)))
      .get();
    return row ? toRecord(row) : null;
  },

  getDefaultByUser(userId: number) {
    const row = getDb()
      .select()
      .from(mailAccounts)
      .where(and(eq(mailAccounts.userId, userId), eq(mailAccounts.isDefault, true)))
      .get();
    return row ? toRecord(row) : null;
  },

  create(input: MailAccountInput) {
    if (!input.userId) {
      throw new Error("userId is required");
    }

    const isDefault = input.isDefault ?? this.listByUser(input.userId).length === 0;
    clearDefaultIfNeeded(input.userId, isDefault);

    const row = getDb()
      .insert(mailAccounts)
      .values({
        userId: input.userId,
        name: normalizeText(input.name ?? ""),
        emailAddress: normalizeText(input.emailAddress ?? ""),
        smtpHost: normalizeText(input.smtpHost ?? ""),
        smtpPort: input.smtpPort ?? 587,
        smtpSecure: input.smtpSecure ?? false,
        smtpUsername: normalizeText(input.smtpUsername ?? ""),
        smtpPasswordEncrypted: encryptSecret(input.smtpPassword?.trim() ?? ""),
        imapHost: normalizeText(input.imapHost ?? ""),
        imapPort: input.imapPort ?? 993,
        imapSecure: input.imapSecure ?? true,
        imapUsername: normalizeText(input.imapUsername ?? ""),
        imapPasswordEncrypted: encryptSecret(input.imapPassword?.trim() ?? ""),
        inboxFolderPath: normalizeText(input.inboxFolderPath ?? "INBOX") || "INBOX",
        isDefault,
      })
      .returning()
      .get();

    return toRecord(row);
  },

  update(id: string, input: MailAccountInput) {
    const current = this.getById(id);
    if (!current) {
      return null;
    }

    const next = {
      name: typeof input.name === "string" ? normalizeText(input.name) : current.name,
      emailAddress:
        typeof input.emailAddress === "string"
          ? normalizeText(input.emailAddress)
          : current.emailAddress,
      smtpHost:
        typeof input.smtpHost === "string"
          ? normalizeText(input.smtpHost)
          : current.smtpHost,
      smtpPort: typeof input.smtpPort === "number" ? input.smtpPort : current.smtpPort,
      smtpSecure:
        typeof input.smtpSecure === "boolean" ? input.smtpSecure : current.smtpSecure,
      smtpUsername:
        typeof input.smtpUsername === "string"
          ? normalizeText(input.smtpUsername)
          : current.smtpUsername,
      smtpPassword:
        typeof input.smtpPassword === "string" ? input.smtpPassword.trim() : current.smtpPassword,
      imapHost:
        typeof input.imapHost === "string"
          ? normalizeText(input.imapHost)
          : current.imapHost,
      imapPort: typeof input.imapPort === "number" ? input.imapPort : current.imapPort,
      imapSecure:
        typeof input.imapSecure === "boolean" ? input.imapSecure : current.imapSecure,
      imapUsername:
        typeof input.imapUsername === "string"
          ? normalizeText(input.imapUsername)
          : current.imapUsername,
      imapPassword:
        typeof input.imapPassword === "string" ? input.imapPassword.trim() : current.imapPassword,
      inboxFolderPath:
        typeof input.inboxFolderPath === "string"
          ? normalizeText(input.inboxFolderPath) || "INBOX"
          : current.inboxFolderPath,
      isDefault:
        typeof input.isDefault === "boolean" ? input.isDefault : current.isDefault,
    };

    clearDefaultIfNeeded(current.userId, next.isDefault);

    const row = getDb()
      .update(mailAccounts)
      .set({
        name: next.name,
        emailAddress: next.emailAddress,
        smtpHost: next.smtpHost,
        smtpPort: next.smtpPort,
        smtpSecure: next.smtpSecure,
        smtpUsername: next.smtpUsername,
        smtpPasswordEncrypted: encryptSecret(next.smtpPassword),
        imapHost: next.imapHost,
        imapPort: next.imapPort,
        imapSecure: next.imapSecure,
        imapUsername: next.imapUsername,
        imapPasswordEncrypted: encryptSecret(next.imapPassword),
        inboxFolderPath: next.inboxFolderPath,
        isDefault: next.isDefault,
        updatedAt: nowIso(),
      })
      .where(eq(mailAccounts.id, id))
      .returning()
      .get();

    return toRecord(row);
  },

  updateRuntimeStatus(
    id: string,
    input: {
      status: MailAccountStatus;
      lastError?: string | null;
      lastSyncedAt?: string | null;
    },
  ) {
    const row = getDb()
      .update(mailAccounts)
      .set({
        status: input.status,
        lastError: input.lastError ?? null,
        lastSyncedAt: input.lastSyncedAt ?? null,
        updatedAt: nowIso(),
      })
      .where(eq(mailAccounts.id, id))
      .returning()
      .get();

    return row ? toRecord(row) : null;
  },
};
