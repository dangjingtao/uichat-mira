import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, AudioLines, BookOpen, Boxes, BrainCircuit, FileText, Image, Mail, MonitorSmartphone, Newspaper, PlugZap, Settings, StickyNote } from "lucide-react";
import { Link } from "react-router-dom";
import SettingsPageLayout from "../../components/SettingsPageLayout";
import Alert from "@/shared/ui/Alert";
import Card from "@/shared/ui/Card";
import { Skeleton } from "@/shared/ui";
import { message } from "@/shared/ui/Message";
import {
  getIntegrationInstances,
  getIntegrationMicroApps,
  type MicroAppRecord,
} from "@/shared/api/integrations";
import {
  getMicroAppCapabilities,
  type MicroAppCapabilityBinding,
  type MicroAppCapabilityCode,
} from "@/shared/api/microAppCapabilities";
import { openCapabilityBindingModal } from "./CapabilityBindingModal";

const microAppSummaryKey = (microApp: MicroAppRecord) => {
  if (microApp.type === "knowledge_query") {
    return "settings.microApps.summaries.knowledgeQuery";
  }
  return "settings.microApps.summaries.integration";
};

const featuredStudioEntries = [
  {
    key: "jianXing",
    route: "/settings/micro-apps/jian-xing",
    capability: undefined,
  },
  {
    key: "notion",
    route: "/settings/micro-apps/notion",
    capability: undefined,
  },
  {
    key: "officeSuite",
    route: "/settings/micro-apps/office-suite",
    capability: undefined,
    title: "文枢",
    description: "Word、Excel 与 PowerPoint 的本地处理与调试工作台。",
    actionLabel: "打开",
  },
  {
    key: "evolvingKnowledge",
    route: "/settings/micro-apps/evolving-knowledge-studio",
    capability: undefined,
  },
  {
    key: "newsHub",
    route: "/settings/micro-apps/news-hub",
    capability: undefined,
  },
  {
    key: "mailCenter",
    route: "/settings/micro-apps/mail-center",
    capability: undefined,
  },
  {
    key: "computerUse",
    route: "/settings/micro-apps/computer-use-studio",
    capability: undefined,
  },
  {
    key: "imageGeneration",
    route: "/settings/micro-apps/image-generation-studio",
    capability: "imageGeneration",
  },
  {
    key: "ttsStudio",
    route: "/settings/micro-apps/tts-studio",
    capability: "tts",
  },
  {
    key: "codeGraph",
    route: "/settings/micro-apps/codegraph-studio",
    capability: undefined,
  },
] as const;

const featuredStudioIcons = {
  jianXing: PlugZap,
  notion: StickyNote,
  officeSuite: FileText,
  evolvingKnowledge: BrainCircuit,
  newsHub: Newspaper,
  mailCenter: Mail,
  computerUse: MonitorSmartphone,
  imageGeneration: Image,
  ttsStudio: AudioLines,
  codeGraph: Boxes,
} as const;

export default function MicroAppsSettings() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [microApps, setMicroApps] = useState<MicroAppRecord[]>([]);
  const [capabilityBindings, setCapabilityBindings] = useState<MicroAppCapabilityBinding[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [microAppResult, , capabilityResult] = await Promise.all([
        getIntegrationMicroApps({ type: "knowledge_query" }),
        getIntegrationInstances({ provider: "wecom", includeCapabilities: true }),
        getMicroAppCapabilities(),
      ]);

      setMicroApps(microAppResult.microApps);
      setCapabilityBindings(capabilityResult);
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
            <Card className="border-border bg-primary/5 p-5">
              <div className="space-y-4">
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
          const capability = entry.capability as MicroAppCapabilityCode | undefined;
          const binding = capability
            ? capabilityBindings.find((item) => item.capabilityCode === capability) ?? null
            : null;
          const capabilityName = capability
            ? t(`settings.microApps.capabilityBinding.capabilityNames.${capability}`)
            : "";
          const entryTitle = "title" in entry ? entry.title : t(`${key}.title`);
          const entryDescription =
            "description" in entry ? entry.description : t(`${key}.description`);
          const actionLabel =
            "actionLabel" in entry ? entry.actionLabel : t(`${key}.actions.open`);

          return (
            <Card key={entry.route} className="border-border bg-primary/5 p-5">
              <div className="flex h-full flex-col gap-4 lg:justify-between">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        data-testid={`studio-entry-icon-${entry.key}`}
                        className="flex h-9 w-9 items-center justify-center text-icon-secondary"
                      >
                        <EntryIcon className="h-4.5 w-4.5" />
                      </span>
                      <div className="text-base font-semibold text-text-primary">
                        {entryTitle}
                      </div>
                    </div>
                    <div className="text-sm leading-6 text-text-secondary">
                      {entryDescription}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to={entry.route}
                    className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-ui-control border border-primary/20 bg-transparent px-4 text-sm font-medium text-primary transition-all duration-150 ease-out hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary"
                  >
                    {actionLabel}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  {capability ? (
                    <button
                      type="button"
                      aria-label={t("settings.microApps.capabilityBinding.configureAriaLabel", {
                        capability: capabilityName,
                      })}
                      title={t("settings.microApps.capabilityBinding.configureAriaLabel", {
                        capability: capabilityName,
                      })}
                      data-testid={`studio-entry-settings-${entry.key}`}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-ui-control border border-primary/20 bg-transparent text-primary transition-all duration-150 ease-out hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary"
                      onClick={() =>
                        openCapabilityBindingModal({
                          capability,
                          title: t("settings.microApps.capabilityBinding.title", {
                            capability: capabilityName,
                          }),
                          currentBinding: binding,
                          onSaved: (nextBinding) => {
                            setCapabilityBindings((current) => [
                              ...current.filter(
                                (item) => item.capabilityCode !== capability,
                              ),
                              nextBinding,
                            ]);
                          },
                        })
                      }
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
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
              <Card interactive className="h-full border-border bg-primary/5 p-5">
                <div className="flex h-full flex-col gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center text-icon-secondary">
                          <BookOpen className="h-4.5 w-4.5" />
                        </span>
                        <div>
                          <div className="text-base font-semibold text-text-primary">{microApp.name}</div>
                        </div>
                      </div>
                      <div>
                        <div className="text-sm leading-6 text-text-secondary">
                          {t(microAppSummaryKey(microApp))}
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
