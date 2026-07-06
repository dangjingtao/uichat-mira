import { and, eq } from "drizzle-orm";
import { getDb, getSqlite } from "../index";
import { mailFolders } from "../schema";
import { nowIso } from "@/utils/time.js";

export type MailFolderSyncStatus = "idle" | "syncing" | "succeeded" | "failed";

export type MailFolderRecord = {
  id: string;
  accountId: string;
  folderKey: string;
  folderName: string;
  folderPath: string;
  messageCount: number;
  unreadCount: number;
  syncStatus: MailFolderSyncStatus;
  lastSyncedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

const normalizeText = (value: string) => value.trim();

const ensureTable = () => {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mail_folders (
      id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
      account_id TEXT NOT NULL,
      folder_key TEXT NOT NULL DEFAULT 'inbox',
      folder_name TEXT NOT NULL DEFAULT 'Inbox',
      folder_path TEXT NOT NULL DEFAULT 'INBOX',
      message_count INTEGER NOT NULL DEFAULT 0,
      unread_count INTEGER NOT NULL DEFAULT 0,
      sync_status TEXT NOT NULL DEFAULT 'idle',
      last_synced_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (account_id) REFERENCES mail_accounts(id) ON DELETE CASCADE
    )
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_mail_folders_account_id
    ON mail_folders(account_id)
  `);
  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_mail_folders_account_folder_key
    ON mail_folders(account_id, folder_key)
  `);
};

const toRecord = (row: typeof mailFolders.$inferSelect): MailFolderRecord => ({
  id: row.id,
  accountId: row.accountId,
  folderKey: normalizeText(row.folderKey),
  folderName: normalizeText(row.folderName),
  folderPath: normalizeText(row.folderPath),
  messageCount: row.messageCount,
  unreadCount: row.unreadCount,
  syncStatus: row.syncStatus,
  lastSyncedAt: row.lastSyncedAt ?? null,
  lastError: row.lastError ?? null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const mailFoldersRepository = {
  initialize() {
    ensureTable();
  },

  getByAccountAndKey(accountId: string, folderKey: string) {
    const row = getDb()
      .select()
      .from(mailFolders)
      .where(
        and(
          eq(mailFolders.accountId, accountId),
          eq(mailFolders.folderKey, normalizeText(folderKey)),
        ),
      )
      .get();
    return row ? toRecord(row) : null;
  },

  ensureInbox(accountId: string, folderPath: string) {
    const current = this.getByAccountAndKey(accountId, "inbox");
    if (current) {
      if (current.folderPath !== folderPath || current.folderName !== "Inbox") {
        const updated = this.update(current.id, {
          folderName: "Inbox",
          folderPath,
        });
        if (!updated) {
          throw new Error(`Mail folder not found during inbox ensure: ${current.id}`);
        }
        return updated;
      }
      return current;
    }

    const row = getDb()
      .insert(mailFolders)
      .values({
        accountId,
        folderKey: "inbox",
        folderName: "Inbox",
        folderPath,
      })
      .returning()
      .get();
    return toRecord(row);
  },

  update(
    id: string,
    input: Partial<
      Pick<
        MailFolderRecord,
        | "folderName"
        | "folderPath"
        | "messageCount"
        | "unreadCount"
        | "syncStatus"
        | "lastSyncedAt"
        | "lastError"
      >
    >,
  ) {
    const current = getDb().select().from(mailFolders).where(eq(mailFolders.id, id)).get();
    if (!current) {
      return null;
    }

    const row = getDb()
      .update(mailFolders)
      .set({
        folderName:
          typeof input.folderName === "string" ? normalizeText(input.folderName) : current.folderName,
        folderPath:
          typeof input.folderPath === "string" ? normalizeText(input.folderPath) : current.folderPath,
        messageCount:
          typeof input.messageCount === "number" ? input.messageCount : current.messageCount,
        unreadCount:
          typeof input.unreadCount === "number" ? input.unreadCount : current.unreadCount,
        syncStatus:
          typeof input.syncStatus === "string" ? input.syncStatus : current.syncStatus,
        lastSyncedAt:
          typeof input.lastSyncedAt === "string"
            ? input.lastSyncedAt
            : input.lastSyncedAt === null
              ? null
              : current.lastSyncedAt,
        lastError:
          typeof input.lastError === "string"
            ? input.lastError
            : input.lastError === null
              ? null
              : current.lastError,
        updatedAt: nowIso(),
      })
      .where(eq(mailFolders.id, id))
      .returning()
      .get();

    return toRecord(row);
  },
};
