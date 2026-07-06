import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CircleHelp,
  ExternalLink,
  Mail,
  MailCheck,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Send,
  ServerCog,
} from "lucide-react";
import SettingsPageLayout from "../../../components/SettingsPageLayout";
import Card from "@/shared/ui/Card";
import Badge from "@/shared/ui/Badge";
import Divider from "@/shared/ui/Divider";
import Switch from "@/shared/ui/Switch";
import {
  Button,
  FullPageStatus,
  Modal,
  Select,
  TextInput,
  Tooltip,
  message,
} from "@/shared/ui";
import {
  createMailAccount,
  getMailCenterOverview,
  sendMailAccountTest,
  syncMailInbox,
  updateMailAccount,
  type MailAccountPayload,
  type MailAccountRecord,
  type MailCenterOverview,
} from "@/shared/api/mailCenter";

type MailAccountForm = {
  name: string;
  emailAddress: string;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPassword: string;
  imapHost: string;
  imapPort: string;
  imapSecure: boolean;
  imapUsername: string;
  imapPassword: string;
  inboxFolderPath: string;
  isDefault: boolean;
};

type MailProviderId = "custom" | "gmail" | "outlook" | "qq" | "netease163";

type MailProviderProfile = {
  id: MailProviderId;
  label: string;
  note: string;
  defaults: Pick<
    MailAccountForm,
    | "smtpHost"
    | "smtpPort"
    | "smtpSecure"
    | "imapHost"
    | "imapPort"
    | "imapSecure"
    | "inboxFolderPath"
  >;
  passwordMode: string;
  docs: Array<{
    label: string;
    url: string;
  }>;
};

const fieldClassName =
  "h-10 w-full rounded-ui-control border border-border bg-surface-primary px-3.5 text-sm text-text-primary shadow-shadow-sm transition-[background-color,border-color,box-shadow] duration-150 ease-out placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const textAreaClassName =
  "min-h-[88px] w-full rounded-ui-control border border-border bg-surface-primary px-3.5 py-2.5 text-sm text-text-primary shadow-shadow-sm transition-[background-color,border-color,box-shadow] duration-150 ease-out placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const createBlankForm = (): MailAccountForm => ({
  name: "",
  emailAddress: "",
  smtpHost: "",
  smtpPort: "587",
  smtpSecure: false,
  smtpUsername: "",
  smtpPassword: "",
  imapHost: "",
  imapPort: "993",
  imapSecure: true,
  imapUsername: "",
  imapPassword: "",
  inboxFolderPath: "INBOX",
  isDefault: false,
});

const toForm = (account: MailAccountRecord): MailAccountForm => ({
  name: account.name,
  emailAddress: account.emailAddress,
  smtpHost: account.smtpHost,
  smtpPort: String(account.smtpPort),
  smtpSecure: account.smtpSecure,
  smtpUsername: account.smtpUsername,
  smtpPassword: "",
  imapHost: account.imapHost,
  imapPort: String(account.imapPort),
  imapSecure: account.imapSecure,
  imapUsername: account.imapUsername,
  imapPassword: "",
  inboxFolderPath: account.inboxFolderPath || "INBOX",
  isDefault: account.isDefault,
});

const providerIds: MailProviderId[] = [
  "custom",
  "gmail",
  "outlook",
  "qq",
  "netease163",
];

const normalizeValue = (value: string) => value.trim().toLowerCase();

const matchesProviderDefaults = (
  form: Pick<
    MailAccountForm,
    "smtpHost" | "smtpPort" | "smtpSecure" | "imapHost" | "imapPort" | "imapSecure"
  >,
  profile: MailProviderProfile,
) =>
  normalizeValue(form.smtpHost) === normalizeValue(profile.defaults.smtpHost) &&
  form.smtpPort === profile.defaults.smtpPort &&
  form.smtpSecure === profile.defaults.smtpSecure &&
  normalizeValue(form.imapHost) === normalizeValue(profile.defaults.imapHost) &&
  form.imapPort === profile.defaults.imapPort &&
  form.imapSecure === profile.defaults.imapSecure;

