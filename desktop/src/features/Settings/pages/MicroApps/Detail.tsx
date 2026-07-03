import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bot, BookOpen, RefreshCcw, Sparkles, Webhook } from "lucide-react";
import SettingsPageLayout from "../../components/SettingsPageLayout";
import Card from "@/shared/ui/Card";
import Badge from "@/shared/ui/Badge";
import Alert from "@/shared/ui/Alert";
import Switch from "@/shared/ui/Switch";
import { Button, FullPageStatus, TextInput } from "@/shared/ui";
import { message } from "@/shared/ui/Message";
import {
  getIntegrationCapabilityMicroAppBinding,
  getIntegrationCapabilityStatus,
  getIntegrationInstances,
  getIntegrationMicroApps,
  updateIntegrationCapabilityMicroAppBinding,
  updateIntegrationMicroApp,
  type IntegrationCapabilityRecord,
  type IntegrationCapabilityStatus,
  type IntegrationInstanceRecord,
  type MicroAppRecord,
} from "@/shared/api/integrations";

type SmartRobotBindingItem = {
  instance: IntegrationInstanceRecord;
  capability: IntegrationCapabilityRecord;
  bindingMicroAppDefinitionId: string | null;
  runtimeStatus: IntegrationCapabilityStatus["status"] | null;
};

const countBoundAccessPoints = (
  bindingItems: SmartRobotBindingItem[],
  microAppId: string | undefined,
) => {
  if (!microAppId) {
    return 0;
  }

  return new Set(
    bindingItems
      .filter((item) => item.bindingMicroAppDefinitionId === microAppId)
      .map((item) => item.capability.id),
  ).size;
};

const runtimeStatusLabel = (status: IntegrationCapabilityStatus["status"] | null) => {
  if (status === "connected") return "运行中";
  if (status === "connecting") return "连接中";
  if (status === "error") return "异常";
  if (status === "stopped") return "已停止";
  return "待配置";
};

const runtimeStatusTone = (status: IntegrationCapabilityStatus["status"] | null) => {
  if (status === "connected") return "success";
  if (status === "connecting") return "warning";
  if (status === "error") return "danger";
  if (status === "stopped") return "muted";
  return "muted";
};

const detailSummary = (microApp: MicroAppRecord) => {
  if (microApp.type === "knowledge_query") {
    return "把外部平台投递进来的文本问题送入本地知识库检索链路，并回一条稳定文本回复。";
  }
  return "企业集成微应用。";
};

const detailCapabilities = (microApp: MicroAppRecord) => {
  if (microApp.type === "knowledge_query") {
    return [
      "支持企业微信智能机器人作为问答入口",
      "接入点绑定时动态填写知识库配置",
      "当前只返回单条稳定文本回复，不额外扩展多轮代理能力",
    ];
  }
  return ["企业集成能力"];
};

