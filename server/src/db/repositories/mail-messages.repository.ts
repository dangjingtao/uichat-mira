import { and, desc, eq } from "drizzle-orm";
import { getDb, getSqlite } from "../index";
import { mailMessages } from "../schema";
import { nowIso } from "@/utils/time.js";

export type MailMessageRecord = {
  id: string;
  accountId: string;
  folderId: string;
  remoteUid: number;
  messageId: string | null;
  subject: string;
  fromDisplay: string;
  fromAddress: string;
  to: Array<{ name?: string; address?: string }>;
  previewText: string;
  textContent: string;
  sentAt: string | null;
  receivedAt: string | null;
  isRead: boolean;
  isFlagged: boolean;
  hasAttachments: boolean;
  rawHeaders: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

type MailMessageUpsertInput = Omit<
  MailMessageRecord,
  "id" | "createdAt" | "updatedAt"
>;

const normalizeText = (value: string) => value.trim();

const parseJson = <T>(value: string, fallback: T) => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const ensureTable = () => {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mail_messages (
      id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
      account_id TEXT NOT NULL,
      folder_id TEXT NOT NULL,
      remote_uid INTEGER NOT NULL,
      message_id TEXT,
      subject TEXT NOT NULL DEFAULT '',
      from_display TEXT NOT NULL DEFAULT '',
      from_address TEXT NOT NULL DEFAULT '',
      to_json TEXT NOT NULL DEFAULT '[]',
      preview_text TEXT NOT NULL DEFAULT '',
      text_content TEXT NOT NULL DEFAULT '',
      sent_at TEXT,
      received_at TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      is_flagged INTEGER NOT NULL DEFAULT 0,
      has_attachments INTEGER NOT NULL DEFAULT 0,
      raw_headers_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (account_id) REFERENCES mail_accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (folder_id) REFERENCES mail_folders(id) ON DELETE CASCADE
    )
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_mail_messages_folder_received
    ON mail_messages(folder_id, received_at)
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_mail_messages_account_id
    ON mail_messages(account_id)
  `);
  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_mail_messages_folder_remote_uid
    ON mail_messages(folder_id, remote_uid)
  `);
};

const toRecord = (row: typeof mailMessages.$inferSelect): MailMessageRecord => ({
  id: row.id,
  accountId: row.accountId,
  folderId: row.folderId,
  remoteUid: row.remoteUid,
  messageId: row.messageId ?? null,
  subject: normalizeText(row.subject),
  fromDisplay: normalizeText(row.fromDisplay),
  fromAddress: normalizeText(row.fromAddress),
  to: parseJson(row.toJson, []),
  previewText: row.previewText,
  textContent: row.textContent,
  sentAt: row.sentAt ?? null,
  receivedAt: row.receivedAt ?? null,
  isRead: Boolean(row.isRead),
  isFlagged: Boolean(row.isFlagged),
  hasAttachments: Boolean(row.hasAttachments),
  rawHeaders: parseJson(row.rawHeadersJson, {}),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const mailMessagesRepository = {
  initialize() {
    ensureTable();
  },

  listRecentByFolder(folderId: string, limit: number) {
    return getDb()
      .select()
      .from(mailMessages)
      .where(eq(mailMessages.folderId, folderId))
      .orderBy(desc(mailMessages.receivedAt), desc(mailMessages.remoteUid))
      .limit(limit)
      .all()
      .map(toRecord);
  },

  upsertMany(messages: MailMessageUpsertInput[]) {
    const sqlite = getSqlite();
    const tx = sqlite.transaction((items: MailMessageUpsertInput[]) => {
      for (const item of items) {
        const existing = getDb()
          .select()
          .from(mailMessages)
          .where(
            and(
              eq(mailMessages.folderId, item.folderId),
              eq(mailMessages.remoteUid, item.remoteUid),
            ),
          )
          .get();

        if (existing) {
          getDb()
            .update(mailMessages)
            .set({
              messageId: item.messageId,
              subject: item.subject,
              fromDisplay: item.fromDisplay,
              fromAddress: item.fromAddress,
              toJson: JSON.stringify(item.to),
              previewText: item.previewText,
              textContent: item.textContent,
              sentAt: item.sentAt,
              receivedAt: item.receivedAt,
              isRead: item.isRead,
              isFlagged: item.isFlagged,
              hasAttachments: item.hasAttachments,
              rawHeadersJson: JSON.stringify(item.rawHeaders),
              updatedAt: nowIso(),
            })
            .where(eq(mailMessages.id, existing.id))
            .run();
          continue;
        }

        getDb()
          .insert(mailMessages)
          .values({
            accountId: item.accountId,
            folderId: item.folderId,
            remoteUid: item.remoteUid,
            messageId: item.messageId,
            subject: item.subject,
            fromDisplay: item.fromDisplay,
            fromAddress: item.fromAddress,
            toJson: JSON.stringify(item.to),
            previewText: item.previewText,
            textContent: item.textContent,
            sentAt: item.sentAt,
            receivedAt: item.receivedAt,
            isRead: item.isRead,
            isFlagged: item.isFlagged,
            hasAttachments: item.hasAttachments,
            rawHeadersJson: JSON.stringify(item.rawHeaders),
          })
          .run();
      }
    });

    tx(messages);
  },
};
