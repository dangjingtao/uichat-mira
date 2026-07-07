import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Bot, BookOpen, Link2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import SettingsPageLayout from "../../components/SettingsPageLayout";
import Alert from "@/shared/ui/Alert";
import Card from "@/shared/ui/Card";
import Badge from "@/shared/ui/Badge";
import { Skeleton } from "@/shared/ui";
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

const featuredStudioEntries = [
  {
    key: "newsHub",
    route: "/settings/micro-apps/news-hub",
  },
  {
    key: "mailCenter",
    route: "/settings/micro-apps/mail-center",
  },
  {
    key: "computerUse",
    route: "/settings/micro-apps/computer-use-studio",
  },
  {
    key: "imageGeneration",
    route: "/settings/micro-apps/image-generation-studio",
  },
] as const;

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

  if (loading) {
    return (
      <SettingsPageLayout
        miniTitle={t("settings.microApps.page.miniTitle")}
        title={t("settings.microApps.page.title")}
        description={t("settings.microApps.page.description")}
        contentClassName="space-y-6 pt-6"
      >
        <div data-testid="micro-apps-loading-skeleton" className="space-y-6">
          <Card className="p-4">
            <div className="space-y-3">
              <Skeleton height={18} width="28%" />
              <Skeleton.Text lines={2} lastLineWidth="72%" />
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {featuredStudioEntries.map((entry) => (
              <Card key={entry.route} className="border-primary/15 bg-primary/5 p-5">
                <div className="flex h-full flex-col gap-4 lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Skeleton height={22} width={64} className="rounded-full" />
                      <Skeleton height={22} width={72} className="rounded-full" />
                      <Skeleton height={22} width={68} className="rounded-full" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton height={18} width="48%" />
                      <Skeleton.Text lines={2} lastLineWidth="68%" />
                      <Skeleton height={12} width="40%" />
                    </div>
                  </div>

                  <Skeleton height={40} width={136} />
                </div>
              </Card>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="h-full p-4">
                <div className="flex h-full flex-col gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <Skeleton.Circle size={36} className="shrink-0" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton height={18} width="46%" />
                        <Skeleton height={12} width="28%" />
                        <Skeleton.Text lines={2} lastLineWidth="74%" />
                      </div>
                    </div>
                    <Skeleton height={22} width={64} className="rounded-full" />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Skeleton height={22} width={144} className="rounded-full" />
                    <Skeleton height={22} width={120} className="rounded-full" />
                  </div>

                  <div className="grid gap-2">
                    <div className="rounded-ui-panel border border-border bg-surface-secondary/20 px-3 py-2.5">
                      <Skeleton height={12} width={80} />
                      <Skeleton height={16} width={44} className="mt-2" />
                    </div>
                    <div className="rounded-ui-panel border border-border bg-surface-secondary/20 px-3 py-2.5">
                      <Skeleton height={12} width={68} />
                      <Skeleton height={16} width={44} className="mt-2" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Skeleton height={12} width="84%" />
                    <Skeleton height={12} width="66%" />
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card variant="subtle" className="border-dashed">
            <div className="space-y-2">
              <Skeleton height={16} width="24%" />
              <Skeleton.Text lines={2} lastLineWidth="62%" />
            </div>
          </Card>
        </div>
      </SettingsPageLayout>
    );
  }

  return (
    <SettingsPageLayout
      miniTitle={t("settings.microApps.page.miniTitle")}
      title={t("settings.microApps.page.title")}
      description={t("settings.microApps.page.description")}
      contentClassName="space-y-6 pt-6"
    >
      <div data-testid="micro-apps-studio-grid" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {featuredStudioEntries.map((entry) => {
          const key = `settings.microApps.studioEntries.${entry.key}` as const;

          return (
            <Card key={entry.route} className="border-primary/15 bg-primary/5 p-5">
              <div className="flex h-full flex-col gap-4 lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="primary" size="sm">
                      {t(`${key}.badges.debug`)}
                    </Badge>
                    <Badge variant="muted" size="sm">
                      {t(`${key}.badges.focus`)}
                    </Badge>
                    <Badge variant="muted" size="sm">
                      {t(`${key}.badges.runtime`)}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="text-base font-semibold text-text-primary">
                      {t(`${key}.title`)}
                    </div>
                    <div className="text-sm leading-6 text-text-secondary">
                      {t(`${key}.description`)}
                    </div>
                    <div className="text-xs leading-5 text-text-tertiary">
                      {t(`${key}.hint`)}
                    </div>
                  </div>
                </div>

                <Link
                  to={entry.route}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-ui-control border border-primary/20 bg-transparent px-4 text-sm font-medium text-primary transition-all duration-150 ease-out hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary"
                >
                  {t(`${key}.actions.open`)}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </Card>
          );
        })}
      </div>

      {microApps.length === 0 ? (
        <Alert variant="info" title={t("settings.microApps.states.emptyTitle")}>
          {t("settings.microApps.states.emptyDescription")}
        </Alert>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {microApps.map((microApp) => {
          const boundCount = countBoundAccessPoints(bindings, microApp.id);

          return (
            <Link
              key={microApp.id}
              to={`/settings/micro-apps/${microApp.id}`}
              className="block"
              data-testid={`micro-app-card-${microApp.id}`}
            >
              <Card interactive className="h-full border-primary/15 bg-primary/5 p-5">
                <div className="flex h-full flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="primary" size="sm">
                      {microApp.type === "knowledge_query"
                        ? t("settings.microApps.labels.knowledgeQuery")
                        : microApp.type}
                    </Badge>
                    <Badge variant="muted" size="sm">
                      <Bot className="mr-1 h-3.5 w-3.5" />
                      {t("settings.microApps.labels.supportsWecomSmartRobot")}
                    </Badge>
                    <Badge variant="muted" size="sm">
                      <Link2 className="mr-1 h-3.5 w-3.5" />
                      {t("settings.microApps.labels.boundCount", { count: boundCount })}
                    </Badge>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-ui-control bg-primary/10 text-primary">
                          <BookOpen className="h-4.5 w-4.5" />
                        </span>
                        <div>
                          <div className="text-base font-semibold text-text-primary">{microApp.name}</div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm leading-6 text-text-secondary">
                          {microAppSummary(microApp)}
                        </div>
                        <div className="text-xs leading-5 text-text-tertiary">
                          {microApp.enabled
                            ? "当前已经接入企业问答流程，可继续承接企业微信智能机器人入口。"
                            : "当前已完成微应用注册，后续启用后即可继续承接真实入口。"}
                        </div>
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
    </SettingsPageLayout>
  );
}
