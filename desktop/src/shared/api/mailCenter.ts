import { get, patch, post } from "../lib/request";

export type MailAccountRecord = {
  id: string;
  name: string;
  emailAddress: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  hasSmtpPassword: boolean;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUsername: string;
  hasImapPassword: boolean;
  inboxFolderPath: string;
  status: "idle" | "connected" | "error";
  lastError: string | null;
  lastSyncedAt: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MailInboxMessage = {
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

export type MailCenterOverview = {
  accounts: MailAccountRecord[];
  selectedAccountId: string | null;
  inbox: {
    messageCount: number;
    unreadCount: number;
    lastSyncedAt: string | null;
    syncStatus: "idle" | "syncing" | "succeeded" | "failed";
    lastError: string | null;
    messages: MailInboxMessage[];
  } | null;
};

export type MailAccountPayload = {
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

export async function getMailCenterOverview(accountId?: string) {
  const query = accountId ? `?accountId=${encodeURIComponent(accountId)}` : "";
  return get<MailCenterOverview>(`/microapps/mail-center/overview${query}`);
}

export async function createMailAccount(payload: MailAccountPayload) {
  return post<{ account: MailAccountRecord }>("/microapps/mail-center/accounts", payload);
}

export async function updateMailAccount(id: string, payload: MailAccountPayload) {
  return patch<{ account: MailAccountRecord }>(
    `/microapps/mail-center/accounts/${id}`,
    payload,
  );
}

export async function sendMailAccountTest(
  id: string,
  input?: {
    to?: string;
    subject?: string;
    content?: string;
  },
) {
  return post<{
    accountId: string;
    accepted: string[];
    rejected: string[];
    response: string;
    messageId: string;
    target: string;
  }>(`/microapps/mail-center/accounts/${id}/test-send`, input ?? {});
}

export async function syncMailInbox(id: string) {
  return post<{
    accountId: string;
    messageCount: number;
    unreadCount: number;
    syncedCount: number;
    lastSyncedAt: string;
    messages: MailInboxMessage[];
  }>(`/microapps/mail-center/accounts/${id}/sync-inbox`);
}
