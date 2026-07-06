import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Globe,
  Newspaper,
  RefreshCcw,
  Rss,
  Search,
  Sparkles,
  ExternalLink as ExternalLinkIcon,
} from "lucide-react";
import SettingsPageLayout from "../../../components/SettingsPageLayout";
import Card from "@/shared/ui/Card";
import Badge from "@/shared/ui/Badge";
import Alert from "@/shared/ui/Alert";
import {
  Button,
  ExternalLink,
  FullPageStatus,
  Select,
  TextInput,
  message,
} from "@/shared/ui";
import {
  getNewsHubOverview,
  refreshNewsHub,
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

export default function NewsHubPage() {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState<NewsHubOverview | null>(null);
  const [sourceKey, setSourceKey] = useState("");
  const [query, setQuery] = useState("");
  const [draftQuery, setDraftQuery] = useState("");

  const load = async (next?: { sourceKey?: string; query?: string }) => {
    setLoading(true);
    try {
      const result = await getNewsHubOverview({
        limit: 80,
        sourceKey: next?.sourceKey ?? sourceKey || undefined,
        query: next?.query ?? query || undefined,
      });
      setOverview(result);
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
    void load();
  }, []);

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

  const topMetrics = useMemo(() => {
    const itemCount = overview?.items.length ?? 0;
    const sourceCount = overview?.sources.length ?? 0;
    const updatedAt = overview?.generatedAt ?? null;

    return [
      {
        key: "items",
        label: t("settings.microApps.newsHub.metrics.items"),
        value: String(itemCount),
        description: t("settings.microApps.newsHub.metrics.itemsHint"),
      },
      {
        key: "sources",
        label: t("settings.microApps.newsHub.metrics.sources"),
        value: String(sourceCount),
        description: t("settings.microApps.newsHub.metrics.sourcesHint"),
      },
      {
        key: "updatedAt",
        label: t("settings.microApps.newsHub.metrics.lastGenerated"),
        value: formatDateTime(updatedAt, i18n.language),
        description: t("settings.microApps.newsHub.metrics.lastGeneratedHint"),
      },
    ];
  }, [i18n.language, overview?.generatedAt, overview?.items.length, overview?.sources.length, t]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const result = await refreshNewsHub();
      message.success(
        t("settings.microApps.newsHub.messages.refreshed", {
          fetchedCount: result.fetchedCount,
          insertedCount: result.insertedCount,
          updatedCount: result.updatedCount,
        }),
      );
      await load();
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
    setQuery(draftQuery.trim());
    await load({
      sourceKey,
      query: draftQuery.trim(),
    });
  };

  if (loading && !overview) {
    return (
      <SettingsPageLayout
        miniTitle={t("settings.microApps.newsHub.page.miniTitle")}
        title={t("settings.microApps.newsHub.page.title")}
        description={t("settings.microApps.newsHub.page.description")}
        contentClassName="pt-6"
      >
        <FullPageStatus message={t("settings.microApps.newsHub.states.loading")} />
      </SettingsPageLayout>
    );
  }

  return (
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
      contentClassName="space-y-6 pt-6"
    >
      <Alert variant="info" title={t("settings.microApps.newsHub.banner.title")}>
        {t("settings.microApps.newsHub.banner.description")}
      </Alert>

      <div className="grid gap-4 md:grid-cols-3">
        {topMetrics.map((metric) => (
          <Card
            key={metric.key}
            label={metric.label}
            value={metric.value}
            description={metric.description}
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)]">
        <Card className="space-y-4 border-primary/15 bg-primary/5 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-ui-control bg-primary text-white">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <div className="text-base font-semibold text-text-primary">
                {t("settings.microApps.newsHub.cards.runtime.title")}
              </div>
              <div className="text-sm leading-6 text-text-secondary">
                {t("settings.microApps.newsHub.cards.runtime.description")}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="primary" size="sm">
              {t("settings.microApps.newsHub.badges.noKey")}
            </Badge>
            <Badge variant="muted" size="sm">
              {t("settings.microApps.newsHub.badges.localTable")}
            </Badge>
            <Badge variant="muted" size="sm">
              {t("settings.microApps.newsHub.badges.manualRefresh")}
            </Badge>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <div className="grid gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_auto]">
            <Select
              label={t("settings.microApps.newsHub.filters.source")}
              value={sourceKey}
              onChange={(value) => setSourceKey(value)}
              options={sourceOptions}
            />
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
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
        <Card className="space-y-3 p-5">
          <div className="flex items-center gap-2">
            <Rss className="h-4 w-4 text-primary" />
            <div className="text-sm font-semibold text-text-primary">
              {t("settings.microApps.newsHub.sections.sources")}
            </div>
          </div>
          <div className="space-y-3">
            {(overview?.sources ?? []).map((source) => (
              <div
                key={source.key}
                className="rounded-ui-panel border border-border bg-surface-secondary/30 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-text-primary">
                      {source.name}
                    </div>
                    <div className="text-xs text-text-secondary">
                      {source.topic} · {source.sourceType}
                    </div>
                  </div>
                  <Badge variant="muted" size="sm">
                    {source.itemCount}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {source.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="primary" size="sm">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-text-tertiary">
                  <span>
                    {t("settings.microApps.newsHub.labels.lastPublished")}{" "}
                    {formatDateTime(source.lastPublishedAt, i18n.language)}
                  </span>
                  <ExternalLink href={source.siteUrl}>
                    <span className="inline-flex items-center gap-1">
                      {t("settings.microApps.newsHub.actions.openSource")}
                      <ExternalLinkIcon className="h-3.5 w-3.5" />
                    </span>
                  </ExternalLink>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
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
            <Alert
              variant="info"
              title={t("settings.microApps.newsHub.states.emptyTitle")}
            >
              {t("settings.microApps.newsHub.states.emptyDescription")}
            </Alert>
          ) : null}

          <div className="space-y-3">
            {(overview?.items ?? []).map((item) => (
              <div
                key={item.id}
                className="rounded-ui-panel border border-border bg-surface-primary p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
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
                  <span className="flex h-10 w-10 items-center justify-center rounded-ui-control bg-surface-secondary text-icon-secondary">
                    <Globe className="h-4.5 w-4.5" />
                  </span>
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
            ))}
          </div>
        </Card>
      </div>
    </SettingsPageLayout>
  );
}
