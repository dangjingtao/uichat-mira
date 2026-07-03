import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bot, BookOpen, Link2, RefreshCcw, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import SettingsPageLayout from "../../components/SettingsPageLayout";
import Card from "@/shared/ui/Card";
import Badge from "@/shared/ui/Badge";
import Alert from "@/shared/ui/Alert";
import { Button, FullPageStatus } from "@/shared/ui";
import { message } from "@/shared/ui/Message";
import {
  getIntegrationCapabilityMicroAppBinding,
  getIntegrationInstances,
  getIntegrationMicroApps,
  type IntegrationInstanceRecord,
  type MicroAppRecord,
} from "@/shared/api/integrations";

type SmartRobotBindingSummary = {
  capabilityId: string;
  microAppDefinitionId: string | null;
};

const countBoundAccessPoints = (
  bindings: SmartRobotBindingSummary[],
  microAppId: string,
) =>
  new Set(
    bindings
      .filter((item) => item.microAppDefinitionId === microAppId)
      .map((item) => item.capabilityId),
  ).size;

const microAppSummary = (microApp: MicroAppRecord) => {
  if (microApp.type === "knowledge_query") {
    return "接收外部入口文本问题，调用本地知识库检索链路，并返回一条稳定回复。";
  }
  return "企业集成微应用。";
};

const microAppCapabilities = (microApp: MicroAppRecord) => {
  if (microApp.type === "knowledge_query") {
    return [
      "支持绑定企业微信智能机器人",
      "接入点绑定时动态填写知识库配置",
      "当前返回单条稳定文本回复",
    ];
  }
  return ["企业集成能力"];
};

export default function MicroAppsSettings() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [microApps, setMicroApps] = useState<MicroAppRecord[]>([]);
  const [instances, setInstances] = useState<IntegrationInstanceRecord[]>([]);
  const [bindings, setBindings] = useState<SmartRobotBindingSummary[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [microAppResult, instanceResult] = await Promise.all([
        getIntegrationMicroApps({ type: "knowledge_query" }),
        getIntegrationInstances({ provider: "wecom", includeCapabilities: true }),
      ]);

      const smartRobotCapabilities = instanceResult.instances.flatMap((instance) =>
        (instance.capabilities ?? []).filter(
          (capability) => capability.type === "wecom.smart_robot",
        ),
      );

      const nextBindings = await Promise.all(
        smartRobotCapabilities.map(async (capability) => {
          try {
            const result = await getIntegrationCapabilityMicroAppBinding(capability.id);
            return {
              capabilityId: capability.id,
              microAppDefinitionId: result.binding?.microAppDefinitionId ?? null,
            } satisfies SmartRobotBindingSummary;
          } catch {
            return {
              capabilityId: capability.id,
              microAppDefinitionId: null,
            } satisfies SmartRobotBindingSummary;
          }
        }),
      );

      setMicroApps(microAppResult.microApps);
      setInstances(instanceResult.instances);
      setBindings(nextBindings);
    } catch (error) {
      message.error(error instanceof Error ? error.message : t("settings.microApps.messages.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const smartRobotCapabilities = useMemo(
    () =>
      instances.flatMap((instance) =>
        (instance.capabilities ?? [])
          .filter((capability) => capability.type === "wecom.smart_robot")
          .map((capability) => ({
            instance,
            capability,
          })),
      ),
    [instances],
  );

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

  return (
    <SettingsPageLayout
      miniTitle={t("settings.microApps.page.miniTitle")}
      title={t("settings.microApps.page.title")}
      description={t("settings.microApps.page.description")}
      slot={
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {t("settings.microApps.actions.refresh")}
        </Button>
      }
      contentClassName="space-y-6 pt-6"
    >
      <Alert variant="info" title={t("settings.microApps.banner.title")}>
        {t("settings.microApps.banner.description")}
      </Alert>

      {microApps.length === 0 ? (
        <Alert variant="info" title={t("settings.microApps.states.emptyTitle")}>
          {t("settings.microApps.states.emptyDescription")}
        </Alert>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {microApps.map((microApp) => {
          const boundCount = countBoundAccessPoints(bindings, microApp.id);

          return (
            <Link key={microApp.id} to={`/settings/micro-apps/${microApp.id}`} className="block">
              <Card interactive className="h-full p-4">
                <div className="flex h-full flex-col gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-ui-control bg-primary/10 text-primary">
                          <BookOpen className="h-4.5 w-4.5" />
                        </span>
                        <div>
                          <div className="text-base font-semibold text-text-primary">{microApp.name}</div>
                          <div className="text-xs text-text-secondary">
                            {microApp.type === "knowledge_query"
                              ? t("settings.microApps.labels.knowledgeQuery")
                              : microApp.type}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs leading-5 text-text-secondary">{microAppSummary(microApp)}</div>
                    </div>
                    <Badge variant={microApp.enabled ? "success" : "muted"} size="sm">
                      {microApp.enabled
                        ? t("settings.microApps.labels.enabled")
                        : t("settings.microApps.labels.disabled")}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="muted" size="sm">
                      <Bot className="mr-1 h-3.5 w-3.5" />
                      {t("settings.microApps.labels.supportsWecomSmartRobot")}
                    </Badge>
                    <Badge variant="muted" size="sm">
                      <Link2 className="mr-1 h-3.5 w-3.5" />
                      {t("settings.microApps.labels.boundCount", { count: boundCount })}
                    </Badge>
                  </div>

                  <div className="grid gap-2">
                    <div className="rounded-ui-panel border border-border bg-surface-secondary/20 px-3 py-2.5">
                      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-text-tertiary">
                        支持接入点
                      </div>
                      <div className="mt-1 text-sm font-medium text-text-primary">
                        {microApp.supportedAccessPoints.length} 项
                      </div>
                    </div>
                    <div className="rounded-ui-panel border border-border bg-surface-secondary/20 px-3 py-2.5">
                      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-text-tertiary">
                        配置字段
                      </div>
                      <div className="mt-1 text-sm font-medium text-text-primary">
                        {microApp.bindingSchema.fields.length} 项
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {microAppCapabilities(microApp).slice(0, 2).map((capability) => (
                      <div key={capability} className="flex items-start gap-2 text-xs leading-5 text-text-secondary">
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span>{capability}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card variant="subtle" className="border-dashed">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-medium text-text-primary">
              {t("settings.microApps.footer.title")}
            </div>
            <div className="text-sm leading-6 text-text-secondary">
              {t("settings.microApps.footer.description", {
                count: smartRobotCapabilities.length,
              })}
            </div>
          </div>
        </div>
      </Card>
    </SettingsPageLayout>
  );
}
