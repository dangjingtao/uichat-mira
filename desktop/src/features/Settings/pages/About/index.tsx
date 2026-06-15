import {
  BookOpen,
  ExternalLink,
  Rocket,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Streamdown } from "streamdown";
import Card from "@/shared/ui/Card";
import { getAppMeta, type AppMetaData } from "@/shared/api/system";
import { isDesktopShell } from "@/shared/platform/desktopRuntime";
import SettingsPageLayout from "../../components/SettingsPageLayout";
import changelogMarkdown from "../../../../../../docs/CHANGELOG.md?raw";

const fallbackAppMeta: AppMetaData = {
  name: "ui-chat-rag-tester",
  version: "0.0.0",
  displayName: "Ui Chat Rag Tester",
  author: "Tomz Dang <dangjingtao@gmail.com>",
  description:
    "An initialization project for an Electron desktop application aimed at enterprise knowledge base verification, supporting dual-mode switching between local and remote models and vector databases.",
  repositoryUrl: "",
  homepageUrl: "",
  changelog: [
    "关于页改为软件信息与维护记录布局，减少冗余说明",
    "明确区分 Electron / Tauri 运行版本",
    "保留版本历史、作者与文档入口",
  ],
  versionHistory: [
    {
      version: "0.1.0",
      summary: "桌面聊天、模型配置、知识库与健康检查主流程成型",
    },
    {
      version: "0.0.9",
      summary: "补齐设置页结构，统一桌面运行时接入方式",
    },
    {
      version: "0.0.8",
      summary: "初版 RAG 测试工作台与对话线程能力",
    },
  ],
  links: [
    {
      label: "作者",
      value: "Tomz Dang <dangjingtao@gmail.com>",
      href: "https://github.com/dangjingtao",
    },
    {
      label: "项目仓库",
      value: "https://github.com/dangjingtao/ui-chat-rag-tester.git",
      href: "https://github.com/dangjingtao/ui-chat-rag-tester",
    },
    {
      label: "项目主页",
      value: "https://github.com/dangjingtao/ui-chat-rag-tester",
      href: "https://github.com/dangjingtao/ui-chat-rag-tester",
    },
    {
      label: "组件文档",
      value: "assistant-ui / 内部 UI 组件",
      href: "https://www.assistant-ui.com/",
    },
  ],
};

function About() {
  const [appMeta, setAppMeta] = useState<AppMetaData>(fallbackAppMeta);

  useEffect(() => {
    if (!isDesktopShell()) {
      setAppMeta(fallbackAppMeta);
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
          setAppMeta(fallbackAppMeta);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SettingsPageLayout
      miniTitle="About"
      title={`${appMeta.displayName} ${appMeta.version}`}
      description={appMeta.description}
      contentClassName="space-y-4 pt-6"
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="space-y-3">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-icon-primary" />
            <h2 className="text-sm font-semibold text-text-primary">
              版本历史
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
              作者与文档
            </h2>
          </div>
          <div className="space-y-2">
            {appMeta.links.map((item) => (
              <a
                key={`${item.label}:${item.value}`}
                href={item.href || undefined}
                target={item.href ? "_blank" : undefined}
                rel={item.href ? "noopener noreferrer" : undefined}
                className={`flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2 transition-colors ${
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
              </a>
            ))}
          </div>
        </Card>
      </div>

      <Card className="space-y-0">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-icon-primary" />
          <h2 className="text-sm font-semibold text-text-primary">Changelog</h2>
        </div>

        <div className="mt-3 pt-1">
          <Streamdown
            className="prose prose-sm max-w-none break-words text-text-primary prose-headings:mb-3 prose-headings:mt-7 prose-headings:text-text-primary prose-h1:mt-0 prose-h1:text-xl prose-h2:border-b prose-h2:border-border prose-h2:pb-2 prose-h2:text-lg prose-h3:text-base prose-p:leading-6 prose-p:text-text-secondary prose-strong:text-text-primary prose-code:rounded prose-code:bg-surface-secondary prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.92em] prose-code:text-text-primary prose-pre:rounded-xl prose-pre:border prose-pre:border-border/70 prose-pre:bg-surface-secondary/55 prose-pre:text-text-primary prose-li:text-text-secondary prose-li:marker:text-text-tertiary prose-a:text-text-primary prose-blockquote:border-border prose-blockquote:bg-surface-secondary/35 prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:text-text-secondary prose-hr:border-border"
          >
            {changelogMarkdown}
          </Streamdown>
        </div>
      </Card>
    </SettingsPageLayout>
  );
}

export default About;
