import { ExternalLink, GitBranch, GitCommit } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAppMeta, type AppMetaData } from "@/shared/api/system";
import { isDesktopShell } from "@/shared/platform/desktopRuntime";
import { message } from "@/shared/ui/Message";
import Card from "@/shared/ui/Card";
import { appPackageMeta } from "@/shared/appMeta";

const getFallbackAppMeta = (): AppMetaData => ({
  name: appPackageMeta.name,
  version: "0.0.0",
  displayName: appPackageMeta.displayName,
  author: appPackageMeta.author,
  description: appPackageMeta.description,
  repositoryUrl: appPackageMeta.repositoryUrl,
  homepageUrl: appPackageMeta.homepageUrl,
  links: [
    {
      label: "作者",
      value: "Tomz Dang <dangjingtao@gmail.com>",
      href: "https://github.com/dangjingtao",
    },
    {
      label: "项目仓库",
      value: appPackageMeta.repositoryUrl,
      href: appPackageMeta.repositoryUrl,
    },
    {
      label: "项目主页",
      value: appPackageMeta.homepageUrl,
      href: appPackageMeta.homepageUrl,
    },
    {
      label: "组件文档",
      value: "uchat / 内部 UI 组件",
      href: "./docs/uchat.md",
    },
  ],
});

function formatCommitDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleString();
  } catch {
    return isoDate;
  }
}

export default function BaseInformationPanel() {
  const { t } = useTranslation();
  const [appMeta, setAppMeta] = useState<AppMetaData>(() => getFallbackAppMeta());

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
      setAppMeta(getFallbackAppMeta());
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
          setAppMeta(getFallbackAppMeta());
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const links = appMeta.links ?? [];
  const gitInfo = appMeta.git;

  return (
    <div className="space-y-4">
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
              {gitInfo?.branch}
            </div>
          </div>
          {gitInfo?.versions?.length ? (
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

      <Card className="space-y-3">
        <div className="space-y-2">
          {links.map((item) => (
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
  );
}
