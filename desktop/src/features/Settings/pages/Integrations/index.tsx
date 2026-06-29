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
import { Select, TextArea, TextInput } from "@/shared/ui";
import { message } from "@/shared/ui/Message";
import { ApiError } from "@/shared/lib/request";
import { listKnowledgeBases, type KnowledgeBaseSummary } from "@/shared/api/knowledgeBase";
import {
  getIntegrationCapabilityStatus,
  getIntegrationInstances,
  sendWecomRobotCapabilityTestMessage,
  startIntegrationCapability,
  stopIntegrationCapability,
  updateIntegrationCapability,
  updateIntegrationInstance,
  type IntegrationCapabilityRecord,
  type IntegrationCapabilityStatus,
  type IntegrationInstanceRecord,
  type IntegrationProviderCode,
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
  knowledgeBaseId: string;
  botId: string;
  secret: string;
  webhookUrl: string;
  webhookSecret: string;
  replyMode: "stream" | "send";
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
  if (type === "wecom.smart_robot") return "智能机器人";
  if (type === "wecom.webhook_robot") return "Webhook 机器人";
  return type;
};

const capabilityDescription = (type: string) => {
  if (type === "wecom.smart_robot") return "接收群聊 @ 和单聊消息，调用知识库后自动回复。";
  if (type === "wecom.webhook_robot") return "从聊天或流程里主动推送通知到企业微信群。";
  return "第三方接入能力。";
};

const supportsRuntimeStatus = (type: string) => type === "wecom.smart_robot";

const capabilityStatusLabel = (status?: IntegrationCapabilityStatus["status"]) => {
  if (status === "connected") return "运行中";
  if (status === "connecting") return "连接中";
  if (status === "error") return "异常";
  if (status === "stopped") return "已停止";
  if (status === "idle") return "待配置";
  return "待配置";
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
    return { label: "已停用", tone: "muted" as const };
  }

  const statusList = instanceCapabilities
    .map((capability) => statuses[capability.id]?.status ?? "idle")
    .filter(Boolean);

  if (statusList.some((status) => status === "error")) {
    return { label: "异常", tone: "danger" as const };
  }
  if (statusList.some((status) => status === "connecting")) {
    return { label: "连接中", tone: "warning" as const };
  }
  if (statusList.some((status) => status === "connected")) {
    return { label: "可用", tone: "success" as const };
  }
  if (instanceCapabilities.length === 0) {
    return { label: "未配置", tone: "warning" as const };
  }
  return { label: "待完善", tone: "warning" as const };
};

