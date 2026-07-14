import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const imapMockState = vi.hoisted(() => ({
  fetchRanges: [] as string[],
  lockReadOnly: [] as boolean[],
}));

vi.mock("imapflow", () => ({
  ImapFlow: class {
    mailbox = { exists: 25 };

    async connect() {}

    async getMailboxLock(_folderPath: string, options: { readOnly?: boolean }) {
      imapMockState.lockReadOnly.push(Boolean(options.readOnly));
      return { release() {} };
    }

    async status() {
      return { messages: 25, unseen: 0 };
    }

    async *fetch(range: string) {
      imapMockState.fetchRanges.push(range);
      for (let uid = 6; uid <= 25; uid += 1) {
        yield {
          uid,
          envelope: {
            subject: `subject-${uid}`,
            from: [{ name: "Sender", address: "sender@example.com" }],
            to: [{ name: "Recipient", address: "recipient@example.com" }],
            date: new Date("2026-07-14T12:00:00.000Z"),
            messageId: `<message-${uid}@example.com>`,
          },
          flags: new Set<string>(),
          internalDate: new Date("2026-07-14T12:00:00.000Z"),
          source: null,
        };
      }
    }

    async logout() {}

    close() {}
  },
}));

import { getSqlite, resetDatabaseClients } from "@/db/index.js";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";
import {
  mailAccountsRepository,
  mailFoldersRepository,
  mailMessagesRepository,
} from "@/db/repositories/index.js";
import { createMailCenterService } from "./index.js";

const users = [1, 2];

const createAccount = (userId: number, id: string) => {
  const account = mailAccountsRepository.create({
    userId,
    name: `Account ${id}`,
    emailAddress: `${id}@example.com`,
    smtpHost: "smtp.example.com",
    smtpPort: 587,
    smtpSecure: false,
    smtpUsername: `${id}@example.com`,
    smtpPassword: "smtp-secret",
    imapHost: "imap.example.com",
    imapPort: 993,
    imapSecure: true,
    imapUsername: `${id}@example.com`,
    imapPassword: "imap-secret",
    isDefault: false,
  });
  getSqlite().prepare("UPDATE mail_accounts SET id = ? WHERE id = ?").run(id, account.id);
  return { ...account, id };
};

const insertMessage = (input: {
  accountId: string;
  folderId: string;
  id: string;
  remoteUid: number;
  subject: string;
  fromAddress: string;
  to: string;
  textContent: string;
  receivedAt: string;
  isRead?: boolean;
  isFlagged?: boolean;
  hasAttachments?: boolean;
}) => {
  mailMessagesRepository.upsertMany([
    {
      accountId: input.accountId,
      folderId: input.folderId,
      remoteUid: input.remoteUid,
      messageId: input.id,
      subject: input.subject,
      fromDisplay: input.fromAddress,
      fromAddress: input.fromAddress,
      to: [{ address: input.to }],
      previewText: input.textContent.slice(0, 30),
      textContent: input.textContent,
      htmlContent: "<p>private html</p>",
      sentAt: input.receivedAt,
      receivedAt: input.receivedAt,
      isRead: input.isRead ?? false,
      isFlagged: input.isFlagged ?? false,
      hasAttachments: input.hasAttachments ?? false,
      attachments: input.hasAttachments
        ? [{ filename: "quote.pdf", mimeType: "application/pdf", size: 1234, available: false }]
        : [],
      rawHeaders: { authorization: "do-not-return" },
    },
  ]);
  getSqlite().prepare("UPDATE mail_messages SET id = ? WHERE message_id = ?").run(input.id, input.id);
};