const detectMailProvider = (
  form: Pick<
    MailAccountForm,
    "smtpHost" | "smtpPort" | "smtpSecure" | "imapHost" | "imapPort" | "imapSecure"
  >,
  profiles: Record<MailProviderId, MailProviderProfile>,
): MailProviderId =>
  providerIds.find(
    (providerId) =>
      providerId !== "custom" && matchesProviderDefaults(form, profiles[providerId]),
  ) ?? "custom";

const applyProviderDefaults = (
  current: MailAccountForm,
  profile: MailProviderProfile,
): MailAccountForm => {
  const emailAddress = current.emailAddress.trim();

  return {
    ...current,
    name: current.name || (profile.id === "custom" ? "" : profile.label),
    smtpHost: profile.defaults.smtpHost,
    smtpPort: profile.defaults.smtpPort,
    smtpSecure: profile.defaults.smtpSecure,
    smtpUsername: emailAddress || current.smtpUsername,
    imapHost: profile.defaults.imapHost,
    imapPort: profile.defaults.imapPort,
    imapSecure: profile.defaults.imapSecure,
    imapUsername: emailAddress || current.imapUsername,
    inboxFolderPath: profile.defaults.inboxFolderPath,
  };
};

function InlineHelpLabel({
  label,
  help,
}: {
  label: string;
  help: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span>{label}</span>
      <Tooltip text={help} placement="top">
        <span className="text-icon-secondary">
          <CircleHelp className="h-3.5 w-3.5" />
        </span>
      </Tooltip>
    </div>
  );
}

const toPayload = (
  form: MailAccountForm,
  preserveSecrets: boolean,
): MailAccountPayload => {
  const payload: MailAccountPayload = {
    name: form.name.trim(),
    emailAddress: form.emailAddress.trim(),
    smtpHost: form.smtpHost.trim(),
    smtpPort: Number(form.smtpPort),
    smtpSecure: form.smtpSecure,
    smtpUsername: form.smtpUsername.trim(),
    imapHost: form.imapHost.trim(),
    imapPort: Number(form.imapPort),
    imapSecure: form.imapSecure,
    imapUsername: form.imapUsername.trim(),
    inboxFolderPath: form.inboxFolderPath.trim() || "INBOX",
    isDefault: form.isDefault,
  };

  if (!preserveSecrets || form.smtpPassword.trim()) {
    payload.smtpPassword = form.smtpPassword;
  }

  if (!preserveSecrets || form.imapPassword.trim()) {
    payload.imapPassword = form.imapPassword;
  }

  return payload;
};

