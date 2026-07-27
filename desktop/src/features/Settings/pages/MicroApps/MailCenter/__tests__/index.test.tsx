// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MailCenterPage from "../index";
import type { MailCenterOverview } from "@/shared/api/mailCenter";

const {
  getMailCenterOverview,
  createMailAccount,
  updateMailAccount,
  deleteMailAccount,
  sendMailAccountTest,
  syncMailInbox,
  getMailMessageDetail,
  confirm,
} = vi.hoisted(() => ({
  getMailCenterOverview: vi.fn(),
  createMailAccount: vi.fn(),
  updateMailAccount: vi.fn(),
  deleteMailAccount: vi.fn(),
  sendMailAccountTest: vi.fn(),
  syncMailInbox: vi.fn(),
  getMailMessageDetail: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "zh-CN" },
  }),
}));

vi.mock("@/shared/ui", async () => {
  const actual = await vi.importActual<typeof import("@/shared/ui")>("@/shared/ui");
  return {
    ...actual,
    useModal: () => ({ confirm }),
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  };
});

vi.mock("@/shared/api/mailCenter", () => ({
  getMailCenterOverview,
  createMailAccount,
  updateMailAccount,
  deleteMailAccount,
  sendMailAccountTest,
  syncMailInbox,
  getMailMessageDetail,
}));

vi.mock("../components/MicroAppPageLayout", () => ({
  default: ({ title, slot, children }: { title: string; slot?: React.ReactNode; children: React.ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {slot}
      {children}
    </main>
  ),
}));

const account = {
  id: "account-1",
  name: "工作邮箱",
  emailAddress: "mail@example.com",
  smtpHost: "smtp.example.com",
  smtpPort: 587,
  smtpSecure: false,
  smtpUsername: "mail@example.com",
  hasSmtpPassword: true,
  imapHost: "imap.example.com",
  imapPort: 993,
  imapSecure: true,
  imapUsername: "mail@example.com",
  hasImapPassword: true,
  inboxFolderPath: "INBOX",
  status: "connected" as const,
  lastError: null,
  lastSyncedAt: "2026-07-27T08:00:00.000Z",
  isDefault: true,
  createdAt: "2026-07-27T08:00:00.000Z",
  updatedAt: "2026-07-27T08:00:00.000Z",
};

const emptyOverview: MailCenterOverview = {
  accounts: [],
  selectedAccountId: null,
  inbox: null,
};

const overviewWithAccount: MailCenterOverview = {
  accounts: [account],
  selectedAccountId: account.id,
  inbox: {
    messageCount: 1,
    unreadCount: 1,
    lastSyncedAt: account.lastSyncedAt,
    syncStatus: "succeeded",
    lastError: null,
    messages: [
      {
        id: "message-1",
        remoteUid: 1,
        messageId: "<message-1@example.com>",
        subject: "项目更新",
        fromDisplay: "发送者",
        fromAddress: "sender@example.com",
        previewText: "本周项目进展。",
        sentAt: "2026-07-27T07:00:00.000Z",
        receivedAt: "2026-07-27T07:30:00.000Z",
        isRead: false,
        isFlagged: false,
        hasAttachments: true,
      },
    ],
  },
};

describe("MailCenterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMailCenterOverview.mockResolvedValue(emptyOverview);
  });

  it("shows loading and empty account states", async () => {
    let resolveOverview!: (value: MailCenterOverview) => void;
    getMailCenterOverview.mockReturnValueOnce(
      new Promise<MailCenterOverview>((resolve) => {
        resolveOverview = resolve;
      }),
    );

    render(<MailCenterPage />);
    expect(screen.getByText("settings.microApps.mailCenter.states.loading")).toBeInTheDocument();

    resolveOverview(emptyOverview);
    await waitFor(() => {
      expect(screen.getByText("settings.microApps.mailCenter.states.emptyAccounts")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /settings\.microApps\.mailCenter\.actions\.newAccount/ })).toBeInTheDocument();
  });

  it("renders an account and inbox, then opens the create form", async () => {
    getMailCenterOverview.mockResolvedValue(overviewWithAccount);
    const user = userEvent.setup();

    render(<MailCenterPage />);
    expect(await screen.findByText("工作邮箱")).toBeInTheDocument();
    expect(screen.getByText("项目更新")).toBeInTheDocument();
    expect(screen.getByText("settings.microApps.mailCenter.labels.unread")).toBeInTheDocument();
    expect(screen.getByText("settings.microApps.mailCenter.labels.attachment")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "settings.microApps.mailCenter.actions.syncInbox" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /settings\.microApps\.mailCenter\.actions\.newAccount/ }));
    expect(screen.getByText("settings.microApps.mailCenter.modal.createTitle")).toBeInTheDocument();
    expect(screen.getByLabelText("settings.microApps.mailCenter.form.emailAddress")).toBeInTheDocument();
  });

  it("loads message details and invokes inbox sync", async () => {
    getMailCenterOverview.mockResolvedValue(overviewWithAccount);
    syncMailInbox.mockResolvedValue({
      accountId: account.id,
      messageCount: 1,
      unreadCount: 0,
      syncedCount: 1,
      lastSyncedAt: account.lastSyncedAt,
      messages: overviewWithAccount.inbox!.messages,
    });
    getMailMessageDetail.mockResolvedValue({
      message: {
        ...overviewWithAccount.inbox!.messages[0],
        to: [{ name: "收件人", address: "target@example.com" }],
        textContent: "完整正文",
        htmlContent: "",
        rawHeaders: {},
      },
    });
    const user = userEvent.setup();

    render(<MailCenterPage />);
    await user.click(await screen.findByRole("button", { name: /项目更新/ }));
    expect(await screen.findByText("完整正文")).toBeInTheDocument();
    expect(getMailMessageDetail).toHaveBeenCalledWith(account.id, "message-1");

    await user.click(screen.getByRole("button", { name: "settings.microApps.mailCenter.actions.syncInbox" }));
    await waitFor(() => expect(syncMailInbox).toHaveBeenCalledWith(account.id));
  });
});