export default function MicroAppDetailPage() {
  const { t } = useTranslation();
  const { appId = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [microApp, setMicroApp] = useState<MicroAppRecord | null>(null);
  const [bindingItems, setBindingItems] = useState<SmartRobotBindingItem[]>([]);
  const [draft, setDraft] = useState({
    name: "",
    enabled: true,
  });

  const load = async () => {
    setLoading(true);
    try {
      const [microAppResult, instanceResult] = await Promise.all([
        getIntegrationMicroApps({ type: "knowledge_query" }),
        getIntegrationInstances({ provider: "wecom", includeCapabilities: true }),
      ]);

      const nextMicroApp =
        microAppResult.microApps.find((item) => item.id === appId) ?? null;
      if (!nextMicroApp) {
        setMicroApp(null);
        setBindingItems([]);
        return;
      }

      const smartRobots = instanceResult.instances.flatMap((instance) =>
        (instance.capabilities ?? [])
          .filter((capability) => capability.type === "wecom.smart_robot")
          .map((capability) => ({ instance, capability })),
      );

      const nextBindingItems = await Promise.all(
        smartRobots.map(async ({ instance, capability }) => {
          const [bindingResult, statusResult] = await Promise.all([
            getIntegrationCapabilityMicroAppBinding(capability.id).catch(() => ({
              binding: null,
              microApp: null,
            })),
            getIntegrationCapabilityStatus(capability.id).catch(() => null),
          ]);

          return {
            instance,
            capability,
            bindingMicroAppDefinitionId:
              bindingResult.binding?.microAppDefinitionId ?? null,
            runtimeStatus: statusResult?.status ?? null,
          } satisfies SmartRobotBindingItem;
        }),
      );

      setMicroApp(nextMicroApp);
      setBindingItems(nextBindingItems);
      setDraft({
        name: nextMicroApp.name,
        enabled: nextMicroApp.enabled,
      });
    } catch (error) {
      message.error(error instanceof Error ? error.message : t("settings.microApps.messages.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [appId]);

  const boundCount = useMemo(
    () => countBoundAccessPoints(bindingItems, microApp?.id),
    [bindingItems, microApp?.id],
  );

  const saveMicroApp = async () => {
    if (!microApp) return;
    setSaving(true);
    try {
      const result = await updateIntegrationMicroApp(microApp.id, {
        name: draft.name.trim(),
        enabled: draft.enabled,
      });
      setMicroApp(result.microApp);
      setDraft({
        name: result.microApp.name,
        enabled: result.microApp.enabled,
      });
      message.success(t("settings.microApps.messages.saved"));
    } catch (error) {
      message.error(error instanceof Error ? error.message : t("settings.microApps.messages.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const toggleBinding = async (capabilityId: string, checked: boolean) => {
    if (!microApp) return;
    if (checked) {
      message.info("请回到对应接入点里完成微应用绑定和配置。");
      return;
    }
    setSaving(true);
    try {
      await updateIntegrationCapabilityMicroAppBinding(
        capabilityId,
        {
          microAppId: null,
        },
      );
      await load();
      message.success(
        checked
          ? t("settings.microApps.messages.bindingEnabled")
          : t("settings.microApps.messages.bindingDisabled"),
      );
    } catch (error) {
      message.error(error instanceof Error ? error.message : t("settings.microApps.messages.bindingFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SettingsPageLayout
        miniTitle={t("settings.microApps.page.miniTitle")}
        title={t("settings.microApps.page.title")}
        description={t("settings.microApps.page.description")}
        contentClassName="pt-6"
      >
        <FullPageStatus message={t("settings.microApps.states.loading")} />
      </SettingsPageLayout>
    );
  }

  if (!microApp) {
    return (
      <SettingsPageLayout
        miniTitle={t("settings.microApps.page.miniTitle")}
        title={t("settings.microApps.page.title")}
        description={t("settings.microApps.page.description")}
        contentClassName="pt-6"
      >
        <FullPageStatus message={t("settings.microApps.detail.notFound")} />
      </SettingsPageLayout>
    );
  }

  return (
    <SettingsPageLayout
      miniTitle={t("settings.microApps.page.miniTitle")}
      title={microApp.name}
      description={detailSummary(microApp)}
      slot={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || saving}>
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {t("settings.microApps.actions.refresh")}
          </Button>
          <Button variant="primary" size="sm" onClick={() => void saveMicroApp()} disabled={saving}>
            {t("settings.microApps.actions.save")}
          </Button>
        </div>
      }
      contentClassName="space-y-6 pt-6"
    >
      <div className="flex items-start gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] bg-primary/10 text-primary">
          <BookOpen className="h-8 w-8" />
        </span>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={microApp.enabled ? "success" : "muted"} size="sm">
              {microApp.enabled
                ? t("settings.microApps.labels.enabled")
                : t("settings.microApps.labels.disabled")}
            </Badge>
            <Badge variant="muted" size="sm">{t("settings.microApps.labels.supportsWecomSmartRobot")}</Badge>
            <Badge variant="muted" size="sm">
              {t("settings.microApps.labels.boundCount", { count: boundCount })}
            </Badge>
          </div>
          <div className="text-sm leading-6 text-text-secondary">
            {t("settings.microApps.detail.summary")}
          </div>
        </div>
      </div>

      <Alert variant="info" title={t("settings.microApps.detail.currentBoundaryTitle")}>
        {t("settings.microApps.detail.currentBoundaryDescription")}
      </Alert>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="space-y-5">
              <div>
                <div className="text-base font-semibold text-text-primary">
                  {t("settings.microApps.detail.sections.config")}
                </div>
                <div className="mt-1 text-sm text-text-secondary">
                  {t("settings.microApps.detail.configDescription")}
                </div>
              </div>

              <div className="grid gap-4">
                <TextInput
                  label={t("settings.microApps.labels.name")}
                  value={draft.name}
                  onChange={(value) => setDraft((current) => ({ ...current, name: value }))}
                  disabled={saving}
                />
              </div>

              <div className="flex items-center justify-between rounded-ui-panel border border-border bg-surface-secondary/20 px-4 py-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-text-primary">
                    {t("settings.microApps.labels.enabled")}
                  </div>
                  <div className="text-xs text-text-tertiary">
                    {t("settings.microApps.detail.enabledHint")}
                  </div>
                </div>
                <Switch
                  checked={draft.enabled}
                  onChange={() =>
                    setDraft((current) => ({ ...current, enabled: !current.enabled }))
                  }
                  disabled={saving}
                  ariaLabel={t("settings.microApps.labels.enabled")}
                />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <div className="text-base font-semibold text-text-primary">
                  {t("settings.microApps.detail.sections.accessPoints")}
                </div>
                <div className="mt-1 text-sm text-text-secondary">
                  {t("settings.microApps.detail.accessPointsDescription")}
                </div>
              </div>

              <div className="space-y-3">
                {bindingItems.length === 0 ? (
                  <Alert variant="info" title={t("settings.microApps.detail.noAccessPointTitle")}>
                    {t("settings.microApps.detail.noAccessPointDescription")}
                  </Alert>
                ) : null}

                {bindingItems.map((item) => {
                  const boundToCurrent =
                    item.bindingMicroAppDefinitionId === microApp.id;

                  return (
                    <div
                      key={item.capability.id}
                      className="flex flex-col gap-4 rounded-ui-panel border border-border bg-surface-primary px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-medium text-text-primary">
                            {item.capability.name || t("settings.microApps.labels.unnamedSmartRobot")}
                          </div>
                          <Badge variant={runtimeStatusTone(item.runtimeStatus)} size="sm">
                            {runtimeStatusLabel(item.runtimeStatus)}
                          </Badge>
                          <Badge variant={boundToCurrent ? "success" : "muted"} size="sm">
                            {boundToCurrent
                              ? t("settings.microApps.labels.bound")
                              : t("settings.microApps.labels.unbound")}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-tertiary">
                          <span>{t("settings.microApps.labels.platformWecom")}</span>
                          <span>{item.instance.name || t("settings.integrations.instance.unnamed")}</span>
                          <span>{t("settings.microApps.labels.smartRobotEntry")}</span>
                        </div>
                      </div>

                      <Switch
                        checked={boundToCurrent}
                        onChange={() => void toggleBinding(item.capability.id, !boundToCurrent)}
                        disabled={saving}
                        ariaLabel={t("settings.microApps.labels.bound")}
                      />
                    </div>
                  );
                })}
              </div>

              <Alert variant="info" title={t("settings.microApps.detail.unsupportedTitle")}>
                <div className="flex items-start gap-2">
                  <Webhook className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{t("settings.microApps.detail.unsupportedDescription")}</span>
                </div>
              </Alert>
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="p-6">
            <div className="space-y-4">
              <div className="text-base font-semibold text-text-primary">
                支持行为
              </div>
              {detailCapabilities(microApp).map((capability) => (
                <div key={capability} className="flex items-start gap-2 text-sm text-text-secondary">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{capability}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <div className="space-y-4">
              <div className="text-base font-semibold text-text-primary">绑定配置协议</div>
              {microApp.bindingSchema.fields.map((field) => (
                <div key={field.key} className="rounded-ui-panel border border-border bg-surface-secondary/20 px-4 py-3">
                  <div className="text-sm font-medium text-text-primary">{field.label}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.08em] text-text-tertiary">
                    {field.type}
                  </div>
                  {field.description ? (
                    <div className="mt-2 text-sm leading-6 text-text-secondary">{field.description}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <div className="space-y-4">
              <div className="text-base font-semibold text-text-primary">
                {t("settings.microApps.detail.sections.supportedEntries")}
              </div>
              <div className="flex items-center gap-2 rounded-ui-panel border border-border bg-surface-secondary/20 px-4 py-3 text-sm text-text-primary">
                <Bot className="h-4 w-4 text-primary" />
                <span>{t("settings.microApps.labels.supportsWecomSmartRobot")}</span>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </SettingsPageLayout>
  );
}
