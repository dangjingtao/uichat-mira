import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, AudioLines, Bot, BookOpen, Image, Mail, MonitorSmartphone, Newspaper } from "lucide-react";
import { Link } from "react-router-dom";
import SettingsPageLayout from "../../components/SettingsPageLayout";
import Alert from "@/shared/ui/Alert";
import Card from "@/shared/ui/Card";
import Badge from "@/shared/ui/Badge";
import { Skeleton } from "@/shared/ui";
import { message } from "@/shared/ui/Message";
import {
  getIntegrationInstances,
  getIntegrationMicroApps,
  type MicroAppRecord,
} from "@/shared/api/integrations";

const microAppSummary = (microApp: MicroAppRecord) => {
  if (microApp.type === "knowledge_query") {
    return "接收外部入口文本问题，调用本地知识库检索链路，并返回一条稳定回复。";
  }
  return "企业集成微应用。";
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
  {
    key: "ttsStudio",
    route: "/settings/micro-apps/tts-studio",
  },
] as const;

const featuredStudioIcons = {
  newsHub: Newspaper,
  mailCenter: Mail,
  computerUse: MonitorSmartphone,
  imageGeneration: Image,
  ttsStudio: AudioLines,
} as const;

export default function MicroAppsSettings() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [microApps, setMicroApps] = useState<MicroAppRecord[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [microAppResult] = await Promise.all([
        getIntegrationMicroApps({ type: "knowledge_query" }),
        getIntegrationInstances({ provider: "wecom", includeCapabilities: true }),
      ]);

      setMicroApps(microAppResult.microApps);
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

          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card className="border-primary/15 bg-primary/5 p-5">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Skeleton height={22} width={72} className="rounded-full" />
                  <Skeleton height={22} width={84} className="rounded-full" />
                  <Skeleton height={22} width={76} className="rounded-full" />
                </div>
                <Skeleton height={20} width="34%" />
                <Skeleton.Text lines={4} lastLineWidth="58%" />
                <Skeleton height={40} width={160} />
              </div>
            </Card>

            <Card className="p-5">
              <div className="space-y-4">
                <Skeleton height={18} width="42%" />
                <Skeleton.Text lines={3} lastLineWidth="66%" />
                <Skeleton height={18} width="30%" />
                <Skeleton.Text lines={3} lastLineWidth="54%" />
              </div>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="p-5">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Skeleton.Circle size={36} className="shrink-0" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton height={18} width="52%" />
                      <Skeleton height={12} width="34%" />
                    </div>
                  </div>
                  <Skeleton.Text lines={4} lastLineWidth="62%" />
                </div>
              </Card>
            ))}
          </div>
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
      {microApps.length === 0 ? (
        <Alert variant="info" title={t("settings.microApps.states.emptyTitle")}>
          {t("settings.microApps.states.emptyDescription")}
        </Alert>
      ) : null}

      <div data-testid="micro-apps-studio-grid" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {featuredStudioEntries.map((entry) => {
          const key = `settings.microApps.studioEntries.${entry.key}` as const;
          const EntryIcon = featuredStudioIcons[entry.key];

          return (
            <Card key={entry.route} className="border-primary/15 bg-primary/5 p-5">
              <div className="flex h-full flex-col gap-4 lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="primary" size="sm">
                      {t(`${key}.badges.debug`)}
                    </Badge>
                    {entry.key === "imageGeneration" ? null : (
                      <Badge variant="muted" size="sm">
                        {t(`${key}.badges.focus`)}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        data-testid={`studio-entry-icon-${entry.key}`}
                        className="flex h-9 w-9 items-center justify-center rounded-ui-control bg-primary/10 text-primary"
                      >
                        <EntryIcon className="h-4.5 w-4.5" />
                      </span>
                      <div className="text-base font-semibold text-text-primary">
                        {t(`${key}.title`)}
                      </div>
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

        {microApps.map((microApp) => {
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

                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </SettingsPageLayout>
  );
}
