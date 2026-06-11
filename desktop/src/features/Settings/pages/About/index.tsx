import {
  BookOpen,
  ExternalLink,
  Rocket,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import Card from "@/shared/ui/Card";
import { getAppMeta, type AppMetaData } from "@/shared/api/system";
import { isDesktopShell } from "@/shared/platform/desktopRuntime";
import Header from "../../components/Header";

const fallbackAppMeta: AppMetaData = {
  name: "ui-chat-rag-tester",
  version: "0.0.0",
};

const versionHistory = [
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
] as const;

const changelog = [
  "关于页改为软件信息与维护记录布局，减少冗余说明",
  "明确区分 Electron / Tauri 运行版本",
  "保留版本历史、作者与文档入口",
] as const;

const infoLinks = [
  {
    label: "作者",
    value: "Tomz Dang",
    href: "https://github.com/dangjingtao",
  },
  {
    label: "组件文档",
    value: "assistant-ui / 内部 UI 组件",
    href: "https://www.assistant-ui.com/",
  },
  {
    label: "项目文档",
    value: "README / docs/README / docs/assistant-ui.md",
    href: "https://github.com/dangjingtao/ui-chat-rag-tester/tree/main/docs",
  },
] as const;

function formatAppName(name: string) {
  return name
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

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
    <div className="mx-auto flex w-full flex-col gap-4 px-4 pb-6">
      <Header
        miniTitle="About"
        title={`${formatAppName(appMeta.name)} ${appMeta.version}`}
        description="这是一个用于 RAG 场景联调与验证的桌面应用，重点覆盖桌面聊天、模型角色配置、知识库管理和本地运行时健康检查。"
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="space-y-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-icon-primary" />
            <h2 className="text-sm font-semibold text-text-primary">
              Changelog
            </h2>
          </div>
          <div className="space-y-2">
            {changelog.map((item) => (
              <div
                key={item}
                className="rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2 text-sm leading-6 text-text-secondary"
              >
                {item}
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-icon-primary" />
            <h2 className="text-sm font-semibold text-text-primary">
              版本历史
            </h2>
          </div>
          <div className="space-y-2">
            {versionHistory.map((item) => (
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
            {infoLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2 transition-colors hover:bg-surface-secondary"
              >
                <div className="min-w-0">
                  <div className="text-xs text-text-tertiary">{item.label}</div>
                  <div className="truncate text-sm font-medium text-text-primary">
                    {item.value}
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 shrink-0 text-icon-secondary" />
              </a>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default About;