export default function MailCenterPage() {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [overview, setOverview] = useState<MailCenterOverview | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [selectedProviderId, setSelectedProviderId] =
    useState<MailProviderId>("custom");
  const [form, setForm] = useState<MailAccountForm>(createBlankForm);
  const [testTarget, setTestTarget] = useState("");
  const [testSubject, setTestSubject] = useState("UIChat Mira Mail Center Test");
  const [testContent, setTestContent] = useState(
    "这是一封来自 UIChat Mira 邮件中心的测试邮件。",
  );

  const selectedAccount = useMemo(
    () =>
      overview?.accounts.find((account) => account.id === editingAccountId) ?? null,
    [editingAccountId, overview?.accounts],
  );

  const providerProfiles = useMemo<Record<MailProviderId, MailProviderProfile>>(
    () => ({
      custom: {
        id: "custom",
        label: t("settings.microApps.mailCenter.provider.options.custom"),
        note: t("settings.microApps.mailCenter.provider.notes.custom"),
        defaults: {
          smtpHost: "",
          smtpPort: "587",
          smtpSecure: false,
          imapHost: "",
          imapPort: "993",
          imapSecure: true,
          inboxFolderPath: "INBOX",
        },
        passwordMode: t("settings.microApps.mailCenter.provider.passwordModes.custom"),
        docs: [],
      },
      gmail: {
        id: "gmail",
        label: t("settings.microApps.mailCenter.provider.options.gmail"),
        note: t("settings.microApps.mailCenter.provider.notes.gmail"),
        defaults: {
          smtpHost: "smtp.gmail.com",
          smtpPort: "587",
          smtpSecure: false,
          imapHost: "imap.gmail.com",
          imapPort: "993",
          imapSecure: true,
          inboxFolderPath: "INBOX",
        },
        passwordMode: t("settings.microApps.mailCenter.provider.passwordModes.gmail"),
        docs: [
          {
            label: t("settings.microApps.mailCenter.provider.docs.imapSmtpGuide"),
            url: "https://developers.google.com/workspace/gmail/imap/imap-smtp",
          },
          {
            label: t("settings.microApps.mailCenter.provider.docs.appPassword"),
            url: "https://support.google.com/accounts/answer/185833?hl=en",
          },
        ],
      },
      outlook: {
        id: "outlook",
        label: t("settings.microApps.mailCenter.provider.options.outlook"),
        note: t("settings.microApps.mailCenter.provider.notes.outlook"),
        defaults: {
          smtpHost: "smtp-mail.outlook.com",
          smtpPort: "587",
          smtpSecure: false,
          imapHost: "outlook.office365.com",
          imapPort: "993",
          imapSecure: true,
          inboxFolderPath: "INBOX",
        },
        passwordMode: t("settings.microApps.mailCenter.provider.passwordModes.outlook"),
        docs: [
          {
            label: t("settings.microApps.mailCenter.provider.docs.manualSettings"),
            url: "https://support.microsoft.com/en-us/outlook/pop-imap-and-smtp-settings-for-outlook-com-d088b986-291d-42b8-9564-9c414e2aa040",
          },
          {
            label: t("settings.microApps.mailCenter.provider.docs.appPassword"),
            url: "https://support.microsoft.com/en-us/account-billing/how-to-get-and-use-app-passwords-5896ed9b-4263-e681-128a-a6f2979a7944",
          },
        ],
      },
      qq: {
        id: "qq",
        label: t("settings.microApps.mailCenter.provider.options.qq"),
        note: t("settings.microApps.mailCenter.provider.notes.qq"),
        defaults: {
          smtpHost: "smtp.qq.com",
          smtpPort: "465",
          smtpSecure: true,
          imapHost: "imap.qq.com",
          imapPort: "993",
          imapSecure: true,
          inboxFolderPath: "INBOX",
        },
        passwordMode: t("settings.microApps.mailCenter.provider.passwordModes.qq"),
        docs: [
          {
            label: t("settings.microApps.mailCenter.provider.docs.imapSwitch"),
            url: "https://service.mail.qq.com/detail/0/141",
          },
          {
            label: t("settings.microApps.mailCenter.provider.docs.smtpSwitch"),
            url: "https://service.mail.qq.com/detail?search=SMTP",
          },
        ],
      },
      netease163: {
        id: "netease163",
        label: t("settings.microApps.mailCenter.provider.options.netease163"),
        note: t("settings.microApps.mailCenter.provider.notes.netease163"),
        defaults: {
          smtpHost: "smtp.163.com",
          smtpPort: "465",
          smtpSecure: true,
          imapHost: "imap.163.com",
          imapPort: "993",
          imapSecure: true,
          inboxFolderPath: "INBOX",
        },
        passwordMode: t(
          "settings.microApps.mailCenter.provider.passwordModes.netease163",
        ),
        docs: [
          {
            label: t("settings.microApps.mailCenter.provider.docs.mailSettings"),
            url: "https://help.mail.163.com/faqDetail.do?code=d7a5dc8471cd0c0e8b4b8f4f8e49998b374173cfe9171305fa1ce630d7f67ac2a5feb28b66796d3b",
          },
        ],
      },
    }),
    [t],
  );

  const providerOptions = useMemo(
    () =>
      providerIds.map((providerId) => ({
        value: providerId,
        label: providerProfiles[providerId].label,
      })),
    [providerProfiles],
  );

  const selectedProviderProfile = providerProfiles[selectedProviderId];

  const fieldHelp = useMemo(
    () => ({
      provider: t("settings.microApps.mailCenter.help.provider"),
      accountName: t("settings.microApps.mailCenter.help.accountName"),
      emailAddress: t("settings.microApps.mailCenter.help.emailAddress"),
      smtpHost: t("settings.microApps.mailCenter.help.smtpHost", {
        value:
          selectedProviderProfile.defaults.smtpHost ||
          t("settings.microApps.mailCenter.values.manualInput"),
      }),
      smtpPort: t("settings.microApps.mailCenter.help.smtpPort", {
        value: selectedProviderProfile.defaults.smtpPort,
      }),
      smtpUsername: t("settings.microApps.mailCenter.help.smtpUsername"),
      smtpPassword: t("settings.microApps.mailCenter.help.smtpPassword", {
        value: selectedProviderProfile.passwordMode,
      }),
      imapHost: t("settings.microApps.mailCenter.help.imapHost", {
        value:
          selectedProviderProfile.defaults.imapHost ||
          t("settings.microApps.mailCenter.values.manualInput"),
      }),
      imapPort: t("settings.microApps.mailCenter.help.imapPort", {
        value: selectedProviderProfile.defaults.imapPort,
      }),
      imapUsername: t("settings.microApps.mailCenter.help.imapUsername"),
      imapPassword: t("settings.microApps.mailCenter.help.imapPassword", {
        value: selectedProviderProfile.passwordMode,
      }),
      inboxFolderPath: t("settings.microApps.mailCenter.help.inboxFolderPath"),
      smtpSecure: t("settings.microApps.mailCenter.help.smtpSecure"),
      imapSecure: t("settings.microApps.mailCenter.help.imapSecure"),
      defaultAccount: t("settings.microApps.mailCenter.help.defaultAccount"),
    }),
    [selectedProviderProfile, t],
  );

  const formatDateTime = (value: string | null) => {
    if (!value) {
      return t("settings.microApps.mailCenter.values.notSynced");
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString(i18n.language === "en-US" ? "en-US" : "zh-CN", {
      hour12: false,
    });
  };

  const load = async (accountId?: string | null) => {
    setLoading(true);
    try {
      const nextOverview = await getMailCenterOverview(accountId ?? undefined);
      setOverview(nextOverview);

      const nextSelectedId = nextOverview.selectedAccountId;
      if (!nextSelectedId) {
        setEditingAccountId(null);
        setSelectedProviderId("custom");
        setForm(createBlankForm());
        setTestTarget("");
        return;
      }

      const account =
        nextOverview.accounts.find((item) => item.id === nextSelectedId) ?? null;
      if (!account) {
        return;
      }

      setEditingAccountId(account.id);
      const nextForm = toForm(account);
      setSelectedProviderId(detectMailProvider(nextForm, providerProfiles));
      setForm(nextForm);
      setTestTarget(account.emailAddress);
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : t("settings.microApps.mailCenter.messages.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const updateForm = <K extends keyof MailAccountForm>(
    key: K,
    value: MailAccountForm[K],
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const openCreateModal = () => {
    setEditingAccountId(null);
    setSelectedProviderId("custom");
    setForm(createBlankForm());
    setIsAccountModalOpen(true);
  };

  const openEditModal = () => {
    if (!selectedAccount) {
      message.error(t("settings.microApps.mailCenter.messages.selectAccountFirst"));
      return;
    }

    const nextForm = toForm(selectedAccount);
    setSelectedProviderId(detectMailProvider(nextForm, providerProfiles));
    setForm(nextForm);
    setIsAccountModalOpen(true);
  };

  const handleProviderChange = (value: string) => {
    const nextProviderId = value as MailProviderId;
    const nextProfile = providerProfiles[nextProviderId];

    setSelectedProviderId(nextProviderId);
    setForm((current) => applyProviderDefaults(current, nextProfile));
  };

  const handleEmailAddressChange = (value: string) => {
    setForm((current) => {
      const syncSmtpUsername =
        !current.smtpUsername.trim() || current.smtpUsername === current.emailAddress;
      const syncImapUsername =
        !current.imapUsername.trim() || current.imapUsername === current.emailAddress;

      return {
        ...current,
        emailAddress: value,
        smtpUsername: syncSmtpUsername ? value : current.smtpUsername,
        imapUsername: syncImapUsername ? value : current.imapUsername,
      };
    });
  };

  const handleSelectAccount = async (accountId: string) => {
    await load(accountId);
  };

  const openTestModal = () => {
    if (!editingAccountId) {
      message.error(t("settings.microApps.mailCenter.messages.saveConfigFirst"));
      return;
    }

    setIsTestModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const preserveSecrets = Boolean(editingAccountId);
      const payload = toPayload(form, preserveSecrets);
      const previousEditingId = editingAccountId;

      if (previousEditingId) {
        await updateMailAccount(previousEditingId, payload);
      } else {
        await createMailAccount(payload);
      }

      message.success(
        previousEditingId
          ? t("settings.microApps.mailCenter.messages.accountUpdated")
          : t("settings.microApps.mailCenter.messages.accountCreated"),
      );
      setIsAccountModalOpen(false);
      await load(previousEditingId ?? undefined);
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : t("settings.microApps.mailCenter.messages.saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!editingAccountId) {
      message.error(t("settings.microApps.mailCenter.messages.saveConfigFirst"));
      return;
    }

    setSendingTest(true);
    try {
      const result = await sendMailAccountTest(editingAccountId, {
        to: testTarget.trim() || undefined,
        subject: testSubject.trim() || undefined,
        content: testContent.trim() || undefined,
      });
      message.success(
        t("settings.microApps.mailCenter.messages.testSent", { target: result.target }),
      );
      setIsTestModalOpen(false);
      await load(editingAccountId);
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : t("settings.microApps.mailCenter.messages.testSendFailed"),
      );
    } finally {
      setSendingTest(false);
    }
  };

  const handleSyncInbox = async () => {
    if (!editingAccountId) {
      message.error(t("settings.microApps.mailCenter.messages.saveConfigFirst"));
      return;
    }

    setSyncing(true);
    try {
      const result = await syncMailInbox(editingAccountId);
      message.success(
        t("settings.microApps.mailCenter.messages.inboxSynced", {
          count: result.syncedCount,
        }),
      );
      await load(editingAccountId);
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : t("settings.microApps.mailCenter.messages.syncFailed"),
      );
    } finally {
      setSyncing(false);
    }
  };

  if (loading && !overview) {
    return (
      <SettingsPageLayout
        miniTitle={t("settings.microApps.mailCenter.page.miniTitle")}
        title={t("settings.microApps.mailCenter.page.title")}
        description={t("settings.microApps.mailCenter.page.description")}
        contentClassName="pt-6"
      >
        <FullPageStatus message={t("settings.microApps.mailCenter.states.loading")} />
      </SettingsPageLayout>
    );
  }

  return (
    <SettingsPageLayout
      miniTitle={t("settings.microApps.mailCenter.page.miniTitle")}
      title={t("settings.microApps.mailCenter.page.title")}
      description={t("settings.microApps.mailCenter.page.description")}
      scrollBody={false}
      slot={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load(editingAccountId)}>
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {t("settings.microApps.mailCenter.actions.refresh")}
          </Button>
          <Button variant="outline" size="sm" onClick={openCreateModal}>
            <Plus className="h-4 w-4" />
            {t("settings.microApps.mailCenter.actions.newAccount")}
          </Button>
        </div>
      }
      contentClassName="flex h-full min-h-0 flex-col gap-6 pt-6"
    >
      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="min-h-0">
          <Card className="flex h-full min-h-0 flex-col p-4">
            <div className="flex min-h-0 flex-1 flex-col space-y-4">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <div className="text-base font-semibold text-text-primary">
                  {t("settings.microApps.mailCenter.sections.accounts")}
                </div>
              </div>

              {overview?.accounts.length ? (
                <div className="stable-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                  {overview.accounts.map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => void handleSelectAccount(account.id)}
                      className={[
                        "w-full rounded-ui-panel border px-3 py-3 text-left transition-colors",
                        editingAccountId === account.id
                          ? "border-primary/30 bg-primary/5"
                          : "border-border bg-surface-primary hover:bg-surface-secondary/70",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <div className="truncate text-sm font-medium text-text-primary">
                              {account.name}
                            </div>
                            {editingAccountId === account.id ? (
                              <Tooltip
                                text={t("settings.microApps.mailCenter.actions.editAccount")}
                                placement="top"
                              >
                                <button
                                  type="button"
                                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-ui-control text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openEditModal();
                                  }}
                                  aria-label={t(
                                    "settings.microApps.mailCenter.actions.editAccount",
                                  )}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              </Tooltip>
                            ) : null}
                          </div>
                          <div className="mt-1 truncate text-xs text-text-secondary">
                            {account.emailAddress}
                          </div>
                        </div>
                        <Badge
                          variant={
                            account.status === "connected"
                              ? "success"
                              : account.status === "error"
                                ? "warning"
                                : "muted"
                          }
                          size="sm"
                        >
                          {account.status === "connected"
                            ? t("settings.microApps.mailCenter.labels.connected")
                            : account.status === "error"
                              ? t("settings.microApps.mailCenter.labels.error")
                              : t("settings.microApps.mailCenter.labels.unverified")}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-text-tertiary">
                        <span>
                          {account.isDefault
                            ? t("settings.microApps.mailCenter.labels.defaultAccount")
                            : t("settings.microApps.mailCenter.labels.regularAccount")}
                        </span>
                        <span>{formatDateTime(account.lastSyncedAt)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-ui-panel border border-dashed border-border bg-surface-secondary/20 px-4 py-4 text-sm text-text-secondary">
                  {t("settings.microApps.mailCenter.states.emptyAccounts")}
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="flex min-h-0 flex-col">
          <Card className="flex min-h-0 flex-1 flex-col p-5">
            <div className="flex min-h-0 flex-1 flex-col space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <MailCheck className="h-4 w-4 text-primary" />
                    <div className="text-base font-semibold text-text-primary">
                      {t("settings.microApps.mailCenter.sections.inboxList")}
                    </div>
                  </div>
                  <div className="mt-1 text-sm text-text-secondary">
                    {selectedAccount
                      ? t("settings.microApps.mailCenter.labels.currentInboxScope", {
                          name: selectedAccount.name,
                        })
                      : t("settings.microApps.mailCenter.states.selectAccount")}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openTestModal}
                    disabled={!editingAccountId || sendingTest}
                  >
                    <Send className="h-4 w-4" />
                    {t("settings.microApps.mailCenter.actions.sendTest")}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void handleSyncInbox()}
                    disabled={!editingAccountId || syncing}
                  >
                    <RefreshCcw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                    {syncing
                      ? t("settings.microApps.mailCenter.actions.syncing")
                      : t("settings.microApps.mailCenter.actions.syncInbox")}
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-ui-panel border border-border bg-surface-primary px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-text-tertiary">
                    {t("settings.microApps.mailCenter.metrics.connectionStatus")}
                  </div>
                  <div className="mt-2 text-sm font-medium text-text-primary">
                    {selectedAccount?.status === "connected"
                      ? t("settings.microApps.mailCenter.values.connectedStatus")
                      : selectedAccount?.status === "error"
                        ? t("settings.microApps.mailCenter.values.errorStatus")
                        : t("settings.microApps.mailCenter.values.idleStatus")}
                  </div>
                </div>
                <div className="rounded-ui-panel border border-border bg-surface-primary px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-text-tertiary">
                    {t("settings.microApps.mailCenter.metrics.messageCount")}
                  </div>
                  <div className="mt-2 text-lg font-semibold text-text-primary">
                    {overview?.inbox?.messageCount ?? 0}
                  </div>
                </div>
                <div className="rounded-ui-panel border border-border bg-surface-primary px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-text-tertiary">
                    {t("settings.microApps.mailCenter.metrics.unreadCount")}
                  </div>
                  <div className="mt-2 text-lg font-semibold text-text-primary">
                    {overview?.inbox?.unreadCount ?? 0}
                  </div>
                </div>
              </div>

              <Divider />

              <div className="stable-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto pr-1">
                {overview?.inbox?.messages.length ? (
                  <div className="space-y-3">
                    {overview.inbox.messages.map((item) => (
                      <div
                        key={item.id}
                        className="min-w-0 overflow-hidden rounded-ui-panel border border-border bg-surface-primary px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-medium text-text-primary">
                                {item.fromDisplay}
                              </span>
                              {!item.isRead ? (
                                <Badge variant="primary" size="sm">
                                  {t("settings.microApps.mailCenter.labels.unread")}
                                </Badge>
                              ) : null}
                              {item.hasAttachments ? (
                                <Badge variant="muted" size="sm">
                                  {t("settings.microApps.mailCenter.labels.attachment")}
                                </Badge>
                              ) : null}
                            </div>
                            <div className="mt-1 min-w-0 break-words text-sm text-text-primary">
                              {item.subject}
                            </div>
                          </div>
                          <span className="shrink-0 text-xs text-text-tertiary">
                            {formatDateTime(item.receivedAt)}
                          </span>
                        </div>
                        <div className="mt-2 min-w-0 whitespace-pre-wrap break-all text-xs leading-5 text-text-secondary">
                          {item.previewText ||
                            t("settings.microApps.mailCenter.values.noPreview")}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-ui-panel border border-dashed border-border bg-surface-secondary/20 px-4 py-5 text-sm text-text-secondary">
                    {t("settings.microApps.mailCenter.states.emptyInbox")}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={isAccountModalOpen}
        title={t(
          editingAccountId
            ? "settings.microApps.mailCenter.modal.editTitle"
            : "settings.microApps.mailCenter.modal.createTitle",
        )}
        width={760}
        onClose={() => setIsAccountModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsAccountModalOpen(false)}>
              {t("common.actions.cancel")}
            </Button>
            <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving
                ? t("settings.microApps.mailCenter.actions.saving")
                : t("settings.microApps.mailCenter.actions.saveAccount")}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <TextInput
              label={t("settings.microApps.mailCenter.form.accountName")}
              labelHelp={fieldHelp.accountName}
              value={form.name}
              onChange={(value) => updateForm("name", value)}
              placeholder={t("settings.microApps.mailCenter.placeholders.accountName")}
            />
            <Select
              label={t("settings.microApps.mailCenter.form.provider")}
              labelHelp={fieldHelp.provider}
              value={selectedProviderId}
              onChange={handleProviderChange}
              options={providerOptions}
            />
          </div>

          <div className="rounded-ui-panel border border-border bg-surface-secondary/20 px-4 py-3">
            <div className="space-y-2">
              <div className="text-sm font-medium text-text-primary">
                {t("settings.microApps.mailCenter.provider.summaryTitle", {
                  provider: selectedProviderProfile.label,
                })}
              </div>
              <div className="text-xs leading-5 text-text-secondary">
                {selectedProviderProfile.note}
              </div>
              {selectedProviderProfile.docs.length ? (
                <div className="flex flex-wrap gap-3 pt-1">
                  {selectedProviderProfile.docs.map((doc) => (
                    <a
                      key={doc.url}
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-opacity hover:opacity-80"
                    >
                      <span>{doc.label}</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-text-secondary">
                  {t("settings.microApps.mailCenter.provider.noDocs")}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <TextInput
              label={t("settings.microApps.mailCenter.form.emailAddress")}
              labelHelp={fieldHelp.emailAddress}
              value={form.emailAddress}
              onChange={handleEmailAddressChange}
              placeholder="name@example.com"
            />
            <TextInput
              label={t("settings.microApps.mailCenter.form.inboxFolderPath")}
              labelHelp={fieldHelp.inboxFolderPath}
              value={form.inboxFolderPath}
              onChange={(value) => updateForm("inboxFolderPath", value)}
              placeholder="INBOX"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <TextInput
              label={t("settings.microApps.mailCenter.form.smtpHost")}
              labelHelp={fieldHelp.smtpHost}
              value={form.smtpHost}
              onChange={(value) => updateForm("smtpHost", value)}
              placeholder="smtp.example.com"
            />
            <TextInput
              label={t("settings.microApps.mailCenter.form.smtpPort")}
              labelHelp={fieldHelp.smtpPort}
              type="number"
              value={form.smtpPort}
              onChange={(value) => updateForm("smtpPort", value)}
            />
          </div>

          <TextInput
            label={t("settings.microApps.mailCenter.form.smtpUsername")}
            labelHelp={fieldHelp.smtpUsername}
            value={form.smtpUsername}
            onChange={(value) => updateForm("smtpUsername", value)}
            placeholder="name@example.com"
          />

          <TextInput
            label={`${t("settings.microApps.mailCenter.form.smtpPassword")}${
              selectedAccount?.hasSmtpPassword && editingAccountId && !form.smtpPassword
                ? t("settings.microApps.mailCenter.form.passwordHint")
                : ""
            }`}
            labelHelp={fieldHelp.smtpPassword}
            type="password"
            value={form.smtpPassword}
            onChange={(value) => updateForm("smtpPassword", value)}
            placeholder={t("settings.microApps.mailCenter.placeholders.smtpPassword")}
          />

          <div className="grid gap-3 md:grid-cols-2">
            <TextInput
              label={t("settings.microApps.mailCenter.form.imapHost")}
              labelHelp={fieldHelp.imapHost}
              value={form.imapHost}
              onChange={(value) => updateForm("imapHost", value)}
              placeholder="imap.example.com"
            />
            <TextInput
              label={t("settings.microApps.mailCenter.form.imapPort")}
              labelHelp={fieldHelp.imapPort}
              type="number"
              value={form.imapPort}
              onChange={(value) => updateForm("imapPort", value)}
            />
          </div>

          <TextInput
            label={t("settings.microApps.mailCenter.form.imapUsername")}
            labelHelp={fieldHelp.imapUsername}
            value={form.imapUsername}
            onChange={(value) => updateForm("imapUsername", value)}
            placeholder="name@example.com"
          />

          <TextInput
            label={`${t("settings.microApps.mailCenter.form.imapPassword")}${
              selectedAccount?.hasImapPassword && editingAccountId && !form.imapPassword
                ? t("settings.microApps.mailCenter.form.passwordHint")
                : ""
            }`}
            labelHelp={fieldHelp.imapPassword}
            type="password"
            value={form.imapPassword}
            onChange={(value) => updateForm("imapPassword", value)}
            placeholder={t("settings.microApps.mailCenter.placeholders.imapPassword")}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-ui-panel border border-border bg-surface-secondary/20 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-text-primary">
                <InlineHelpLabel
                  label={t("settings.microApps.mailCenter.form.smtpSecure")}
                  help={fieldHelp.smtpSecure}
                />
              </div>
              <div className="text-xs text-text-secondary">
                {t("settings.microApps.mailCenter.form.smtpSecureHint")}
              </div>
            </div>
            <Switch
              checked={form.smtpSecure}
              onChange={() => updateForm("smtpSecure", !form.smtpSecure)}
              ariaLabel="Toggle SMTP secure"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-ui-panel border border-border bg-surface-secondary/20 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-text-primary">
                <InlineHelpLabel
                  label={t("settings.microApps.mailCenter.form.imapSecure")}
                  help={fieldHelp.imapSecure}
                />
              </div>
              <div className="text-xs text-text-secondary">
                {t("settings.microApps.mailCenter.form.imapSecureHint")}
              </div>
            </div>
            <Switch
              checked={form.imapSecure}
              onChange={() => updateForm("imapSecure", !form.imapSecure)}
              ariaLabel="Toggle IMAP secure"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-ui-panel border border-border bg-surface-secondary/20 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-text-primary">
                <InlineHelpLabel
                  label={t("settings.microApps.mailCenter.form.defaultAccount")}
                  help={fieldHelp.defaultAccount}
                />
              </div>
              <div className="text-xs text-text-secondary">
                {t("settings.microApps.mailCenter.form.defaultAccountHint")}
              </div>
            </div>
            <Switch
              checked={form.isDefault}
              onChange={() => updateForm("isDefault", !form.isDefault)}
              ariaLabel="Toggle default account"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={isTestModalOpen}
        title={t("settings.microApps.mailCenter.modal.testTitle")}
        width={720}
        onClose={() => setIsTestModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsTestModalOpen(false)}>
              {t("common.actions.cancel")}
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleSendTest()}
              disabled={sendingTest}
            >
              <Send className="h-4 w-4" />
              {sendingTest
                ? t("settings.microApps.mailCenter.actions.sending")
                : t("settings.microApps.mailCenter.actions.sendTest")}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm text-text-secondary">
                {t("settings.microApps.mailCenter.form.testTarget")}
              </span>
              <input
                value={testTarget}
                onChange={(event) => setTestTarget(event.target.value)}
                placeholder={t("settings.microApps.mailCenter.placeholders.testTarget")}
                className={fieldClassName}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm text-text-secondary">
                {t("settings.microApps.mailCenter.form.testSubject")}
              </span>
              <input
                value={testSubject}
                onChange={(event) => setTestSubject(event.target.value)}
                className={fieldClassName}
              />
            </label>
          </div>

          <label className="space-y-1.5">
            <span className="text-sm text-text-secondary">
              {t("settings.microApps.mailCenter.form.testContent")}
            </span>
            <textarea
              value={testContent}
              onChange={(event) => setTestContent(event.target.value)}
              className={textAreaClassName}
            />
          </label>
        </div>
      </Modal>
    </SettingsPageLayout>
  );
}