describe("MailCenter queryMail", () => {
  beforeEach(() => {
    imapMockState.fetchRanges.length = 0;
    imapMockState.lockReadOnly.length = 0;
    process.env.DATABASE_URL = `file:${createTimestampedTestArtifactPath("db", "mail-query", ".sqlite")}`;
    resetDatabaseClients();
    const sqlite = getSqlite();
    sqlite.exec(
      "CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    );
    for (const userId of users) {
      sqlite.prepare("INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)").run(userId, `user-${userId}`, "hash", "user");
    }
    mailAccountsRepository.initialize();
    mailFoldersRepository.initialize();
    mailMessagesRepository.initialize();
  });

  afterEach(() => {
    resetDatabaseClients();
    delete process.env.DATABASE_URL;
  });

  it("filters by the trusted user's accounts and structured predicates", async () => {
    const first = createAccount(1, "account-1");
    const other = createAccount(2, "account-2");
    const firstFolder = mailFoldersRepository.ensureInbox(first.id, "INBOX");
    const otherFolder = mailFoldersRepository.ensureInbox(other.id, "INBOX");
    insertMessage({
      accountId: first.id,
      folderId: firstFolder.id,
      id: "message-1",
      remoteUid: 1,
      subject: "Project quote",
      fromAddress: "client@example.com",
      to: "account-1@example.com",
      textContent: "quote and attachment",
      receivedAt: "2026-07-14T10:00:00.000Z",
      isFlagged: true,
      hasAttachments: true,
    });
    insertMessage({
      accountId: other.id,
      folderId: otherFolder.id,
      id: "message-2",
      remoteUid: 2,
      subject: "Project quote",
      fromAddress: "other@example.com",
      to: "account-2@example.com",
      textContent: "should stay private",
      receivedAt: "2026-07-14T11:00:00.000Z",
    });

    const result = await createMailCenterService().queryMail({
      userId: 1,
      query: "quote",
      from: "client",
      flaggedOnly: true,
      hasAttachments: true,
      includeBody: true,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "message-1",
      accountId: "account-1",
      textContent: "quote and attachment",
      attachments: [{ filename: "quote.pdf", mimeType: "application/pdf", size: 1234, available: false }],
    });
    expect(result.items[0]).not.toHaveProperty("htmlContent");
    expect(result.items[0]).not.toHaveProperty("rawHeaders");
  });

  it("supports detail IDs, default body redaction, and cursor pagination", async () => {
    const account = createAccount(1, "account-1");
    const folder = mailFoldersRepository.ensureInbox(account.id, "INBOX");
    for (const [id, remoteUid] of [["message-1", 1], ["message-2", 2]]) {
      insertMessage({
        accountId: account.id,
        folderId: folder.id,
        id,
        remoteUid,
        subject: id,
        fromAddress: "sender@example.com",
        to: "account-1@example.com",
        textContent: `body-${id}`,
        receivedAt: `2026-07-14T0${remoteUid}:00:00.000Z`,
      });
    }
    const service = createMailCenterService();
    const first = await service.queryMail({ userId: 1, limit: 1 });
    expect(first.items[0]).not.toHaveProperty("textContent");
    expect(first.nextCursor).toBeTruthy();
    const second = await service.queryMail({ userId: 1, cursor: first.nextCursor!, messageIds: ["message-1", "message-2"] });
    expect(second.items).toHaveLength(1);
    expect(second.items[0].id).not.toBe(first.items[0].id);
  });

  it("uses message id as the cursor tie-breaker across accounts", async () => {
    const first = createAccount(1, "account-1");
    const second = createAccount(1, "account-2");
    const firstFolder = mailFoldersRepository.ensureInbox(first.id, "INBOX");
    const secondFolder = mailFoldersRepository.ensureInbox(second.id, "INBOX");
    insertMessage({
      accountId: first.id,
      folderId: firstFolder.id,
      id: "message-a",
      remoteUid: 1,
      subject: "same sort key",
      fromAddress: "a@example.com",
      to: "account-1@example.com",
      textContent: "a",
      receivedAt: "2026-07-14T10:00:00.000Z",
    });
    insertMessage({
      accountId: second.id,
      folderId: secondFolder.id,
      id: "message-b",
      remoteUid: 1,
      subject: "same sort key",
      fromAddress: "b@example.com",
      to: "account-2@example.com",
      textContent: "b",
      receivedAt: "2026-07-14T10:00:00.000Z",
    });

    const service = createMailCenterService();
    const firstPage = await service.queryMail({ userId: 1, limit: 1 });
    const secondPage = await service.queryMail({ userId: 1, limit: 1, cursor: firstPage.nextCursor! });
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0].id).not.toBe(firstPage.items[0].id);
  });

  it("keeps sync none local and exposes safe sync outcomes", async () => {
    const account = createAccount(1, "account-1");
    const service = createMailCenterService();
    const syncInbox = vi.spyOn(service, "syncInbox");
    const local = await service.queryMail({ userId: 1, accountId: account.id, sync: "none" });
    expect(local.sync).toMatchObject({ requested: "none", performed: false, status: "skipped", syncedCount: 0 });
    expect(syncInbox).not.toHaveBeenCalled();

    syncInbox.mockResolvedValue({
      accountId: account.id,
      messageCount: 1,
      unreadCount: 0,
      syncedCount: 1,
      lastSyncedAt: "2026-07-14T12:00:00.000Z",
      messages: [],
    });
    const refreshed = await service.queryMail({ userId: 1, accountId: account.id, sync: "if-stale" });
    expect(refreshed.sync).toMatchObject({ requested: "if-stale", performed: true, status: "succeeded", syncedCount: 1 });
    expect(syncInbox).toHaveBeenCalledTimes(1);

    syncInbox.mockRejectedValue(new Error("AUTH failed at imap.example.com with imap-secret"));
    const failed = await service.queryMail({ userId: 1, accountId: account.id, sync: "force" });
    expect(failed.sync).toMatchObject({ requested: "force", performed: true, status: "failed" });
    expect(failed.sync.error).toBe("邮件同步失败，请检查账号连接状态");
    expect(JSON.stringify(failed)).not.toContain("imap-secret");
    expect(JSON.stringify(failed)).not.toContain("imap.example.com");
  });

  it("syncs only the most recent twenty messages through a read-only lock", async () => {
    const account = createAccount(1, "account-1");
    const result = await createMailCenterService().syncInbox(1, account.id);

    expect(result.syncedCount).toBe(20);
    expect(imapMockState.fetchRanges).toEqual(["6:*"]);
    expect(imapMockState.lockReadOnly).toEqual([true]);
  });
});
