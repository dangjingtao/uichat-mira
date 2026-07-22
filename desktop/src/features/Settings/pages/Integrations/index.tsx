import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Bot,
  BookOpen,
  ChevronRight,
  CircleAlert,
  Database,
  ExternalLink,
  MessageSquareText,
  PlugZap,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Webhook,
} from "lucide-react";
import SettingsPageLayout from "../../components/SettingsPageLayout";
import Card from "@/shared/ui/Card";
import Badge from "@/shared/ui/Badge";
import Drawer from "@/shared/ui/Drawer";
import Alert from "@/shared/ui/Alert";
import NavigationCardTabs from "@/shared/ui/NavigationCardTabs";
import Switch from "@/shared/ui/Switch";
import { Button } from "@/shared/ui/Button";
import { Select, Skeleton, TextArea, TextInput } from "@/shared/ui";
import { message } from "@/shared/ui/Message";
import { ApiError } from "@/shared/lib/request";
import { listKnowledgeBases, type KnowledgeBaseSummary } from "@/shared/api/knowledgeBase";
import {
  getIntegrationCapabilityMicroAppBinding,
  getIntegrationCapabilityStatus,
  getIntegrationInstances,
  getIntegrationMicroApps,
  sendWecomRobotCapabilityTestMessage,
  startIntegrationCapability,
  stopIntegrationCapability,
  updateIntegrationCapability,
  updateIntegrationCapabilityMicroAppBinding,
  updateIntegrationInstance,
  type IntegrationCapabilityMicroAppBindingRecord,
  type IntegrationCapabilityRecord,
  type IntegrationCapabilityStatus,
  type IntegrationInstanceRecord,
  type IntegrationProviderCode,
  type MicroAppRecord,
} from "@/shared/api/integrations";

type PlatformTab = {
  code: IntegrationProviderCode;
  label: string;
  planned?: boolean;
};

type InstanceDraft = {
  id: string;
  name: string;
  externalTenantId: string;
  enabled: boolean;
};

type CapabilityDraft = {
  id: string;
  instanceId: string;
  type: string;
  name: string;
  enabled: boolean;
  botId: string;
  secret: string;
  webhookUrl: string;
  webhookSecret: string;
  replyMode: "stream" | "send";
  microAppId: string;
  bindingEnabled: boolean;
  bindingConfig: Record<string, unknown>;
};

function GuideSection({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <section className="rounded-ui-control border border-border bg-surface-secondary px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
        {icon}
        <span>{title}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{body}</p>
    </section>
  );
}

const capabilityIcon = (type: string) => {
  if (type.includes("webhook")) return Webhook;
  if (type.includes("smart_robot")) return Bot;
  return MessageSquareText;
};

const capabilityLabel = (type: string) => {
  if (type === "wecom.smart_robot") return "integrationsPage.capability.smartRobot";
  if (type === "wecom.webhook_robot") return "integrationsPage.capability.webhookRobot";
  return "integrationsPage.capability.thirdParty";
};

const capabilityDescription = (type: string) => {
  if (type === "wecom.smart_robot") return "integrationsPage.capability.smartRobotDescription";
  if (type === "wecom.webhook_robot") return "integrationsPage.capability.webhookRobotDescription";
  return "integrationsPage.capability.thirdPartyDescription";
};

const supportsRuntimeStatus = (type: string) => type === "wecom.smart_robot";

const capabilityStatusLabel = (status?: IntegrationCapabilityStatus["status"]) => {
  if (status === "connected") return "integrationsPage.capability.running";
  if (status === "connecting") return "integrationsPage.capability.connecting";
  if (status === "error") return "integrationsPage.capability.error";
  if (status === "stopped") return "integrationsPage.capability.stopped";
  return "integrationsPage.capability.pending";
};

const runtimeStatusTone = (status?: IntegrationCapabilityStatus["status"]) => {
  if (status === "connected") return "success";
  if (status === "error") return "danger";
  if (status === "connecting") return "warning";
  if (status === "stopped") return "muted";
  return "muted";
};

const instanceHealth = (
  instance: IntegrationInstanceRecord,
  instanceCapabilities: IntegrationCapabilityRecord[],
  statuses: Record<string, IntegrationCapabilityStatus | null>,
) => {
  if (!instance.enabled) {
    return { label: "integrationsPage.capability.instanceDisabled", tone: "muted" as const };
  }

  const statusList = instanceCapabilities
    .map((capability) => statuses[capability.id]?.status ?? "idle")
    .filter(Boolean);

  if (statusList.some((status) => status === "error")) {
    return { label: "integrationsPage.capability.error", tone: "danger" as const };
  }
  if (statusList.some((status) => status === "connecting")) {
    return { label: "integrationsPage.capability.connecting", tone: "warning" as const };
  }
  if (statusList.some((status) => status === "connected")) {
    return { label: "integrationsPage.capability.available", tone: "success" as const };
  }
  if (instanceCapabilities.length === 0) {
    return { label: "integrationsPage.capability.unavailable", tone: "warning" as const };
  }
  return { label: "integrationsPage.capability.incomplete", tone: "warning" as const };
};

