import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Newspaper,
  RefreshCcw,
  Search,
  ExternalLink as ExternalLinkIcon,
  SlidersHorizontal,
} from "lucide-react";
import SettingsPageLayout from "../../../components/SettingsPageLayout";
import Card from "@/shared/ui/Card";
import Badge from "@/shared/ui/Badge";
import {
  Button,
  ExternalLink,
  FullPageStatus,
  Modal,
  NumberInput,
  Select,
  Switch,
  TextInput,
  message,
} from "@/shared/ui";
import {
  getNewsHubConfig,
  getNewsHubOverview,
  refreshNewsHub,
  saveNewsHubConfig,
  type NewsHubConfig,
  type NewsHubItem,
  type NewsHubOverview,
} from "@/shared/api/newsHub";

const formatDateTime = (value: string | null, locale: string) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const trimPreview = (item: NewsHubItem) =>
  item.summary || item.contentText || item.title;

const defaultConfig: NewsHubConfig = {
  newsDataEnabled: false,
  newsDataApiKey: "",
  currentsEnabled: false,
  currentsApiKey: "",
  redditEnabled: false,
  redditClientId: "",
  redditClientSecret: "",
  redditUserAgent: "UIChat-Mira-NewsHub/0.1",
  redditSubreddits: "technology+programming+artificial",
  refreshTtlMinutes: 60,
};

const hasText = (value: string) => value.trim().length > 0;

const providerLinks = {
  newsData: {
    docs: "https://newsdata.io/documentation",
    signup: "https://newsdata.io/register",
  },
  currents: {
    docs: "https://currentsapi.services/en/docs/",
    signup: "https://currentsapi.services/en/register",
  },
  reddit: {
    access: "https://support.reddithelp.com/hc/en-us/articles/14945211791892-Developer-Platform-Accessing-Reddit-Data",
    wiki: "https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki",
    createApp: "https://www.reddit.com/prefs/apps",
  },
} as const;

