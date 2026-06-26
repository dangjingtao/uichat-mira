import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GitBranch,
  GitCommit,
  Rocket,
  UserRound,
} from "lucide-react";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Card from "@/shared/ui/Card";
import { getAppMeta, type AppMetaData } from "@/shared/api/system";
import { message } from "@/shared/ui/Message";
import { isDesktopShell } from "@/shared/platform/desktopRuntime";
import { appPackageMeta } from "@/shared/appMeta";

const getFallbackAppMeta = (t: TFunction): AppMetaData => ({
  name: appPackageMeta.name,
  version: "0.0.0",
  displayName: appPackageMeta.displayName,
  author: appPackageMeta.author,
  description: appPackageMeta.description,
  repositoryUrl: appPackageMeta.repositoryUrl,
  homepageUrl: appPackageMeta.homepageUrl,
  changelog: [
    t("settings.about.fallback.changelog.0"),
    t("settings.about.fallback.changelog.1"),
    t("settings.about.fallback.changelog.2"),
  ],
  versionHistory: [
    {
      version: "0.1.0",
      summary: t("settings.about.fallback.versionHistory.0_1_0"),
    },
    {
      version: "0.0.9",
      summary: t("settings.about.fallback.versionHistory.0_0_9"),
    },
    {
      version: "0.0.8",
      summary: t("settings.about.fallback.versionHistory.0_0_8"),
    },
  ],
  links: [
    {
      label: t("settings.about.fallback.links.author"),
      value: "Tomz Dang <dangjingtao@gmail.com>",
      href: "https://github.com/dangjingtao",
    },
    {
      label: t("settings.about.fallback.links.repository"),
      value: "https://github.com/dangjingtao/ui-chat-rag-tester.git",
      href: "https://github.com/dangjingtao/ui-chat-rag-tester",
    },
    {
      label: t("settings.about.fallback.links.homepage"),
      value: "https://github.com/dangjingtao/ui-chat-rag-tester",
      href: "https://github.com/dangjingtao/ui-chat-rag-tester",
    },
    {
      label: t("settings.about.fallback.links.docs"),
      value: "uchat / 项目内部对话框架",
      href: "https://github.com/dangjingtao/ui-chat-rag-tester",
    },
  ],
});

const DEFAULT_GIT_VERSION_PREVIEW_COUNT = 5;

function formatCommitDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleString();
  } catch {
    return isoDate;
  }
}

export default function BaseInformationPanel() {
  const { t } = useTranslation();
  const [appMeta, setAppMeta] = useState<AppMetaData>(() =>
    getFallbackAppMeta(t),
  );
  const [showAllGitVersions, setShowAllGitVersions] = useState(false);

  const handleExternalLinkClick = useCallback(
    async (href: string) => {
      try {
        await navigator.clipboard.writeText(href);
        message.success(t("settings.about.linkCopied"));
      } catch {
        message.error(t("settings.about.linkCopyFailed"));
      }
    },
    [t],
  );

  useEffect(() => {
    if (!isDesktopShell()) {
      setAppMeta(getFallbackAppMeta(t));
      return;
    }

    let cancelled = false;

    void getAppMeta()
      .then((data) => {
        if (!cancelled) {
          setAppMeta(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAppMeta(getFallbackAppMeta(t));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  const gitInfo = appMeta.git;
  const gitVersions = gitInfo?.versions ?? [];
  const visibleGitVersions = showAllGitVersions
    ? gitVersions
    : gitVersions.slice(0, DEFAULT_GIT_VERSION_PREVIEW_COUNT);
  const canExpandGitVersions =
    gitVersions.length > DEFAULT_GIT_VERSION_PREVIEW_COUNT;

  const VersionHistoryContent = (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Rocket className="h-4 w-4 text-icon-primary" />
        <h2 className="text-sm font-semibold text-text-primary">
          {t("settings.about.versionHistory")}
        </h2>
      </div>
      <div className="space-y-2">
        {appMeta.versionHistory.map((item) => (
          <div
            key={item.version}
            className="rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2"
          >
            <div className="text-sm font-semibold text-text-primary">
              {item.version}
            </div>
            <div className="mt-0.5 text-sm leading-6 text-text-secondary">
              {item.summary}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const AuthorDocsContent = (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <UserRound className="h-4 w-4 text-icon-primary" />
        <h2 className="text-sm font-semibold text-text-primary">
          {t("settings.about.authorDocs")}
        </h2>
      </div>
      <div className="space-y-2">
        {appMeta.links.map((item) => (
          <button
            key={`${item.label}:${item.value}`}
            type="button"
            onClick={() => {
              if (item.href) {
                handleExternalLinkClick(item.href);
              }
            }}
            className={`flex w-full items-center justify-between gap-3 rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2 text-left transition-colors ${
              item.href ? "hover:bg-surface-secondary" : ""
            }`}
          >
            <div className="min-w-0">
              <div className="text-xs text-text-tertiary">{item.label}</div>
              <div className="truncate text-sm font-medium text-text-primary">
                {item.value}
              </div>
            </div>
            {item.href ? (
              <ExternalLink className="h-4 w-4 shrink-0 text-icon-secondary" />
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );

  const GitInfoContent = (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-icon-primary" />
        <h2 className="text-sm font-semibold text-text-primary">
          {t("settings.about.gitInfo")}
        </h2>
      </div>

      <div className="space-y-2">
        <div className="rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2">
          <div className="text-xs text-text-tertiary">
            {t("settings.about.currentBranch")}
          </div>
          <div className="text-sm font-medium text-text-primary">
            {gitInfo?.branch}
          </div>
        </div>

        {visibleGitVersions.length > 0 ? (
          <div className="space-y-2">
            {visibleGitVersions.map((item) => (
              <div
                key={item.version}
                className="rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <GitCommit className="h-3.5 w-3.5 text-icon-secondary" />
                  <div className="text-sm font-semibold text-text-primary">
                    {item.version}
                  </div>
                </div>
                <div className="mt-1 text-sm leading-6 text-text-secondary">
                  {item.commit.message}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-text-tertiary">
                  <span>{item.commit.author}</span>
                  <span>·</span>
                  <span>{formatCommitDate(item.commit.date)}</span>
                </div>
              </div>
            ))}
            {canExpandGitVersions ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary"
                onClick={() => setShowAllGitVersions((current) => !current)}
              >
                {showAllGitVersions ? (
                  <>
                    {t("settings.about.gitCollapse")}
                    <ChevronUp className="h-3.5 w-3.5" />
                  </>
                ) : (
                  <>
                    {t("settings.about.gitExpand", {
                      count:
                        gitVersions.length - DEFAULT_GIT_VERSION_PREVIEW_COUNT,
                    })}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="space-y-3">{VersionHistoryContent}</Card>
        <Card className="space-y-3">{AuthorDocsContent}</Card>
      </div>

      {gitInfo ? <Card className="space-y-3">{GitInfoContent}</Card> : null}
    </div>
  );
}
