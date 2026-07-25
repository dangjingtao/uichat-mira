import {
  ExternalLink,
  GitBranch,
  GitCommit,
  History,
  Mail,
  MessageSquarePlus,
  Scale,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAppMeta, type AppMetaData } from "@/shared/api/system";
import {
  isDesktopShell,
  openExternalUrl,
} from "@/shared/platform/desktopRuntime";
import { message } from "@/shared/ui/Message";
import { Modal } from "@/shared/ui/Modal";
import MarkdownText from "@/shared/ui/MarkdownText";
import Card from "@/shared/ui/Card";
import { appPackageMeta } from "@/shared/appMeta";
import licenseText from "../../../../../../../LICENSE?raw";
import changelogText from "../../../../../../../CHANGELOG.md?raw";

const MAX_VISIBLE_GIT_VERSIONS = 5;
const FEEDBACK_ISSUE_URL =
  "https://github.com/dangjingtao/uichat-mira/issues/new";
const FEEDBACK_EMAIL_URL =
  "mailto:dangjingtao@gmail.com?subject=UIChat%20Mira%20反馈";

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
      label: "官方文档",
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
      const isExternalUrl = /^https?:\/\//i.test(href);
      try {
        if (isExternalUrl) {
          await openExternalUrl(href);
          return;
        }

        await navigator.clipboard.writeText(href);
        message.success(t("settings.about.linkCopied"));
      } catch {
        message.error(
          t(
            isExternalUrl
              ? "settings.about.linkOpenFailed"
              : "settings.about.linkCopyFailed",
          ),
        );
      }
    },
    [t],
  );

  const openLicenseModal = useCallback(() => {
    Modal.show({
      title: `${appPackageMeta.license || "MIT"} License`,
      width: 720,
      maxHeight: 640,
      footer: null,
      content: (
        <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-6 text-text-secondary">
          {licenseText}
        </pre>
      ),
    });
  }, []);

  const openChangelogModal = useCallback(() => {
    Modal.show({
      title: "更新日志",
      width: 760,
      maxHeight: 720,
      footer: null,
      content: (
        <MarkdownText
          features="basic"
          className="[&_h1]:mt-0 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_li]:my-1"
        >
          {changelogText}
        </MarkdownText>
      ),
    });
  }, []);

  const openFeedbackModal = useCallback(() => {
    let modalKey = "";

    const openFeedbackTarget = async (url: string) => {
      try {
        await openExternalUrl(url);
        Modal.close(modalKey);
      } catch {
        message.error(t("settings.about.linkOpenFailed"));
      }
    };

    modalKey = Modal.show({
      title: "应用反馈",
      width: 520,
      footer: null,
      content: (
        <div className="overflow-hidden rounded-ui-panel border border-border/70 bg-surface-secondary/60">
          <button
            type="button"
            onClick={() => void openFeedbackTarget(FEEDBACK_ISSUE_URL)}
            className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface-secondary"
          >
            <MessageSquarePlus className="h-4 w-4 shrink-0 text-icon-secondary" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-text-primary">
                提交 GitHub Issue
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-text-secondary">
                功能建议与可公开的缺陷
              </span>
            </span>
            <ExternalLink className="h-4 w-4 shrink-0 text-icon-secondary" />
          </button>
          <button
            type="button"
            onClick={() => void openFeedbackTarget(FEEDBACK_EMAIL_URL)}
            className="flex w-full items-center gap-3 border-t border-border/70 px-3.5 py-3 text-left transition-colors hover:bg-surface-secondary"
          >
            <Mail className="h-4 w-4 shrink-0 text-icon-secondary" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-text-primary">
                发送邮件
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-text-secondary">
                隐私、日志或其他敏感问题
              </span>
            </span>
            <ExternalLink className="h-4 w-4 shrink-0 text-icon-secondary" />
          </button>
        </div>
      ),
    });
  }, [t]);

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
        <div
          data-testid="git-version-list"
          className="overflow-hidden rounded-ui-panel border border-border/70 bg-surface-secondary/60"
        >
          <div className="px-3.5 py-3">
            <div className="text-xs text-text-tertiary">
              {t("settings.about.currentBranch")}
            </div>
            <div className="text-sm font-medium text-text-primary">
              {gitInfo?.branch}
            </div>
          </div>
          {gitInfo?.versions?.length ? (
            <div>
              {gitInfo.versions.slice(0, MAX_VISIBLE_GIT_VERSIONS).map((item) => (
                <div
                  key={item.version}
                  data-testid={`git-version-${item.version}`}
                  className="border-t border-border/70 px-3.5 py-3"
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
        <div
          data-testid="base-information-links"
          className="overflow-hidden rounded-ui-panel border border-border/70 bg-surface-secondary/60"
        >
          {links.map((item, index) => (
            <button
              key={`${item.label}:${item.value}`}
              type="button"
              onClick={() => {
                if (item.href) {
                  handleExternalLinkClick(item.href);
                }
              }}
              className={`flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors ${
                index > 0 ? "border-t border-border/70" : ""
              } ${
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
          <button
            type="button"
            onClick={openChangelogModal}
            className={`flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface-secondary ${
              links.length > 0 ? "border-t border-border/70" : ""
            }`}
          >
            <div className="min-w-0">
              <div className="text-xs text-text-tertiary">更新日志</div>
              <div className="text-sm font-medium text-text-primary">
                CHANGELOG.md
              </div>
            </div>
            <History className="h-4 w-4 shrink-0 text-icon-secondary" />
          </button>
          <button
            type="button"
            onClick={openLicenseModal}
            className="flex w-full items-center justify-between gap-3 border-t border-border/70 px-3.5 py-3 text-left transition-colors hover:bg-surface-secondary"
          >
            <div className="min-w-0">
              <div className="text-xs text-text-tertiary">许可证</div>
              <div className="text-sm font-medium text-text-primary">
                {appPackageMeta.license || "MIT"} License
              </div>
            </div>
            <Scale className="h-4 w-4 shrink-0 text-icon-secondary" />
          </button>
          <button
            type="button"
            onClick={openFeedbackModal}
            className="flex w-full items-center justify-between gap-3 border-t border-border/70 px-3.5 py-3 text-left transition-colors hover:bg-surface-secondary"
          >
            <div className="min-w-0">
              <div className="text-xs text-text-tertiary">应用反馈</div>
              <div className="text-sm font-medium text-text-primary">
                GitHub Issue 或邮件
              </div>
            </div>
            <MessageSquarePlus className="h-4 w-4 shrink-0 text-icon-secondary" />
          </button>
        </div>
      </Card>
    </div>
  );
}
