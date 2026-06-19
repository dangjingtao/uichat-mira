import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GitBranch,
  GitCommit,
  Rocket,
  UserRound,
} from "lucide-react";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Streamdown } from "streamdown";
import Card from "@/shared/ui/Card";
import { getAppMeta, type AppMetaData } from "@/shared/api/system";
import { message } from "@/shared/ui/Message";
import { isDesktopShell } from "@/shared/platform/desktopRuntime";
import SettingsPageLayout from "../../components/SettingsPageLayout";
import changelogMarkdown from "../../../../../../docs/CHANGELOG.md?raw";

const getFallbackAppMeta = (t: TFunction): AppMetaData => ({
  name: "ui-chat-rag-tester",
  version: "0.0.0",
  displayName: "uichat",
  author: "Tomz Dang <dangjingtao@gmail.com>",
  description:
    "An initialization project for an Electron desktop application aimed at enterprise knowledge base verification, supporting dual-mode switching between local and remote models and vector databases.",
  repositoryUrl: "",
  homepageUrl: "",
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
      value: "assistant-ui / 内部 UI 组件",
      href: "https://www.assistant-ui.com/",
    },
  ],
});

const CHANGELOG_PREVIEW_SECTIONS = 2;

function getChangelogPreview(markdown: string, sectionCount: number): string {
  const normalized = markdown.trim();
  if (!normalized) {
    return normalized;
  }

  const sectionMatches = Array.from(normalized.matchAll(/^##\s+\[.*$/gm));
  if (sectionMatches.length <= sectionCount) {
    return normalized;
  }

  const cutoffIndex = sectionMatches[sectionCount]?.index;
  if (typeof cutoffIndex !== "number") {
    return normalized;
  }

  return normalized.slice(0, cutoffIndex).trimEnd();
}

function formatCommitDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleString();
  } catch {
    return isoDate;
  }
}

function About() {
  const { t } = useTranslation();
  const [appMeta, setAppMeta] = useState<AppMetaData>(() =>
    getFallbackAppMeta(t),
  );
  const [showFullChangelog, setShowFullChangelog] = useState(false);

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
  const showGitVersions = gitInfo && gitInfo.versions.length > 0;
  const changelogPreview = useMemo(
    () => getChangelogPreview(changelogMarkdown, CHANGELOG_PREVIEW_SECTIONS),
    [],
  );
  const displayedChangelog = showFullChangelog
    ? changelogMarkdown
    : changelogPreview;
  const canExpandChangelog = changelogPreview !== changelogMarkdown.trim();

  return (
    <SettingsPageLayout
      miniTitle={t("settings.about.miniTitle")}
      title={`${appMeta.displayName} ${appMeta.version}`}
      description={appMeta.description}
      contentClassName="space-y-4 pt-6"
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="space-y-3">
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
        </Card>

        <Card className="space-y-3">
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
        </Card>
      </div>

      {gitInfo ? (
        <Card className="space-y-3">
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
                {gitInfo.branch}
              </div>
            </div>

            {showGitVersions ? (
              <div className="space-y-2">
                {gitInfo.versions.map((item) => (
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
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Card className="space-y-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-icon-primary" />
            <h2 className="text-sm font-semibold text-text-primary">
              {t("settings.about.changelogTitle")}
            </h2>
          </div>
          {canExpandChangelog ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary"
              onClick={() => setShowFullChangelog((current) => !current)}
            >
              {showFullChangelog ? (
                <>
                  {t("settings.about.changelogCollapse")}
                  <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  {t("settings.about.changelogExpand")}
                  <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          ) : null}
        </div>

        <div className="mt-3 pt-1">
          <Streamdown
            components={{
              a: ({ href, children, ...props }) => {
                const nextHref = href?.trim() ?? "";
                const isExternal = /^https?:\/\//i.test(nextHref);

                if (!isExternal) {
                  return (
                    <a href={href} {...props}>
                      {children}
                    </a>
                  );
                }

                return (
                  <button
                    type="button"
                    className="inline cursor-pointer text-primary underline decoration-primary/35 underline-offset-4 transition-colors duration-150 hover:text-primary-hover"
                    onClick={() => {
                      void handleExternalLinkClick(nextHref);
                    }}
                  >
                    {children}
                  </button>
                );
              },
            }}
            linkSafety={{ enabled: false }}
            className="prose prose-sm max-w-none break-words text-text-primary prose-headings:mb-3 prose-headings:mt-7 prose-headings:text-text-primary prose-h1:mt-0 prose-h1:text-xl prose-h2:border-b prose-h2:border-border prose-h2:pb-2 prose-h2:text-lg prose-h3:text-base prose-p:leading-6 prose-p:text-text-secondary prose-strong:text-text-primary prose-code:rounded prose-code:bg-surface-secondary prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.92em] prose-code:text-text-primary prose-pre:rounded-xl prose-pre:border prose-pre:border-border/70 prose-pre:bg-surface-secondary/55 prose-pre:text-text-primary prose-li:text-text-secondary prose-li:marker:text-text-tertiary prose-a:text-text-primary prose-blockquote:border-border prose-blockquote:bg-surface-secondary/35 prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:text-text-secondary prose-hr:border-border"
          >
            {displayedChangelog}
          </Streamdown>
        </div>
      </Card>
    </SettingsPageLayout>
  );
}

export default About;