export default function IntegrationsSettings() {
  const { t } = useTranslation();
  const [activeProvider, setActiveProvider] = useState<IntegrationProviderCode>("wecom");
  const [instances, setInstances] = useState<IntegrationInstanceRecord[]>([]);
  const [capabilities, setCapabilities] = useState<IntegrationCapabilityRecord[]>([]);
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
  const [testMessage, setTestMessage] = useState("这是一条企业微信测试消息。");
  const [testFormat, setTestFormat] = useState<"markdown" | "text">("markdown");
  const [mentionAll, setMentionAll] = useState(false);
  const [instanceDraft, setInstanceDraft] = useState<InstanceDraft | null>(null);
  const [capabilityDrafts, setCapabilityDrafts] = useState<Record<string, CapabilityDraft>>({});

  const platformTabs = useMemo<PlatformTab[]>(
    () => [
      { code: "wecom", label: "企业微信" },
      { code: "lark", label: "飞书", planned: true },
      { code: "dingtalk", label: "钉钉", planned: true },
    ],
    [],
  );

  const filteredInstances = activeProvider === "wecom" ? instances : [];
  const currentInstance =
    filteredInstances.find((item) => item.id === activeInstanceId) ??
    filteredInstances.find((item) => item.isDefault) ??
    filteredInstances[0] ??
    null;
  const currentCapabilities = currentInstance
    ? capabilities.filter((item) => item.instanceId === currentInstance.id)
    : [];
  const currentCapability =
    currentCapabilities.find((item) => item.id === activeCapabilityId) ??
    currentCapabilities.find((item) => item.isDefault) ??
    currentCapabilities[0] ??
    null;
  const currentCapabilityDraft = currentCapability ? capabilityDrafts[currentCapability.id] ?? null : null;
  const currentHealth = currentInstance
    ? instanceHealth(currentInstance, currentCapabilities, statuses)
    : { label: "未配置", tone: "warning" as const };
  const primaryMethod = currentCapabilities[0] ? capabilityLabel(currentCapabilities[0].type) : "未设置";

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
      const [instanceResult, kbResult] = await Promise.all([
        getIntegrationInstances({ provider: "wecom", includeCapabilities: true }),
        listKnowledgeBases(),
      ]);

      const nextInstances = instanceResult.instances;
      const nextCapabilities = nextInstances.flatMap((item) => item.capabilities ?? []).filter(Boolean);
      const nextCapabilityDrafts: Record<string, CapabilityDraft> = Object.fromEntries(
        nextCapabilities.map((capability) => [
          capability.id,
          {
            id: capability.id,
            instanceId: capability.instanceId,
            type: capability.type,
            name: capability.name,
            enabled: capability.enabled,
            knowledgeBaseId: capability.knowledgeBaseId ?? "",
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
      message.error(error instanceof Error ? error.message : t("settings.integrations.messages.loadFailed"));
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
      message.success(t("settings.integrations.messages.instanceSaved"));
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : t("settings.integrations.messages.instanceSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const saveCapability = async (capabilityId: string) => {
    const draft = capabilityDrafts[capabilityId];
    if (!draft) return;
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
        if (draft.knowledgeBaseId.trim()) {
          config.knowledgeBaseId = draft.knowledgeBaseId.trim();
        } else {
          delete config.knowledgeBaseId;
        }
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
        knowledgeBaseId: draft.type === "wecom.smart_robot" ? draft.knowledgeBaseId.trim() || null : null,
        config,
      });

      message.success(t("settings.integrations.messages.capabilitySaved"));
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : t("settings.integrations.messages.capabilitySaveFailed"));
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
      message.success("智能机器人已启动");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "启动失败");
    } finally {
      setSaving(false);
    }
  };

  const handleStopCapability = async (capabilityId: string) => {
    setSaving(true);
    try {
      await stopIntegrationCapability(capabilityId);
      await refreshCapabilityStatus(capabilityId);
      message.success("智能机器人已停止");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "停止失败");
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
      message.success(t("settings.wecom.messages.testMessageSent"));
    } catch (error) {
      message.error(error instanceof ApiError ? error.message : t("settings.wecom.messages.testMessageFailed"));
    } finally {
      setTestingCapabilityId("");
    }
  };

  return (
    <SettingsPageLayout
      miniTitle={t("settings.integrations.page.miniTitle")}
      title={t("settings.integrations.page.title")}
      description={t("settings.integrations.page.description")}
      slot={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setGuideOpen(true)}>
            <BookOpen className="h-4 w-4" />
            如何接入
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {t("settings.integrations.actions.refresh")}
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
              {tab.planned ? <Badge variant="muted" size="sm">规划中</Badge> : null}
            </span>
          ),
        }))}
        value={activeProvider}
        onChange={setActiveProvider}
      />

      {activeProvider !== "wecom" ? (
        <Alert
          variant="info"
          title={`${platformTabs.find((item) => item.code === activeProvider)?.label ?? ""}规划中`}
        >
          当前这一页先聚焦企业微信，飞书和钉钉后续会沿用同一套轻量接入面板。
        </Alert>
      ) : null}

      {activeProvider === "wecom" && !currentInstance ? (
        <Alert variant="info" title={t("settings.integrations.empty.title")}>
          {t("settings.integrations.empty.description")}
        </Alert>
      ) : null}

      {activeProvider === "wecom" && currentInstance ? (
        <>
          <Card variant="default" className="p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                    当前接入
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-2xl font-semibold text-text-primary">
                      {currentInstance.name || t("settings.integrations.instance.unnamed")}
                    </h3>
                    <Badge variant={currentHealth.tone} size="sm">
                      {currentHealth.label}
                    </Badge>
                  </div>
                  <p className="max-w-2xl text-sm leading-6 text-text-secondary">
                    管理本地企业平台接入。完成配置后，可在聊天、自动化流程和机器人回复链路中使用。
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-[0.08em] text-text-tertiary">
                      平台
                    </div>
                    <div className="text-sm font-medium text-text-primary">企业微信</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-[0.08em] text-text-tertiary">
                      当前主要方式
                    </div>
                    <div className="text-sm font-medium text-text-primary">{primaryMethod}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-[0.08em] text-text-tertiary">
                      已接入方式
                    </div>
                    <div className="text-sm font-medium text-text-primary">{currentCapabilities.length} 项</div>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <Button variant="outline" onClick={() => setGuideOpen(true)}>
                  接入说明
                </Button>
                <Button variant="outline" onClick={() => openCurrentDrawer("debug")}>
                  状态与调试
                </Button>
                <Button variant="primary" onClick={() => openCurrentDrawer("basic")}>
                  配置接入
                </Button>
              </div>
            </div>
          </Card>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-text-primary">接入方式</h3>
                <p className="mt-1 text-sm text-text-secondary">
                  这里列出当前企业微信接入下真正可用的方式，点击后在右侧完成配置或调试。
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {currentCapabilities.map((capability) => {
                const draft = capabilityDrafts[capability.id];
                const runtime = statuses[capability.id];
                const Icon = capabilityIcon(capability.type);
                const kbName = knowledgeBases.find((item) => item.id === capability.knowledgeBaseId)?.name;

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
                              {capabilityLabel(capability.type)}
                            </div>
                            <Badge variant={runtimeStatusTone(runtime?.status)} size="sm">
                              {capabilityStatusLabel(runtime?.status)}
                            </Badge>
                          </div>
                          <div className="text-sm text-text-secondary">{capabilityDescription(capability.type)}</div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-tertiary">
                            <span>{draft?.enabled ? "已启用" : "未启用"}</span>
                            {capability.type === "wecom.smart_robot" ? (
                              <span>{kbName ? `知识库：${kbName}` : "未绑定知识库"}</span>
                            ) : null}
                            {runtime?.lastError ? <span className="text-danger">最近异常：{runtime.lastError}</span> : null}
                          </div>
                        </div>
                      </div>

                      <div className="inline-flex items-center gap-1 self-end text-sm font-medium text-primary lg:self-center">
                        配置
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
        closeLabel="关闭接入说明"
        closeMaskLabel="关闭接入说明"
        header={
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wide text-text-tertiary">企业微信</div>
            <div className="text-base font-semibold text-text-primary">如何接入企业微信</div>
            <div className="text-sm leading-6 text-text-secondary">
              这一页只说明本地应用当前支持的两种接法，以及各自该填什么配置。
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-ui-control border border-dashed border-border px-4 py-3 text-xs leading-6 text-text-tertiary">
            当前建议先把企业微信看成两个能力：智能机器人负责问答入口，Webhook 机器人负责主动通知。
          </div>

          <GuideSection
            icon={<Sparkles className="h-4 w-4 text-icon-secondary" />}
            title="先决定你要接哪种方式"
            body="如果你希望别人 @ 机器人后进入知识库问答，请配置智能机器人；如果你只是想从 Chat 或流程里主动把结果发到企业微信群，请配置 Webhook 机器人。两者不是一回事。"
          />
          <GuideSection
            icon={<Bot className="h-4 w-4 text-icon-secondary" />}
            title="智能机器人怎么配"
            body="去企业微信管理后台创建智能机器人，选择 API 模式和长连接方式，拿到 Bot ID 和 Secret。然后回到这里，在“智能机器人”里填写 Bot ID、Secret、知识库和回复模式，再点击启动。"
          />
          <GuideSection
            icon={<Webhook className="h-4 w-4 text-icon-secondary" />}
            title="Webhook 机器人怎么配"
            body="去企业微信群添加机器人，拿到 Webhook URL；如果群机器人配置了签名，再一并填写 Webhook Secret。保存后可以在“状态与调试”里直接发一条测试消息。"
          />
          <GuideSection
            icon={<Search className="h-4 w-4 text-icon-secondary" />}
            title="接入后的验证顺序"
            body="智能机器人先验证能否成功启动，再到企业微信里 @ 它发一条简单消息；Webhook 机器人则直接用测试消息验证。建议先用短文本验证，不要一开始就用复杂问题。"
          />
          <GuideSection
            icon={<PlugZap className="h-4 w-4 text-icon-secondary" />}
            title="接入完成后怎么用"
            body="智能机器人是外部问答入口，别人 @ 它时会走本地知识库；Webhook 机器人是主动通知出口，后续会从 Chat 或自动化流程里调用，不是靠别人 @ 它。"
          />
          <GuideSection
            icon={<CircleAlert className="h-4 w-4 text-icon-secondary" />}
            title="当前能力边界"
            body="智能机器人只能处理企业微信已经投递到本地服务的消息。若企业微信平台侧未投递、被拦截或被内容治理命中，本地应用无法补救，也不会收到任何入站日志。"
          />
          <GuideSection
            icon={<ExternalLink className="h-4 w-4 text-icon-secondary" />}
            title="本地应用为什么不讲 OAuth"
            body="因为我们当前主线不是网页授权绑定。本地桌面应用没有天然公网回调域名，第一阶段先聚焦机器人链路；自建应用、OAuth 和组织能力扩展属于后续能力。"
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
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">企业微信</span>
                <Badge variant={currentHealth.tone} size="sm">
                  {currentHealth.label}
                </Badge>
              </div>
              <div className="text-lg font-semibold text-text-primary">
                {drawerTab === "basic"
                  ? currentInstance.name || t("settings.integrations.instance.unnamed")
                  : capabilityLabel(currentCapability?.type ?? "")}
              </div>
              <div className="text-sm text-text-secondary">
                {drawerTab === "basic"
                  ? "当前接入的基础信息"
                  : "配置当前接入方式，并在需要时做最小调试"}
              </div>
            </div>
          ) : null
        }
        bodyClassName="space-y-5"
      >
        <NavigationCardTabs
          tabs={[
            { value: "basic", label: "基础配置", icon: <ShieldCheck className="h-4 w-4" /> },
            { value: "caps", label: "接入方式", icon: <Bot className="h-4 w-4" /> },
            { value: "debug", label: "状态与调试", icon: <Database className="h-4 w-4" /> },
          ]}
          value={drawerTab}
          onChange={(value) => setDrawerTab(value as typeof drawerTab)}
        />

        {drawerTab === "basic" && instanceDraft ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-ui-panel border border-border bg-surface-secondary/30 px-4 py-3">
              <div className="space-y-1">
                <div className="text-sm font-medium text-text-primary">启用当前接入</div>
                <div className="text-xs text-text-tertiary">
                  关闭后，这个企业微信接入及其下属方式都会停止对外提供服务。
                </div>
              </div>
              <Switch
                checked={instanceDraft.enabled}
                onChange={() =>
                  setInstanceDraft((current) => (current ? { ...current, enabled: !current.enabled } : current))
                }
                disabled={saving}
                ariaLabel="启用当前接入"
              />
            </div>

            <div className="grid gap-4">
              <TextInput
                label="接入名称"
                value={instanceDraft.name}
                onChange={(value) => setInstanceDraft((current) => (current ? { ...current, name: value } : current))}
                disabled={saving}
              />
              <TextInput
                label="企业标识"
                value={instanceDraft.externalTenantId}
                onChange={(value) =>
                  setInstanceDraft((current) => (current ? { ...current, externalTenantId: value } : current))
                }
                placeholder="可填写企业 ID / 租户标识，便于区分"
                disabled={saving}
              />
            </div>

            <div className="rounded-ui-panel border border-border bg-surface-secondary/20 px-4 py-3 text-sm text-text-secondary">
              这一层只保留轻量基础信息，Bot ID、Webhook、知识库等具体内容放在“接入方式”里配置。
            </div>

            <div className="flex justify-end">
              <Button variant="primary" onClick={() => void saveInstance()} disabled={saving}>
                保存基础配置
              </Button>
            </div>
          </div>
        ) : null}

        {drawerTab === "caps" ? (
          currentCapabilityDraft ? (
            <div className="space-y-5">
              <Select
                label="接入方式"
                value={currentCapabilityDraft.id}
                onChange={(value) => setActiveCapabilityId(value)}
                options={currentCapabilities.map((item) => ({
                  value: item.id,
                  label: capabilityLabel(item.type),
                }))}
                disabled={saving}
              />

              <div className="rounded-ui-panel border border-border bg-surface-secondary/20 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-medium text-text-primary">
                    {capabilityLabel(currentCapabilityDraft.type)}
                  </div>
                  <Badge variant={runtimeStatusTone(statuses[currentCapabilityDraft.id]?.status)} size="sm">
                    {capabilityStatusLabel(statuses[currentCapabilityDraft.id]?.status)}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-text-secondary">
                  {capabilityDescription(currentCapabilityDraft.type)}
                </p>
              </div>

              <div className="grid gap-4">
                <TextInput
                  label="显示名称"
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
                      label="Bot ID"
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
                      label="Secret"
                      value={currentCapabilityDraft.secret}
                      onChange={(value) =>
                        setCapabilityDrafts((current) => ({
                          ...current,
                          [currentCapabilityDraft.id]: { ...current[currentCapabilityDraft.id], secret: value },
                        }))
                      }
                      placeholder="留空表示保持当前 secret"
                      type="password"
                      disabled={saving}
                    />
                    <Select
                      label="知识库"
                      value={currentCapabilityDraft.knowledgeBaseId}
                      onChange={(value) =>
                        setCapabilityDrafts((current) => ({
                          ...current,
                          [currentCapabilityDraft.id]: { ...current[currentCapabilityDraft.id], knowledgeBaseId: value },
                        }))
                      }
                      options={[
                        { value: "", label: "暂不绑定知识库" },
                        ...knowledgeBases.map((item) => ({ value: item.id, label: item.name })),
                      ]}
                      disabled={saving}
                    />
                    <Select
                      label="回复模式"
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
                      placeholder="留空表示保持当前 secret"
                      type="password"
                      disabled={saving}
                    />
                  </>
                ) : null}
              </div>

              <div className="flex items-center justify-between rounded-ui-panel border border-border bg-surface-secondary/20 px-4 py-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-text-primary">启用此方式</div>
                  <div className="text-xs text-text-tertiary">关闭后，该方式不会被聊天或自动化流程使用。</div>
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
                  ariaLabel="启用此方式"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  variant="primary"
                  onClick={() => void saveCapability(currentCapabilityDraft.id)}
                  disabled={saving}
                >
                  保存接入方式
                </Button>
              </div>
            </div>
          ) : (
            <Alert variant="info" title="暂无接入方式">
              当前接入下还没有可配置的方式。
            </Alert>
          )
        ) : null}

        {drawerTab === "debug" ? (
          currentCapabilityDraft ? (
            <div className="space-y-5">
              <Select
                label="调试对象"
                value={currentCapabilityDraft.id}
                onChange={(value) => setActiveCapabilityId(value)}
                options={currentCapabilities.map((item) => ({
                  value: item.id,
                  label: capabilityLabel(item.type),
                }))}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-ui-panel border border-border bg-surface-secondary/20 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-text-tertiary">运行状态</div>
                  <div className="mt-1 text-sm font-medium text-text-primary">
                    {capabilityStatusLabel(statuses[currentCapabilityDraft.id]?.status)}
                  </div>
                </div>
                <div className="rounded-ui-panel border border-border bg-surface-secondary/20 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-text-tertiary">最近错误</div>
                  <div className="mt-1 text-sm font-medium text-text-primary">
                    {statuses[currentCapabilityDraft.id]?.lastError || "无"}
                  </div>
                </div>
              </div>

              {currentCapabilityDraft.type === "wecom.smart_robot" ? (
                <div className="space-y-4">
                  <Alert variant="info" title="智能机器人调试">
                    这里先只保留连接态调试。真正的问答链路建议直接在企业微信里 @ 机器人验证。
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
                      启动
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
                      停止
                    </Button>
                  </div>
                </div>
              ) : null}

              {currentCapabilityDraft.type === "wecom.webhook_robot" ? (
                <div className="space-y-4">
                  <TextArea
                    label="消息内容"
                    value={testMessage}
                    onChange={setTestMessage}
                    rows={6}
                    disabled={testingCapabilityId === currentCapabilityDraft.id}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Select
                      label="消息格式"
                      value={testFormat}
                      onChange={(value) => setTestFormat(value === "text" ? "text" : "markdown")}
                      options={[
                        { value: "markdown", label: "markdown" },
                        { value: "text", label: "text" },
                      ]}
                    />
                    <div className="flex items-center justify-between rounded-ui-panel border border-border bg-surface-secondary/20 px-4 py-3">
                      <div>
                        <div className="text-sm font-medium text-text-primary">提醒全员</div>
                        <div className="text-xs text-text-tertiary">@all 仍有已知问题，先保留入口。</div>
                      </div>
                      <Switch
                        checked={mentionAll}
                        onChange={() => setMentionAll((current) => !current)}
                        ariaLabel="提醒全员"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="primary"
                      onClick={() => void sendTest(currentCapabilityDraft.id)}
                      disabled={testingCapabilityId === currentCapabilityDraft.id}
                    >
                      发送测试消息
                    </Button>
                  </div>
                </div>
              ) : null}

              {statuses[currentCapabilityDraft.id]?.lastError ? (
                <Alert variant="warning" title="最近一次运行异常">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{statuses[currentCapabilityDraft.id]?.lastError}</span>
                  </div>
                </Alert>
              ) : null}
            </div>
          ) : (
            <Alert variant="info" title="暂无可调试对象">
              请先配置一个接入方式。
            </Alert>
          )
        ) : null}
      </Drawer>
    </SettingsPageLayout>
  );
}
