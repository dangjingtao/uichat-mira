import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  like,
  lt,
  lte,
  or,
} from "drizzle-orm";
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
  htmlContent: string;
  sentAt: string | null;
  receivedAt: string | null;
  isRead: boolean;
  isFlagged: boolean;
  hasAttachments: boolean;
  attachments: MailAttachmentSummary[];
  rawHeaders: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

type MailMessageUpsertInput = Omit<
  MailMessageRecord,
  "id" | "createdAt" | "updatedAt"
>;

export type MailMessageQueryInput = {
  accountIds: string[];
  messageIds?: string[];
  query?: string;
  from?: string;
  to?: string;
  subject?: string;
  since?: string;
  until?: string;
  unreadOnly?: boolean;
  flaggedOnly?: boolean;
  hasAttachments?: boolean;
  limit: number;
  cursor?: string;
};

export type MailAttachmentSummary = {
  filename: string;
  mimeType?: string;
  size?: number;
  available: boolean;
};

export type MailMessageQueryResult = {
  items: MailMessageRecord[];
  total: number;
  hasMore: boolean;
};

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
      html_content TEXT NOT NULL DEFAULT '',
      sent_at TEXT,
      received_at TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      is_flagged INTEGER NOT NULL DEFAULT 0,
      has_attachments INTEGER NOT NULL DEFAULT 0,
      attachments_json TEXT NOT NULL DEFAULT '[]',
      raw_headers_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (account_id) REFERENCES mail_accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (folder_id) REFERENCES mail_folders(id) ON DELETE CASCADE
    )
  `);
  const existingColumns = sqlite
    .prepare("PRAGMA table_info(mail_messages)")
    .all() as Array<{ name?: string }>;
  if (!existingColumns.some((column) => column.name === "attachments_json")) {
    sqlite.exec(
      "ALTER TABLE mail_messages ADD COLUMN attachments_json TEXT NOT NULL DEFAULT '[]'",
    );
  }
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

  const columns = sqlite
    .prepare("PRAGMA table_info(mail_messages)")
    .all() as Array<{ name?: string }>;
  const hasHtmlContent = columns.some((column) => column.name === "html_content");

  if (!hasHtmlContent) {
    sqlite.exec(
      "ALTER TABLE mail_messages ADD COLUMN html_content TEXT NOT NULL DEFAULT ''",
    );
  }
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
  htmlContent: row.htmlContent,
  sentAt: row.sentAt ?? null,
  receivedAt: row.receivedAt ?? null,
  isRead: Boolean(row.isRead),
  isFlagged: Boolean(row.isFlagged),
  hasAttachments: Boolean(row.hasAttachments),
  attachments: parseJson(
    (
      (getSqlite()
        .prepare("SELECT attachments_json AS value FROM mail_messages WHERE id = ?")
        .get(row.id) as { value?: string } | undefined)?.value ?? "[]"
    ),
    [],
  ),
  rawHeaders: parseJson(row.rawHeadersJson, {}),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const mailMessagesRepository = {
  initialize() {
    ensureTable();
  },

  getByIdForAccount(messageId: string, accountId: string) {
    const row = getDb()
      .select()
      .from(mailMessages)
      .where(
        and(
          eq(mailMessages.id, messageId),
          eq(mailMessages.accountId, accountId),
        ),
      )
      .get();

    return row ? toRecord(row) : null;
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

  query(input: MailMessageQueryInput): MailMessageQueryResult {
    if (input.accountIds.length === 0) {
      return { items: [], total: 0, hasMore: false };
    }

    const conditions = [inArray(mailMessages.accountId, input.accountIds)];
    const query = input.query?.trim();
    const from = input.from?.trim();
    const to = input.to?.trim();
    const subject = input.subject?.trim();

    if (input.messageIds && input.messageIds.length > 0) {
      conditions.push(inArray(mailMessages.id, input.messageIds));
    }
    if (query) {
      const pattern = `%${query}%`;
      conditions.push(
        or(
          like(mailMessages.subject, pattern),
          like(mailMessages.fromDisplay, pattern),
          like(mailMessages.fromAddress, pattern),
          like(mailMessages.toJson, pattern),
          like(mailMessages.previewText, pattern),
          like(mailMessages.textContent, pattern),
        )!,
      );
    }
    if (from) {
      conditions.push(
        or(
          like(mailMessages.fromDisplay, `%${from}%`),
          like(mailMessages.fromAddress, `%${from}%`),
        )!,
      );
    }
    if (to) conditions.push(like(mailMessages.toJson, `%${to}%`));
    if (subject) conditions.push(like(mailMessages.subject, `%${subject}%`));
    if (input.since) conditions.push(gte(mailMessages.receivedAt, input.since));
    if (input.until) conditions.push(lte(mailMessages.receivedAt, input.until));
    if (input.unreadOnly) conditions.push(eq(mailMessages.isRead, false));
    if (input.flaggedOnly) conditions.push(eq(mailMessages.isFlagged, true));
    if (typeof input.hasAttachments === "boolean") {
      conditions.push(eq(mailMessages.hasAttachments, input.hasAttachments));
    }

    const baseWhere = and(...conditions);
    const cursor = decodeCursor(input.cursor);
    if (cursor) {
      conditions.push(
        cursor.receivedAt === null
          ? and(
              isNull(mailMessages.receivedAt),
              or(
                lt(mailMessages.remoteUid, cursor.remoteUid),
                and(
                  eq(mailMessages.remoteUid, cursor.remoteUid),
                  lt(mailMessages.id, cursor.id),
                ),
              )!,
            )!
          : or(
              isNull(mailMessages.receivedAt),
              lt(mailMessages.receivedAt, cursor.receivedAt),
              and(
                eq(mailMessages.receivedAt, cursor.receivedAt),
                or(
                  lt(mailMessages.remoteUid, cursor.remoteUid),
                  and(
                    eq(mailMessages.remoteUid, cursor.remoteUid),
                    lt(mailMessages.id, cursor.id),
                  ),
                )!,
              ),
            )!,
      );
    }

    const where = and(...conditions);
    const rows = getDb()
      .select()
      .from(mailMessages)
      .where(where)
      .orderBy(
        desc(mailMessages.receivedAt),
        desc(mailMessages.remoteUid),
        desc(mailMessages.id),
      )
      .limit(input.limit + 1)
      .all();
    const total = getDb().select({ value: count() }).from(mailMessages).where(baseWhere).get()
      ?.value ?? 0;

    return {
      items: rows.slice(0, input.limit).map(toRecord),
      total,
      hasMore: rows.length > input.limit,
    };
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
              htmlContent: item.htmlContent,
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
          sqlite
            .prepare("UPDATE mail_messages SET attachments_json = ? WHERE id = ?")
            .run(JSON.stringify(item.attachments), existing.id);
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
            htmlContent: item.htmlContent,
            sentAt: item.sentAt,
            receivedAt: item.receivedAt,
            isRead: item.isRead,
            isFlagged: item.isFlagged,
            hasAttachments: item.hasAttachments,
            rawHeadersJson: JSON.stringify(item.rawHeaders),
          })
          .run();
        const inserted = getDb()
          .select({ id: mailMessages.id })
          .from(mailMessages)
          .where(
            and(
              eq(mailMessages.folderId, item.folderId),
              eq(mailMessages.remoteUid, item.remoteUid),
            ),
          )
          .get();
        if (inserted) {
          sqlite
            .prepare("UPDATE mail_messages SET attachments_json = ? WHERE id = ?")
            .run(JSON.stringify(item.attachments), inserted.id);
        }
      }
    });

    tx(messages);
  },
};

type MailCursor = { receivedAt: string | null; remoteUid: number; id: string };

const decodeCursor = (value?: string): MailCursor | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<MailCursor>;
    if (
      (typeof parsed.receivedAt !== "string" && parsed.receivedAt !== null) ||
      !Number.isInteger(parsed.remoteUid) ||
      typeof parsed.id !== "string" ||
      parsed.id.length === 0
    ) {
      return null;
    }
    return {
      receivedAt: parsed.receivedAt,
      remoteUid: parsed.remoteUid as number,
      id: parsed.id,
    };
  } catch {
    return null;
  }
};