export default function IntegrationsSettings() {
  const { t } = useTranslation();
  const [activeProvider, setActiveProvider] = useState<IntegrationProviderCode>("wecom");
  const [instances, setInstances] = useState<IntegrationInstanceRecord[]>([]);
  const [capabilities, setCapabilities] = useState<IntegrationCapabilityRecord[]>([]);
  const [microApps, setMicroApps] = useState<MicroAppRecord[]>([]);
  const [capabilityBindings, setCapabilityBindings] = useState<
    Record<string, IntegrationCapabilityMicroAppBindingRecord | null>
  >({});
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseSummary[]>([]);
  const [statuses, setStatuses] = useState<Record<string, IntegrationCapabilityStatus | null>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [activeInstanceId, setActiveInstanceId] = useState<string>("");
  const [activeCapabilityId, setActiveCapabilityId] = useState<string>("");
  const [drawerTab, setDrawerTab] = useState<"basic" | "caps" | "debug">("basic");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingCapabilityId, setTestingCapabilityId] = useState<string>("");
  const [testMessage, setTestMessage] = useState(() => t("integrationsPage.messages.defaultTestMessage"));
  const [testFormat, setTestFormat] = useState<"markdown" | "text">("markdown");
  const [mentionAll, setMentionAll] = useState(false);
  const [instanceDraft, setInstanceDraft] = useState<InstanceDraft | null>(null);
  const [capabilityDrafts, setCapabilityDrafts] = useState<Record<string, CapabilityDraft>>({});

  const platformTabs = useMemo<PlatformTab[]>(
    () => [
      { code: "wecom", label: t("integrationsPage.platform.wecom") },
      { code: "lark", label: t("integrationsPage.platform.lark"), planned: true },
      { code: "dingtalk", label: t("integrationsPage.platform.dingtalk"), planned: true },
    ],
    [t],
  );

  const filteredInstances = activeProvider === "wecom" ? instances : [];
  const currentInstance =
    filteredInstances.find((item) => item.id === activeInstanceId) ??
    filteredInstances.find((item) => item.isDefault) ??
    filteredInstances[0] ??
    null;
  const currentCapabilities = currentInstance
    ? capabilities.filter(
        (item) =>
          item.instanceId === currentInstance.id &&
          item.type !== "wecom.knowledge_query",
      )
    : [];
  const currentCapability =
    currentCapabilities.find((item) => item.id === activeCapabilityId) ??
    currentCapabilities.find((item) => item.isDefault) ??
    currentCapabilities[0] ??
    null;
  const currentCapabilityDraft = currentCapability ? capabilityDrafts[currentCapability.id] ?? null : null;
  const currentHealth = currentInstance
    ? instanceHealth(currentInstance, currentCapabilities, statuses)
    : { label: "integrationsPage.capability.unavailable", tone: "warning" as const };
  const primaryMethod = currentCapabilities[0]
    ? t(capabilityLabel(currentCapabilities[0].type))
    : t("integrationsPage.capability.primaryUnset");
  const availableMicroApps = currentCapability
    ? microApps.filter(
        (item) =>
          item.enabled &&
          item.supportedAccessPoints.includes(currentCapability.type),
      )
    : [];
  const selectedMicroApp =
    currentCapabilityDraft && currentCapabilityDraft.microAppId
      ? microApps.find((item) => item.id === currentCapabilityDraft.microAppId) ?? null
      : null;

  const hydrateSelection = (
    nextInstances: IntegrationInstanceRecord[],
    nextCapabilities: IntegrationCapabilityRecord[],
    nextCapabilityDrafts: Record<string, CapabilityDraft>,
    preferredInstanceId?: string,
    preferredCapabilityId?: string,
  ) => {
    const nextInstance =
      nextInstances.find((item) => item.id === preferredInstanceId) ??
      nextInstances.find((item) => item.isDefault) ??
      nextInstances[0] ??
      null;

    if (!nextInstance) {
      setActiveInstanceId("");
      setActiveCapabilityId("");
      setInstanceDraft(null);
      return;
    }

    const nextInstanceCapabilities = nextCapabilities.filter((item) => item.instanceId === nextInstance.id);
    const nextCapability =
      nextInstanceCapabilities.find((item) => item.id === preferredCapabilityId) ??
      nextInstanceCapabilities.find((item) => item.isDefault) ??
      nextInstanceCapabilities[0] ??
      null;

    setActiveInstanceId(nextInstance.id);
    setActiveCapabilityId(nextCapability?.id ?? "");
    setInstanceDraft({
      id: nextInstance.id,
      name: nextInstance.name,
      externalTenantId: nextInstance.externalTenantId ?? "",
      enabled: nextInstance.enabled,
    });
    setCapabilityDrafts(nextCapabilityDrafts);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [instanceResult, kbResult, microAppResult] = await Promise.all([
        getIntegrationInstances({ provider: "wecom", includeCapabilities: true }),
        listKnowledgeBases(),
        getIntegrationMicroApps(),
      ]);

      const nextInstances = instanceResult.instances;
      const nextCapabilities = nextInstances.flatMap((item) => item.capabilities ?? []).filter(Boolean);
      const nextBindings = Object.fromEntries(
        await Promise.all(
          nextCapabilities.map(async (capability) => {
            if (capability.type !== "wecom.smart_robot") {
              return [capability.id, null] as const;
            }
            try {
              const result = await getIntegrationCapabilityMicroAppBinding(capability.id);
              return [capability.id, result.binding] as const;
            } catch {
              return [capability.id, null] as const;
            }
          }),
        ),
      );
      const nextCapabilityDrafts: Record<string, CapabilityDraft> = Object.fromEntries(
        nextCapabilities.map((capability) => [
          capability.id,
          {
            id: capability.id,
            instanceId: capability.instanceId,
            type: capability.type,
            name: capability.name,
            enabled: capability.enabled,
            botId:
              typeof (capability.config as Record<string, unknown>).botId === "string"
                ? ((capability.config as Record<string, unknown>).botId as string)
                : "",
            secret: "",
            webhookUrl:
              typeof (capability.config as Record<string, unknown>).webhookUrl === "string"
                ? ((capability.config as Record<string, unknown>).webhookUrl as string)
                : "",
            webhookSecret: "",
            replyMode:
              (capability.config as Record<string, unknown>).replyMode === "send" ? "send" : "stream",
            microAppId: nextBindings[capability.id]?.microAppDefinitionId ?? "",
            bindingEnabled: nextBindings[capability.id]?.enabled ?? true,
            bindingConfig: nextBindings[capability.id]?.config ?? {},
          } satisfies CapabilityDraft,
        ]),
      );

      const nextStatuses = Object.fromEntries(
        await Promise.all(
          nextCapabilities.map(async (capability) => {
            if (!supportsRuntimeStatus(capability.type)) {
              return [capability.id, null] as const;
            }
            try {
              return [capability.id, await getIntegrationCapabilityStatus(capability.id)] as const;
            } catch {
              return [capability.id, null] as const;
            }
          }),
        ),
      );

      setInstances(nextInstances);
      setCapabilities(nextCapabilities);
      setMicroApps(microAppResult.microApps);
      setCapabilityBindings(nextBindings);
      setKnowledgeBases(kbResult);
      setStatuses(nextStatuses);
      hydrateSelection(
        nextInstances,
        nextCapabilities,
        nextCapabilityDrafts,
        activeInstanceId,
        activeCapabilityId,
      );
    } catch (error) {
      message.error(error instanceof Error ? error.message : t("integrationsPage.messages.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCurrentDrawer = (tab: "basic" | "caps" | "debug" = "basic") => {
    if (!currentInstance) return;
    setDrawerTab(tab);
    setDrawerOpen(true);
  };

  const openCapabilityDrawer = (capabilityId: string, tab: "caps" | "debug" = "caps") => {
    if (!currentInstance) return;
    setActiveCapabilityId(capabilityId);
    setDrawerTab(tab);
    setDrawerOpen(true);
  };

  const saveInstance = async () => {
    if (!instanceDraft) return;
    setSaving(true);
    try {
      await updateIntegrationInstance(instanceDraft.id, {
        name: instanceDraft.name.trim(),
        externalTenantId: instanceDraft.externalTenantId.trim() || null,
        enabled: instanceDraft.enabled,
      });
      message.success(t("integrationsPage.messages.instanceSaved"));
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : t("integrationsPage.messages.instanceSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const saveCapability = async (capabilityId: string) => {
    const draft = capabilityDrafts[capabilityId];
    if (!draft) return;
    if (draft.type === "wecom.smart_robot" && draft.microAppId) {
      const boundMicroApp = microApps.find((item) => item.id === draft.microAppId) ?? null;
      const missingRequiredField = boundMicroApp?.bindingSchema.fields.find((field) => {
        if (!field.required) {
          return false;
        }
        const value = draft.bindingConfig[field.key];
        return value === undefined || value === null || String(value).trim() === "";
      });
      if (missingRequiredField) {
      message.error(t("integrationsPage.messages.missingField", { field: missingRequiredField.label }));
        return;
      }
    }
    setSaving(true);
    try {
      const currentRecord = capabilities.find((item) => item.id === capabilityId);
      const currentConfig = (currentRecord?.config ?? {}) as Record<string, unknown>;
      const config: Record<string, unknown> = { ...currentConfig };

      if (draft.type === "wecom.smart_robot") {
        config.botId = draft.botId.trim() || (typeof currentConfig.botId === "string" ? currentConfig.botId : "");
        if (draft.secret.trim()) {
          config.secret = draft.secret.trim();
        }
        config.replyMode = draft.replyMode;
      }

      if (draft.type === "wecom.webhook_robot") {
        config.webhookUrl =
          draft.webhookUrl.trim() ||
          (typeof currentConfig.webhookUrl === "string" ? currentConfig.webhookUrl : "");
        if (draft.webhookSecret.trim()) {
          config.webhookSecret = draft.webhookSecret.trim();
        }
      }

      await updateIntegrationCapability(draft.id, {
        name: draft.name.trim(),
        enabled: draft.enabled,
        knowledgeBaseId: null,
        config,
      });

      if (draft.type === "wecom.smart_robot") {
        await updateIntegrationCapabilityMicroAppBinding(draft.id, {
          microAppId: draft.microAppId.trim() || null,
          enabled: draft.bindingEnabled,
          config: draft.bindingConfig,
        });
      }

      message.success(t("integrationsPage.messages.capabilitySaved"));
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : t("integrationsPage.messages.capabilitySaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const refreshCapabilityStatus = async (capabilityId: string) => {
    const capability = capabilities.find((item) => item.id === capabilityId);
    if (!capability || !supportsRuntimeStatus(capability.type)) {
      setStatuses((current) => ({ ...current, [capabilityId]: null }));
      return;
    }
    try {
      const status = await getIntegrationCapabilityStatus(capabilityId);
      setStatuses((current) => ({ ...current, [capabilityId]: status }));
    } catch {
      setStatuses((current) => ({ ...current, [capabilityId]: null }));
    }
  };

  const handleStartCapability = async (capabilityId: string) => {
    setSaving(true);
    try {
      await startIntegrationCapability(capabilityId);
      await refreshCapabilityStatus(capabilityId);
      message.success(t("integrationsPage.messages.capabilityStarted"));
    } catch (error) {
      message.error(error instanceof Error ? error.message : t("integrationsPage.messages.capabilityStartFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleStopCapability = async (capabilityId: string) => {
    setSaving(true);
    try {
      await stopIntegrationCapability(capabilityId);
      await refreshCapabilityStatus(capabilityId);
      message.success(t("integrationsPage.messages.capabilityStopped"));
    } catch (error) {
      message.error(error instanceof Error ? error.message : t("integrationsPage.messages.capabilityStopFailed"));
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async (capabilityId: string) => {
    setTestingCapabilityId(capabilityId);
    try {
      await sendWecomRobotCapabilityTestMessage(capabilityId, {
        content: testMessage,
        format: testFormat,
        mentionAll,
      });
      message.success(t("integrationsPage.messages.testMessageSent"));
    } catch (error) {
      message.error(error instanceof ApiError ? error.message : t("integrationsPage.messages.testMessageFailed"));
    } finally {
      setTestingCapabilityId("");
    }
  };

  return (
    <SettingsPageLayout
      miniTitle={t("integrationsPage.page.miniTitle")}
      title={t("integrationsPage.page.title")}
      description={t("integrationsPage.page.description")}
      slot={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {t("integrationsPage.actions.refresh")}
          </Button>
        </div>
      }
      contentClassName="space-y-6 pt-6"
    >
      <NavigationCardTabs
        tabs={platformTabs.map((tab) => ({
          value: tab.code,
          label: (
            <span className="inline-flex items-center gap-2">
              <span>{tab.label}</span>
              {tab.planned ? <Badge variant="muted" size="sm">{t("integrationsPage.platform.planned")}</Badge> : null}
            </span>
          ),
        }))}
        value={activeProvider}
        onChange={setActiveProvider}
      />

      {activeProvider !== "wecom" ? (
        <Alert
          variant="info"
          title={t("integrationsPage.platform.plannedTitle", { platform: platformTabs.find((item) => item.code === activeProvider)?.label ?? "" })}
        >
          {t("integrationsPage.platform.plannedDescription")}
        </Alert>
      ) : null}

      {activeProvider === "wecom" && loading ? (
        <div data-testid="integrations-loading-skeleton" className="space-y-6 pt-1">
          <div className="space-y-3">
            <Skeleton height={28} width="26%" />
            <Skeleton.Text lines={2} lastLineWidth="58%" />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton height={14} width={72} />
                <Skeleton height={18} width={`${48 + index * 8}%`} />
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Skeleton height={20} width={88} />
              <Skeleton.Text lines={1} lastLineWidth="46%" />
            </div>

            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className="space-y-3 border-b border-border/60 py-4 first:pt-0 last:border-b-0 last:pb-0"
              >
                <div className="flex items-start gap-3">
                  <Skeleton.Circle size={44} className="shrink-0" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Skeleton height={20} width={112} />
                      <Skeleton height={22} width={56} className="rounded-full" />
                    </div>
                    <Skeleton.Text lines={2} lastLineWidth="62%" />
                    <div className="flex flex-wrap gap-3">
                      <Skeleton height={14} width={64} />
                      <Skeleton height={14} width={138} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {activeProvider === "wecom" && !loading && !currentInstance ? (
        <Alert variant="info" title={t("integrationsPage.empty.title")}>
          {t("integrationsPage.empty.description")}
        </Alert>
      ) : null}

      {activeProvider === "wecom" && !loading && currentInstance ? (
        <>
          <Card variant="default" className="p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                    {t("integrationsPage.overview.current")}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-2xl font-semibold text-text-primary">
                      {currentInstance.name || t("integrationsPage.overview.unnamedInstance")}
                    </h3>
                    <Badge variant={currentHealth.tone} size="sm">
                      {t(currentHealth.label)}
                    </Badge>
                  </div>
                  <p className="max-w-2xl text-sm leading-6 text-text-secondary">
                    {t("integrationsPage.overview.description")}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-[0.08em] text-text-tertiary">
                      {t("integrationsPage.overview.platform")}
                    </div>
                    <div className="text-sm font-medium text-text-primary">{t("integrationsPage.platform.wecom")}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-[0.08em] text-text-tertiary">
                      {t("integrationsPage.overview.primaryMethod")}
                    </div>
                    <div className="text-sm font-medium text-text-primary">{primaryMethod}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-[0.08em] text-text-tertiary">
                      {t("integrationsPage.overview.connectedMethods")}
                    </div>
                    <div className="text-sm font-medium text-text-primary">{t("integrationsPage.overview.count", { count: currentCapabilities.length })}</div>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <Button variant="primary" onClick={() => openCurrentDrawer("basic")}>
                  {t("integrationsPage.actions.configure")}
                </Button>
              </div>
            </div>
          </Card>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-text-primary">{t("integrationsPage.overview.methodsTitle")}</h3>
                <p className="mt-1 text-sm text-text-secondary">
                  {t("integrationsPage.overview.methodsDescription")}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {currentCapabilities.map((capability) => {
                const draft = capabilityDrafts[capability.id];
                const runtime = statuses[capability.id];
                const Icon = capabilityIcon(capability.type);
                const binding = capabilityBindings[capability.id];
                const boundMicroApp = binding
                  ? microApps.find((item) => item.id === binding.microAppDefinitionId) ?? null
                  : null;

                return (
                  <button
                    key={capability.id}
                    type="button"
                    onClick={() => openCapabilityDrawer(capability.id, "caps")}
                    className="w-full rounded-ui-panel border border-border bg-surface-primary px-5 py-4 text-left transition-colors hover:bg-surface-secondary/40"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-ui-control bg-surface-secondary text-icon-secondary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-base font-semibold text-text-primary">
                              {t(capabilityLabel(capability.type))}
                            </div>
                            <Badge variant={runtimeStatusTone(runtime?.status)} size="sm">
                              {t(capabilityStatusLabel(runtime?.status))}
                            </Badge>
                          </div>
                          <div className="text-sm text-text-secondary">{t(capabilityDescription(capability.type))}</div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-tertiary">
                            <span>{draft?.enabled ? t("integrationsPage.overview.enabled") : t("integrationsPage.overview.disabled")}</span>
                            {capability.type === "wecom.smart_robot" ? (
                              <span>{boundMicroApp ? t("integrationsPage.overview.microApp", { name: boundMicroApp.name }) : t("integrationsPage.overview.unboundMicroApp")}</span>
                            ) : null}
                            {runtime?.lastError ? <span className="text-danger">{t("integrationsPage.overview.recentError", { error: runtime.lastError })}</span> : null}
                          </div>
                        </div>
                      </div>

                      <div className="inline-flex items-center gap-1 self-end text-sm font-medium text-primary lg:self-center">
                        {t("integrationsPage.actions.configureShort")}
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      ) : null}

      <Drawer
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        width={480}
        closeLabel={t("integrationsPage.guide.close")}
        closeMaskLabel={t("integrationsPage.guide.close")}
        header={
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wide text-text-tertiary">{t("integrationsPage.guide.eyebrow")}</div>
            <div className="text-base font-semibold text-text-primary">{t("integrationsPage.guide.title")}</div>
            <div className="text-sm leading-6 text-text-secondary">
              {t("integrationsPage.guide.description")}
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-ui-control border border-dashed border-border px-4 py-3 text-xs leading-6 text-text-tertiary">
            {t("integrationsPage.guide.intro")}
          </div>

          <GuideSection
            icon={<Sparkles className="h-4 w-4 text-icon-secondary" />}
            title={t("integrationsPage.guide.chooseTitle")}
            body={t("integrationsPage.guide.chooseBody")}
          />
          <GuideSection
            icon={<Bot className="h-4 w-4 text-icon-secondary" />}
            title={t("integrationsPage.guide.smartTitle")}
            body={t("integrationsPage.guide.smartBody")}
          />
          <GuideSection
            icon={<Webhook className="h-4 w-4 text-icon-secondary" />}
            title={t("integrationsPage.guide.webhookTitle")}
            body={t("integrationsPage.guide.webhookBody")}
          />
          <GuideSection
            icon={<Search className="h-4 w-4 text-icon-secondary" />}
            title={t("integrationsPage.guide.verifyTitle")}
            body={t("integrationsPage.guide.verifyBody")}
          />
          <GuideSection
            icon={<PlugZap className="h-4 w-4 text-icon-secondary" />}
            title={t("integrationsPage.guide.usageTitle")}
            body={t("integrationsPage.guide.usageBody")}
          />
          <GuideSection
            icon={<CircleAlert className="h-4 w-4 text-icon-secondary" />}
            title={t("integrationsPage.guide.boundaryTitle")}
            body={t("integrationsPage.guide.boundaryBody")}
          />
          <GuideSection
            icon={<ExternalLink className="h-4 w-4 text-icon-secondary" />}
            title={t("integrationsPage.guide.oauthTitle")}
            body={t("integrationsPage.guide.oauthBody")}
          />
        </div>
      </Drawer>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={640}
        header={
          currentInstance ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">{t("integrationsPage.platform.wecom")}</span>
                <Badge variant={currentHealth.tone} size="sm">
                  {t(currentHealth.label)}
                </Badge>
              </div>
              <div className="text-lg font-semibold text-text-primary">
                {drawerTab === "basic"
                  ? currentInstance.name || t("integrationsPage.overview.unnamedInstance")
                  : t(capabilityLabel(currentCapability?.type ?? ""))}
              </div>
              <div className="text-sm text-text-secondary">
                {drawerTab === "basic"
                  ? t("integrationsPage.drawer.basicDescription")
                  : t("integrationsPage.drawer.capabilityDescription")}
              </div>
            </div>
          ) : null
        }
        bodyClassName="space-y-5"
      >
        {drawerTab !== "basic" ? (
          <NavigationCardTabs
            tabs={[
              { value: "caps", label: t("integrationsPage.drawer.capabilityTab"), icon: <Bot className="h-4 w-4" /> },
              { value: "debug", label: t("integrationsPage.drawer.debugTab"), icon: <Database className="h-4 w-4" /> },
            ]}
            value={drawerTab}
            onChange={(value) => setDrawerTab(value as "caps" | "debug")}
          />
        ) : null}

        {drawerTab === "basic" && instanceDraft ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-ui-panel border border-border bg-surface-secondary/30 px-4 py-3">
              <div className="space-y-1">
                <div className="text-sm font-medium text-text-primary">{t("integrationsPage.drawer.enableInstance")}</div>
                <div className="text-xs text-text-tertiary">
                  {t("integrationsPage.drawer.enableInstanceDescription")}
                </div>
              </div>
              <Switch
                checked={instanceDraft.enabled}
                onChange={() =>
                  setInstanceDraft((current) => (current ? { ...current, enabled: !current.enabled } : current))
                }
                disabled={saving}
                ariaLabel={t("integrationsPage.drawer.enableInstance")}
              />
            </div>

            <div className="grid gap-4">
              <TextInput
                label={t("integrationsPage.drawer.instanceName")}
                value={instanceDraft.name}
                onChange={(value) => setInstanceDraft((current) => (current ? { ...current, name: value } : current))}
                disabled={saving}
              />
              <TextInput
                label={t("integrationsPage.drawer.tenantId")}
                value={instanceDraft.externalTenantId}
                onChange={(value) =>
                  setInstanceDraft((current) => (current ? { ...current, externalTenantId: value } : current))
                }
                placeholder={t("integrationsPage.drawer.tenantPlaceholder")}
                disabled={saving}
              />
            </div>

            <div className="rounded-ui-panel border border-border bg-surface-secondary/20 px-4 py-3 text-sm text-text-secondary">
              {t("integrationsPage.drawer.instanceInfo")}
            </div>

            <div className="flex justify-end">
              <Button variant="primary" onClick={() => void saveInstance()} disabled={saving}>
                {t("integrationsPage.actions.saveBasic")}
              </Button>
            </div>
          </div>
        ) : null}

        {drawerTab === "caps" ? (
          currentCapabilityDraft ? (
            <div className="space-y-5">
              <div className="rounded-ui-panel border border-border bg-surface-secondary/20 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-medium text-text-primary">
                    {t(capabilityLabel(currentCapabilityDraft.type))}
                  </div>
                  <Badge variant={runtimeStatusTone(statuses[currentCapabilityDraft.id]?.status)} size="sm">
                    {t(capabilityStatusLabel(statuses[currentCapabilityDraft.id]?.status))}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-text-secondary">
                  {t(capabilityDescription(currentCapabilityDraft.type))}
                </p>
              </div>

              <div className="grid gap-4">
                <TextInput
                  label={t("integrationsPage.drawer.displayName")}
                  value={currentCapabilityDraft.name}
                  onChange={(value) =>
                    setCapabilityDrafts((current) => ({
                      ...current,
                      [currentCapabilityDraft.id]: { ...current[currentCapabilityDraft.id], name: value },
                    }))
                  }
                  disabled={saving}
                />

                {currentCapabilityDraft.type === "wecom.smart_robot" ? (
                  <>
                    <TextInput
                      label={t("integrationsPage.drawer.botId")}
                      value={currentCapabilityDraft.botId}
                      onChange={(value) =>
                        setCapabilityDrafts((current) => ({
                          ...current,
                          [currentCapabilityDraft.id]: { ...current[currentCapabilityDraft.id], botId: value },
                        }))
                      }
                      disabled={saving}
                    />
                    <TextInput
                      label={t("integrationsPage.drawer.secret")}
                      value={currentCapabilityDraft.secret}
                      onChange={(value) =>
                        setCapabilityDrafts((current) => ({
                          ...current,
                          [currentCapabilityDraft.id]: { ...current[currentCapabilityDraft.id], secret: value },
                        }))
                      }
                      placeholder={t("integrationsPage.drawer.secretPlaceholder")}
                      type="password"
                      disabled={saving}
                    />
                    <Select
                      label={t("integrationsPage.drawer.replyMode")}
                      value={currentCapabilityDraft.replyMode}
                      onChange={(value) =>
                        setCapabilityDrafts((current) => ({
                          ...current,
                          [currentCapabilityDraft.id]: {
                            ...current[currentCapabilityDraft.id],
                            replyMode: value === "send" ? "send" : "stream",
                          },
                        }))
                      }
                      options={[
                        { value: "stream", label: "stream" },
                        { value: "send", label: "send" },
                      ]}
                      disabled={saving}
                    />

                    <div className="rounded-ui-panel border border-border bg-surface-secondary/20 px-4 py-4">
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-text-primary">{t("integrationsPage.drawer.bindMicroApp")}</div>
                        <div className="text-xs leading-5 text-text-tertiary">
                          {t("integrationsPage.drawer.bindDescription")}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4">
                        <Select
                          label={t("integrationsPage.drawer.microApp")}
                          value={currentCapabilityDraft.microAppId}
                          onChange={(value) =>
                            setCapabilityDrafts((current) => ({
                              ...current,
                              [currentCapabilityDraft.id]: {
                                ...current[currentCapabilityDraft.id],
                                microAppId: value,
                                bindingConfig: value === current[currentCapabilityDraft.id].microAppId
                                  ? current[currentCapabilityDraft.id].bindingConfig
                                  : {},
                              },
                            }))
                          }
                          options={[
                            { value: "", label: t("integrationsPage.drawer.noMicroApp") },
                            ...availableMicroApps.map((item) => ({
                              value: item.id,
                              label: item.name,
                            })),
                          ]}
                          disabled={saving}
                        />

                        {selectedMicroApp?.bindingSchema.fields.map((field) => {
                          const fieldValue =
                            currentCapabilityDraft.bindingConfig[field.key] ?? field.defaultValue ?? "";

                          if (field.type === "knowledge_base_select") {
                            return (
                              <Select
                                key={field.key}
                                label={field.label}
                                value={typeof fieldValue === "string" ? fieldValue : ""}
                                onChange={(value) =>
                                  setCapabilityDrafts((current) => ({
                                    ...current,
                                    [currentCapabilityDraft.id]: {
                                      ...current[currentCapabilityDraft.id],
                                      bindingConfig: {
                                        ...current[currentCapabilityDraft.id].bindingConfig,
                                        [field.key]: value,
                                      },
                                    },
                                  }))
                                }
                                options={[
                                  {
                                    value: "",
                                    label: field.required ? t("integrationsPage.drawer.selectKnowledgeBase") : t("integrationsPage.drawer.noKnowledgeBase"),
                                  },
                                  ...knowledgeBases.map((item) => ({
                                    value: item.id,
                                    label: item.name,
                                  })),
                                ]}
                                disabled={saving}
                                labelHelp={field.description}
                              />
                            );
                          }

                          return null;
                        })}
                      </div>
                    </div>
                  </>
                ) : null}

                {currentCapabilityDraft.type === "wecom.webhook_robot" ? (
                  <>
                    <TextInput
                      label="Webhook URL"
                      value={currentCapabilityDraft.webhookUrl}
                      onChange={(value) =>
                        setCapabilityDrafts((current) => ({
                          ...current,
                          [currentCapabilityDraft.id]: { ...current[currentCapabilityDraft.id], webhookUrl: value },
                        }))
                      }
                      disabled={saving}
                    />
                    <TextInput
                      label="Webhook Secret"
                      value={currentCapabilityDraft.webhookSecret}
                      onChange={(value) =>
                        setCapabilityDrafts((current) => ({
                          ...current,
                          [currentCapabilityDraft.id]: {
                            ...current[currentCapabilityDraft.id],
                            webhookSecret: value,
                          },
                        }))
                      }
                      placeholder={t("integrationsPage.drawer.secretPlaceholder")}
                      type="password"
                      disabled={saving}
                    />
                  </>
                ) : null}
              </div>

              <div className="flex items-center justify-between rounded-ui-panel border border-border bg-surface-secondary/20 px-4 py-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-text-primary">{t("integrationsPage.drawer.enableCapability")}</div>
                  <div className="text-xs text-text-tertiary">{t("integrationsPage.drawer.enableCapabilityDescription")}</div>
                </div>
                <Switch
                  checked={currentCapabilityDraft.enabled}
                  onChange={() =>
                    setCapabilityDrafts((current) => ({
                      ...current,
                      [currentCapabilityDraft.id]: {
                        ...current[currentCapabilityDraft.id],
                        enabled: !current[currentCapabilityDraft.id].enabled,
                      },
                    }))
                  }
                  disabled={saving}
                  ariaLabel={t("integrationsPage.drawer.enableCapability")}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  variant="primary"
                  onClick={() => void saveCapability(currentCapabilityDraft.id)}
                  disabled={saving}
                >
                  {t("integrationsPage.actions.saveCapability")}
                </Button>
              </div>
            </div>
          ) : (
            <Alert variant="info" title={t("integrationsPage.drawer.noCapabilities")}>
              {t("integrationsPage.drawer.noCapabilitiesDescription")}
            </Alert>
          )
        ) : null}

        {drawerTab === "debug" ? (
          currentCapabilityDraft ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-ui-panel border border-border bg-surface-secondary/20 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-text-tertiary">{t("integrationsPage.drawer.runtimeStatus")}</div>
                  <div className="mt-1 text-sm font-medium text-text-primary">
                    {t(capabilityStatusLabel(statuses[currentCapabilityDraft.id]?.status))}
                  </div>
                </div>
                <div className="rounded-ui-panel border border-border bg-surface-secondary/20 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-text-tertiary">{t("integrationsPage.drawer.recentError")}</div>
                  <div className="mt-1 text-sm font-medium text-text-primary">
                    {statuses[currentCapabilityDraft.id]?.lastError || t("integrationsPage.drawer.noError")}
                  </div>
                </div>
              </div>

              {currentCapabilityDraft.type === "wecom.smart_robot" ? (
                <div className="space-y-4">
                  <Alert variant="info" title={t("integrationsPage.drawer.smartRobotDebug")}>
                    {t("integrationsPage.drawer.smartRobotDebugDescription")}
                  </Alert>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void handleStartCapability(currentCapabilityDraft.id)}
                      disabled={
                        saving ||
                        statuses[currentCapabilityDraft.id]?.status === "connected" ||
                        statuses[currentCapabilityDraft.id]?.status === "connecting"
                      }
                    >
                      {t("integrationsPage.actions.start")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void handleStopCapability(currentCapabilityDraft.id)}
                      disabled={
                        saving ||
                        statuses[currentCapabilityDraft.id]?.status === "stopped" ||
                        statuses[currentCapabilityDraft.id]?.status === "idle"
                      }
                    >
                      {t("integrationsPage.actions.stop")}
                    </Button>
                  </div>
                </div>
              ) : null}

              {currentCapabilityDraft.type === "wecom.webhook_robot" ? (
                <div className="space-y-4">
                  <TextArea
                    label={t("integrationsPage.drawer.messageContent")}
                    value={testMessage}
                    onChange={setTestMessage}
                    rows={6}
                    disabled={testingCapabilityId === currentCapabilityDraft.id}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Select
                      label={t("integrationsPage.drawer.messageFormat")}
                      value={testFormat}
                      onChange={(value) => setTestFormat(value === "text" ? "text" : "markdown")}
                      options={[
                        { value: "markdown", label: "markdown" },
                        { value: "text", label: "text" },
                      ]}
                    />
                    <div className="flex items-center justify-between rounded-ui-panel border border-border bg-surface-secondary/20 px-4 py-3">
                      <div>
                        <div className="text-sm font-medium text-text-primary">{t("integrationsPage.drawer.mentionAll")}</div>
                        <div className="text-xs text-text-tertiary">{t("integrationsPage.drawer.mentionAllDescription")}</div>
                      </div>
                      <Switch
                        checked={mentionAll}
                        onChange={() => setMentionAll((current) => !current)}
                        ariaLabel={t("integrationsPage.drawer.mentionAll")}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="primary"
                      onClick={() => void sendTest(currentCapabilityDraft.id)}
                      disabled={testingCapabilityId === currentCapabilityDraft.id}
                    >
                      {t("integrationsPage.actions.sendTest")}
                    </Button>
                  </div>
                </div>
              ) : null}

              {statuses[currentCapabilityDraft.id]?.lastError ? (
                <Alert variant="warning" title={t("integrationsPage.drawer.latestError")}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{statuses[currentCapabilityDraft.id]?.lastError}</span>
                  </div>
                </Alert>
              ) : null}
            </div>
          ) : (
            <Alert variant="info" title={t("integrationsPage.drawer.noDebugTarget")}>
              {t("integrationsPage.drawer.noDebugTargetDescription")}
            </Alert>
          )
        ) : null}
      </Drawer>
    </SettingsPageLayout>
  );
}
