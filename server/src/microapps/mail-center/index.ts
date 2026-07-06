import nodemailer from "nodemailer";
import { ImapFlow, type MessageAddressObject } from "imapflow";
import { simpleParser } from "mailparser";
import {
  mailAccountsRepository,
  mailFoldersRepository,
  mailMessagesRepository,
  type MailAccountRecord,
} from "@/db/repositories/index.js";

export type MailAccountUpsertInput = {
  name: string;
  emailAddress: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPassword?: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUsername: string;
  imapPassword?: string;
  inboxFolderPath?: string;
  isDefault?: boolean;
};

export type MailTestSendInput = {
  to?: string;
  subject?: string;
  content?: string;
};

export type MailMessageSummary = {
  id: string;
  remoteUid: number;
  messageId: string | null;
  subject: string;
  fromDisplay: string;
  fromAddress: string;
  previewText: string;
  sentAt: string | null;
  receivedAt: string | null;
  isRead: boolean;
  isFlagged: boolean;
  hasAttachments: boolean;
};

type ParsedMailLike = {
  from?: { value?: MessageAddressObject[] };
  to?: { value?: MessageAddressObject[] };
  text?: string;
  html?: string | boolean;
  messageId?: string;
  subject?: string;
  date?: Date;
  attachments?: unknown[];
};

export type MailCenterOverview = {
  accounts: MailAccountRecord[];
  selectedAccountId: string | null;
  inbox: {
    messageCount: number;
    unreadCount: number;
    lastSyncedAt: string | null;
    syncStatus: "idle" | "syncing" | "succeeded" | "failed";
    lastError: string | null;
    messages: MailMessageSummary[];
  } | null;
};

const normalizeText = (value: string) => value.trim();

const normalizePreview = (value: string) =>
  value.replace(/\s+/g, " ").trim().slice(0, 240);

const formatAddress = (address?: MessageAddressObject | null) => ({
  name: normalizeText(address?.name ?? ""),
  address: normalizeText(address?.address ?? ""),
});

const assertRequired = (value: string | undefined, label: string) => {
  if (!value || !value.trim()) {
    throw new Error(`${label} is required`);
  }
};

const mapMessageSummaries = (
  items: ReturnType<typeof mailMessagesRepository.listRecentByFolder>,
): MailMessageSummary[] =>
  items.map((item) => ({
    id: item.id,
    remoteUid: item.remoteUid,
    messageId: item.messageId,
    subject: item.subject,
    fromDisplay: item.fromDisplay,
    fromAddress: item.fromAddress,
    previewText: item.previewText,
    sentAt: item.sentAt,
    receivedAt: item.receivedAt,
    isRead: item.isRead,
    isFlagged: item.isFlagged,
    hasAttachments: item.hasAttachments,
  }));

const validateAccountInput = (
  input: MailAccountUpsertInput,
  current?: MailAccountRecord | null,
) => {
  assertRequired(input.name, "name");
  assertRequired(input.emailAddress, "emailAddress");
  assertRequired(input.smtpHost, "smtpHost");
  assertRequired(input.smtpUsername, "smtpUsername");
  assertRequired(input.imapHost, "imapHost");
  assertRequired(input.imapUsername, "imapUsername");

  if (!Number.isInteger(input.smtpPort) || input.smtpPort <= 0) {
    throw new Error("smtpPort must be a positive integer");
  }
  if (!Number.isInteger(input.imapPort) || input.imapPort <= 0) {
    throw new Error("imapPort must be a positive integer");
  }

  if (!current) {
    assertRequired(input.smtpPassword, "smtpPassword");
    assertRequired(input.imapPassword, "imapPassword");
  }
};

const createSmtpTransport = (account: MailAccountRecord) =>
  nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpSecure,
    auth: {
      user: account.smtpUsername,
      pass: account.smtpPassword,
    },
  });

const createImapClient = (account: MailAccountRecord) =>
  new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: account.imapSecure,
    auth: {
      user: account.imapUsername,
      pass: account.imapPassword,
    },
    logger: false,
  });