export default function NewsHubPage() {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [overview, setOverview] = useState<NewsHubOverview | null>(null);
  const [config, setConfig] = useState<NewsHubConfig>(defaultConfig);
  const [draftConfig, setDraftConfig] = useState<NewsHubConfig>(defaultConfig);
  const [sourceKey, setSourceKey] = useState("");
  const [query, setQuery] = useState("");
  const [draftQuery, setDraftQuery] = useState("");

  const loadOverview = async (next?: { sourceKey?: string; query?: string }) => {
    const result = await getNewsHubOverview({
      limit: 80,
      sourceKey: next?.sourceKey ?? sourceKey ?? undefined,
      query: next?.query ?? query ?? undefined,
    });
    setOverview(result);
  };

  const loadPage = async () => {
    setLoading(true);
    try {
      const [overviewResult, configResult] = await Promise.all([
        getNewsHubOverview({ limit: 80 }),
        getNewsHubConfig(),
      ]);
      setOverview(overviewResult);
      setConfig(configResult);
      setDraftConfig(configResult);
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : t("settings.microApps.newsHub.messages.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPage();
  }, []);

  useEffect(() => {
    if (!overview) {
      return;
    }

    void loadOverview({
      sourceKey,
      query,
    }).catch((error) => {
      message.error(
        error instanceof Error
          ? error.message
          : t("settings.microApps.newsHub.messages.loadFailed"),
      );
    });
  }, [sourceKey]);

  const sourceOptions = useMemo(
    () => [
      {
        value: "",
        label: t("settings.microApps.newsHub.filters.allSources"),
      },
      ...((overview?.sources ?? []).map((source) => ({
        value: source.key,
        label: `${source.name} (${source.itemCount})`,
      })) ?? []),
    ],
    [overview?.sources, t],
  );

  useEffect(() => {
    if (!sourceKey) {
      return;
    }

    const stillExists = sourceOptions.some((option) => option.value === sourceKey);
    if (!stillExists) {
      setSourceKey("");
    }
  }, [sourceKey, sourceOptions]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const result = await refreshNewsHub();
      const failedSources = result.sources.filter((source) => source.status === "failed");
      if (failedSources.length > 0) {
        message.error(
          failedSources
            .map((source) => `${source.name}: ${source.error || "Unknown error"}`)
            .join(" | "),
        );
      } else {
        message.success(
          t("settings.microApps.newsHub.messages.refreshed", {
            fetchedCount: result.fetchedCount,
            insertedCount: result.insertedCount,
            updatedCount: result.updatedCount,
            skippedCount: result.skippedCount,
            ttlMinutes: result.ttlMinutes,
          }),
        );
      }
      await loadOverview();
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : t("settings.microApps.newsHub.messages.refreshFailed"),
      );
    } finally {
      setRefreshing(false);
    }
  };

  const handleApplyFilters = async () => {
    const nextQuery = draftQuery.trim();
    setQuery(nextQuery);

    try {
      await loadOverview({
        sourceKey,
        query: nextQuery,
      });
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : t("settings.microApps.newsHub.messages.loadFailed"),
      );
    }
  };

  const openConfigModal = () => {
    setDraftConfig(config);
    setConfigOpen(true);
  };

  const updateDraftConfig = <K extends keyof NewsHubConfig>(
    key: K,
    value: NewsHubConfig[K],
  ) => {
    setDraftConfig((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const normalizedConfig: NewsHubConfig = {
        ...draftConfig,
        newsDataEnabled:
          draftConfig.newsDataEnabled || hasText(draftConfig.newsDataApiKey),
        currentsEnabled:
          draftConfig.currentsEnabled || hasText(draftConfig.currentsApiKey),
        redditEnabled:
          draftConfig.redditEnabled ||
          (hasText(draftConfig.redditClientId) &&
            hasText(draftConfig.redditClientSecret) &&
            hasText(draftConfig.redditUserAgent)),
        refreshTtlMinutes: 60,
      };
      const saved = await saveNewsHubConfig(normalizedConfig);
      setConfig(saved);
      setDraftConfig(saved);
      setConfigOpen(false);
      message.success(t("settings.microApps.newsHub.messages.configSaved"));
      await loadOverview({
        sourceKey,
        query,
      });
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : t("settings.microApps.newsHub.messages.configSaveFailed"),
      );
    } finally {
      setSavingConfig(false);
    }
  };

  if (loading && !overview) {
    return (
      <SettingsPageLayout
        miniTitle={t("settings.microApps.newsHub.page.miniTitle")}
        title={t("settings.microApps.newsHub.page.title")}
        description={t("settings.microApps.newsHub.page.description")}
        contentClassName="h-full pt-6"
        scrollBody={false}
      >
        <FullPageStatus message={t("settings.microApps.newsHub.states.loading")} />
      </SettingsPageLayout>
    );
  }

  return (
    <>
      <SettingsPageLayout
        miniTitle={t("settings.microApps.newsHub.page.miniTitle")}
        title={t("settings.microApps.newsHub.page.title")}
        description={t("settings.microApps.newsHub.page.description")}
        slot={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
            >
              <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {t("settings.microApps.newsHub.actions.refresh")}
            </Button>
          </div>
        }
        contentClassName="flex h-full min-h-0 flex-col gap-6 pt-6"
        scrollBody={false}
      >
        <Card className="min-h-0 flex-1 overflow-hidden p-5">
          <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_auto]">
                <div className="grid gap-2">
                  <label className="h-5 text-xs font-medium text-text-secondary">
                    {t("settings.microApps.newsHub.filters.source")}
                  </label>
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                    <Select
                      value={sourceKey}
                      onChange={(value) => {
                        setSourceKey(value);
                      }}
                      options={sourceOptions}
                    />
                    <Button
                      variant="outline"
                      onClick={openConfigModal}
                      className="whitespace-nowrap"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      {t("settings.microApps.newsHub.actions.configureSources")}
                    </Button>
                  </div>
                </div>
                <TextInput
                  label={t("settings.microApps.newsHub.filters.query")}
                  value={draftQuery}
                  onChange={setDraftQuery}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void handleApplyFilters();
                    }
                  }}
                  placeholder={t("settings.microApps.newsHub.filters.queryPlaceholder")}
                />
                <div className="flex items-end">
                  <Button className="w-full" onClick={() => void handleApplyFilters()}>
                    <Search className="h-4 w-4" />
                    {t("settings.microApps.newsHub.actions.applyFilters")}
                  </Button>
                </div>
              </div>
            </div>

            <div className="my-5 shrink-0 border-t border-border" />

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex shrink-0 items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Newspaper className="h-4 w-4 text-primary" />
                  <div className="text-sm font-semibold text-text-primary">
                    {t("settings.microApps.newsHub.sections.items")}
                  </div>
                </div>
                <Badge variant="muted" size="sm">
                  {t("settings.microApps.newsHub.labels.total", {
                    count: overview?.total ?? 0,
                  })}
                </Badge>
              </div>

              {(overview?.items ?? []).length === 0 ? (
                <div className="mt-4 rounded-ui-panel border border-border bg-surface-secondary/30 px-4 py-5 text-sm text-text-secondary">
                  {t("settings.microApps.newsHub.states.emptyDescription")}
                </div>
              ) : (
                <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
                  {(overview?.items ?? []).map((item, index) => (
                    <div key={item.id}>
                      <div className="px-4 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="primary" size="sm">
                                {item.sourceName}
                              </Badge>
                              <Badge variant="muted" size="sm">
                                {item.topic}
                              </Badge>
                              <Badge variant="muted" size="sm">
                                {item.lang.toUpperCase()}
                              </Badge>
                            </div>
                            <div className="text-base font-semibold leading-6 text-text-primary">
                              {item.title}
                            </div>
                            <div className="text-sm leading-6 text-text-secondary">
                              {trimPreview(item)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.tags.slice(0, 4).map((tag) => (
                            <Badge key={tag} variant="muted" size="sm">
                              {tag}
                            </Badge>
                          ))}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-text-tertiary">
                          <div className="flex flex-wrap items-center gap-3">
                            <span>
                              {t("settings.microApps.newsHub.labels.author")}{" "}
                              {item.author || t("settings.microApps.newsHub.labels.unknownAuthor")}
                            </span>
                            <span>
                              {t("settings.microApps.newsHub.labels.publishedAt")}{" "}
                              {formatDateTime(item.publishedAt, i18n.language)}
                            </span>
                          </div>
                          <ExternalLink href={item.url}>
                            <span className="inline-flex items-center gap-1">
                              {t("settings.microApps.newsHub.actions.openArticle")}
                              <ExternalLinkIcon className="h-3.5 w-3.5" />
                            </span>
                          </ExternalLink>
                        </div>
                      </div>

                      {index < (overview?.items ?? []).length - 1 ? (
                        <div className="border-t border-border" />
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      </SettingsPageLayout>

      <Modal
        open={configOpen}
        title={t("settings.microApps.newsHub.config.title")}
        width={760}
        maxHeight="calc(100vh - 4rem)"
        onClose={() => {
          if (!savingConfig) {
            setConfigOpen(false);
          }
        }}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setConfigOpen(false)}
              disabled={savingConfig}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button onClick={() => void handleSaveConfig()} disabled={savingConfig}>
              {savingConfig
                ? t("settings.microApps.newsHub.actions.savingConfig")
                : t("settings.microApps.newsHub.actions.saveConfig")}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="rounded-ui-panel border border-border bg-surface-secondary/40 px-4 py-3 text-sm text-text-secondary">
            {t("settings.microApps.newsHub.config.description")}
          </div>

          <div className="grid gap-4 rounded-ui-panel border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-text-primary">NewsData.io</div>
                <div className="text-xs text-text-secondary">
                  {t("settings.microApps.newsHub.config.newsDataHint")}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
                  <span>{t("settings.microApps.newsHub.config.guideLabel")}</span>
                  <ExternalLink href={providerLinks.newsData.signup}>
                    {t("settings.microApps.newsHub.config.createApp")}
                  </ExternalLink>
                  <ExternalLink href={providerLinks.newsData.docs}>
                    {t("settings.microApps.newsHub.config.docs")}
                  </ExternalLink>
                </div>
              </div>
              <Switch
                checked={draftConfig.newsDataEnabled}
                onChange={() =>
                  updateDraftConfig("newsDataEnabled", !draftConfig.newsDataEnabled)
                }
                ariaLabel="toggle newsdata"
              />
            </div>
            <TextInput
              label={t("settings.microApps.newsHub.config.newsDataApiKey")}
              type="password"
              value={draftConfig.newsDataApiKey}
              onChange={(value) => updateDraftConfig("newsDataApiKey", value)}
              placeholder="newsdata api key"
            />
          </div>

          <div className="grid gap-4 rounded-ui-panel border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-text-primary">Currents API</div>
                <div className="text-xs text-text-secondary">
                  {t("settings.microApps.newsHub.config.currentsHint")}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
                  <span>{t("settings.microApps.newsHub.config.guideLabel")}</span>
                  <ExternalLink href={providerLinks.currents.signup}>
                    {t("settings.microApps.newsHub.config.createApp")}
                  </ExternalLink>
                  <ExternalLink href={providerLinks.currents.docs}>
                    {t("settings.microApps.newsHub.config.docs")}
                  </ExternalLink>
                </div>
              </div>
              <Switch
                checked={draftConfig.currentsEnabled}
                onChange={() =>
                  updateDraftConfig("currentsEnabled", !draftConfig.currentsEnabled)
                }
                ariaLabel="toggle currents"
              />
            </div>
            <TextInput
              label={t("settings.microApps.newsHub.config.currentsApiKey")}
              type="password"
              value={draftConfig.currentsApiKey}
              onChange={(value) => updateDraftConfig("currentsApiKey", value)}
              placeholder="currents api key"
            />
          </div>

          <div className="grid gap-4 rounded-ui-panel border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-text-primary">Reddit API</div>
                <div className="text-xs text-text-secondary">
                  {t("settings.microApps.newsHub.config.redditHint")}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
                  <span>{t("settings.microApps.newsHub.config.guideLabel")}</span>
                  <ExternalLink href={providerLinks.reddit.access}>
                    {t("settings.microApps.newsHub.config.requestAccess")}
                  </ExternalLink>
                  <ExternalLink href={providerLinks.reddit.createApp}>
                    {t("settings.microApps.newsHub.config.createApp")}
                  </ExternalLink>
                  <ExternalLink href={providerLinks.reddit.wiki}>
                    {t("settings.microApps.newsHub.config.docs")}
                  </ExternalLink>
                </div>
              </div>
              <Switch
                checked={draftConfig.redditEnabled}
                onChange={() =>
                  updateDraftConfig("redditEnabled", !draftConfig.redditEnabled)
                }
                ariaLabel="toggle reddit"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                label={t("settings.microApps.newsHub.config.redditClientId")}
                value={draftConfig.redditClientId}
                onChange={(value) => updateDraftConfig("redditClientId", value)}
                placeholder="reddit client id"
              />
              <TextInput
                label={t("settings.microApps.newsHub.config.redditClientSecret")}
                type="password"
                value={draftConfig.redditClientSecret}
                onChange={(value) => updateDraftConfig("redditClientSecret", value)}
                placeholder="reddit client secret"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                label={t("settings.microApps.newsHub.config.redditUserAgent")}
                value={draftConfig.redditUserAgent}
                onChange={(value) => updateDraftConfig("redditUserAgent", value)}
                placeholder="UIChat-Mira-NewsHub/0.1"
              />
              <TextInput
                label={t("settings.microApps.newsHub.config.redditSubreddits")}
                value={draftConfig.redditSubreddits}
                onChange={(value) => updateDraftConfig("redditSubreddits", value)}
                placeholder="technology+programming+artificial"
              />
            </div>
          </div>

          <NumberInput
            label={t("settings.microApps.newsHub.config.refreshTtlMinutes")}
            value={60}
            onChange={() => {}}
            disabled
            labelHelp={t("settings.microApps.newsHub.config.refreshTtlHelp")}
          />
        </div>
      </Modal>
    </>
  );
}