export const createMailCenterService = () => ({
  getOverview(userId: number, accountId?: string | null): MailCenterOverview {
    const accounts = mailAccountsRepository.listByUser(userId);
    if (accounts.length === 0) {
      return {
        accounts: [],
        selectedAccountId: null,
        inbox: null,
      };
    }

    const selectedAccount =
      (accountId ? accounts.find((item) => item.id === accountId) : null) ??
      accounts.find((item) => item.isDefault) ??
      accounts[0];

    const folder = mailFoldersRepository.getByAccountAndKey(selectedAccount.id, "inbox");
    const messages = folder
      ? mailMessagesRepository.listRecentByFolder(folder.id, 20)
      : [];

    return {
      accounts,
      selectedAccountId: selectedAccount.id,
      inbox: folder
        ? {
            messageCount: folder.messageCount,
            unreadCount: folder.unreadCount,
            lastSyncedAt: folder.lastSyncedAt,
            syncStatus: folder.syncStatus,
            lastError: folder.lastError,
            messages: mapMessageSummaries(messages),
          }
        : {
            messageCount: 0,
            unreadCount: 0,
            lastSyncedAt: null,
            syncStatus: "idle",
            lastError: null,
            messages: [],
          },
    };
  },

  saveAccount(userId: number, input: MailAccountUpsertInput, accountId?: string) {
    const current = accountId
      ? mailAccountsRepository.getByIdForUser(accountId, userId)
      : null;
    if (accountId && !current) {
      throw new Error(`Mail account not found: ${accountId}`);
    }
    validateAccountInput(input, current);

    if (current) {
      const updated = mailAccountsRepository.update(current.id, {
        name: input.name,
        emailAddress: input.emailAddress,
        smtpHost: input.smtpHost,
        smtpPort: input.smtpPort,
        smtpSecure: input.smtpSecure,
        smtpUsername: input.smtpUsername,
        smtpPassword: input.smtpPassword,
        imapHost: input.imapHost,
        imapPort: input.imapPort,
        imapSecure: input.imapSecure,
        imapUsername: input.imapUsername,
        imapPassword: input.imapPassword,
        inboxFolderPath: input.inboxFolderPath,
        isDefault: input.isDefault,
      });
      if (!updated) {
        throw new Error(`Mail account not found: ${current.id}`);
      }
      return updated;
    }

    return mailAccountsRepository.create({
      userId,
      name: input.name,
      emailAddress: input.emailAddress,
      smtpHost: input.smtpHost,
      smtpPort: input.smtpPort,
      smtpSecure: input.smtpSecure,
      smtpUsername: input.smtpUsername,
      smtpPassword: input.smtpPassword,
      imapHost: input.imapHost,
      imapPort: input.imapPort,
      imapSecure: input.imapSecure,
      imapUsername: input.imapUsername,
      imapPassword: input.imapPassword,
      inboxFolderPath: input.inboxFolderPath,
      isDefault: input.isDefault,
    });
  },

  async sendTestMail(userId: number, accountId: string, input: MailTestSendInput) {
    const account = mailAccountsRepository.getByIdForUser(accountId, userId);
    if (!account) {
      throw new Error(`Mail account not found: ${accountId}`);
    }

    const transport = createSmtpTransport(account);
    const target = normalizeText(input.to ?? "") || account.emailAddress;
    const subject = normalizeText(input.subject ?? "") || "UIChat Mira Mail Center Test";
    const content =
      normalizeText(input.content ?? "") ||
      `This is a test email sent at ${new Date().toISOString()}.`;

    await transport.verify();
    const result = await transport.sendMail({
      from: account.name
        ? `"${account.name.replace(/"/g, "")}" <${account.emailAddress}>`
        : account.emailAddress,
      to: target,
      subject,
      text: content,
    });

    mailAccountsRepository.updateRuntimeStatus(account.id, {
      status: "connected",
      lastError: null,
      lastSyncedAt: account.lastSyncedAt,
    });

    return {
      accountId: account.id,
      accepted: result.accepted.map((value) => String(value)),
      rejected: result.rejected.map((value) => String(value)),
      response: result.response,
      messageId: result.messageId,
      target,
    };
  },

  async syncInbox(userId: number, accountId: string) {
    const account = mailAccountsRepository.getByIdForUser(accountId, userId);
    if (!account) {
      throw new Error(`Mail account not found: ${accountId}`);
    }

    const folder = mailFoldersRepository.ensureInbox(
      account.id,
      normalizeText(account.inboxFolderPath) || "INBOX",
    );
    mailFoldersRepository.update(folder.id, {
      syncStatus: "syncing",
      lastError: null,
    });

    const client = createImapClient(account);

    try {
      await client.connect();
      const lock = await client.getMailboxLock(folder.folderPath, {
        readOnly: true,
      });

      try {
        const mailbox = client.mailbox;
        const messageCount = mailbox ? mailbox.exists : 0;
        const status = await client.status(folder.folderPath, {
          messages: true,
          unseen: true,
        });
        const startSeq = Math.max(messageCount - 19, 1);
        const fetched: Array<{
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
        }> = [];

        if (messageCount > 0) {
          for await (const message of client.fetch(
            `${startSeq}:*`,
            {
              uid: true,
              envelope: true,
              flags: true,
              internalDate: true,
              source: true,
            },
            { uid: false },
          )) {
            const parsed = message.source
              ? ((await simpleParser(message.source)) as ParsedMailLike)
              : null;
            const from = parsed?.from?.value?.[0] ?? message.envelope?.from?.[0] ?? null;
            const toList =
              parsed?.to?.value?.map((item: MessageAddressObject) => formatAddress(item)) ??
              message.envelope?.to?.map((item) => formatAddress(item)) ??
              [];
            const textContent = normalizeText(parsed?.text ?? "");
            const previewText =
              normalizePreview(textContent) ||
              normalizePreview(parsed?.html ? String(parsed.html) : "") ||
              normalizePreview(message.envelope?.subject ?? "");

            fetched.push({
              remoteUid: message.uid,
              messageId:
                normalizeText(parsed?.messageId ?? "") ||
                normalizeText(message.envelope?.messageId ?? "") ||
                null,
              subject:
                normalizeText(parsed?.subject ?? "") ||
                normalizeText(message.envelope?.subject ?? "") ||
                "(no subject)",
              fromDisplay:
                normalizeText(from?.name ?? "") ||
                normalizeText(from?.address ?? "") ||
                "(unknown sender)",
              fromAddress: normalizeText(from?.address ?? ""),
              to: toList,
              previewText,
              textContent,
              sentAt:
                parsed?.date instanceof Date
                  ? parsed.date.toISOString()
                  : message.envelope?.date instanceof Date
                    ? message.envelope.date.toISOString()
                    : null,
              receivedAt:
                message.internalDate instanceof Date
                  ? message.internalDate.toISOString()
                  : typeof message.internalDate === "string"
                    ? new Date(message.internalDate).toISOString()
                    : null,
              isRead: Boolean(message.flags?.has("\\Seen")),
              isFlagged: Boolean(message.flags?.has("\\Flagged")),
              hasAttachments: Boolean(parsed?.attachments?.length),
              rawHeaders: {
                subject: normalizeText(message.envelope?.subject ?? ""),
                messageId: normalizeText(message.envelope?.messageId ?? ""),
              },
            });
          }
        }

        const sorted = fetched.sort((left, right) => {
          const leftAt = left.receivedAt ? new Date(left.receivedAt).getTime() : 0;
          const rightAt = right.receivedAt ? new Date(right.receivedAt).getTime() : 0;
          return rightAt - leftAt || right.remoteUid - left.remoteUid;
        });

        mailMessagesRepository.upsertMany(
          sorted.map((item: (typeof sorted)[number]) => ({
            accountId: account.id,
            folderId: folder.id,
            ...item,
          })),
        );

        const syncedAt = new Date().toISOString();
        mailFoldersRepository.update(folder.id, {
          messageCount: status.messages ?? messageCount,
          unreadCount: status.unseen ?? 0,
          syncStatus: "succeeded",
          lastSyncedAt: syncedAt,
          lastError: null,
        });
        mailAccountsRepository.updateRuntimeStatus(account.id, {
          status: "connected",
          lastError: null,
          lastSyncedAt: syncedAt,
        });

        return {
          accountId: account.id,
          messageCount: status.messages ?? messageCount,
          unreadCount: status.unseen ?? 0,
          syncedCount: sorted.length,
          lastSyncedAt: syncedAt,
          messages: mapMessageSummaries(
            mailMessagesRepository.listRecentByFolder(folder.id, 20),
          ),
        };
      } finally {
        lock.release();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to sync inbox";
      mailFoldersRepository.update(folder.id, {
        syncStatus: "failed",
        lastError: message,
      });
      mailAccountsRepository.updateRuntimeStatus(account.id, {
        status: "error",
        lastError: message,
        lastSyncedAt: account.lastSyncedAt,
      });
      throw error;
    } finally {
      await client.logout().catch(() => {
        client.close();
      });
    }
  },
});
