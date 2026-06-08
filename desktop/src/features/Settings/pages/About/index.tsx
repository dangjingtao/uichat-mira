import {
  Code2,
  ExternalLink,
  GitBranch,
  Info,
  Layers3,
  UserRound,
} from "lucide-react";
import Card from "@/shared/ui/Card";

const techStack = [
  { label: "Vite", value: "Build tool" },
  { label: "React + TypeScript", value: "Frontend" },
  { label: "Tailwind CSS", value: "Design tokens & styling" },
  { label: "assistant-ui", value: "Chat experience" },
  { label: "Ollama / Custom API", value: "LLM backend" },
  { label: "React Router", value: "Routing" },
];

const links = [
  {
    icon: GitBranch,
    label: "GitHub Repository",
    href: "https://github.com/dangjingtao/ui-chat-rag-tester",
  },
  {
    icon: UserRound,
    label: "Contributors",
    href: "https://github.com/dangjingtao",
  },
];

function About() {
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <section className="rounded-xl border border-border bg-surface-primary px-5 py-5 shadow-shadow-sm sm:px-6 sm:py-6">
        <div className="space-y-3">
          <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            About this project
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold leading-tight text-text-primary">
              UI Chat RAG Tester
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-text-secondary">
              一个面向企业知识库验证场景的 Electron 桌面应用初始化项目，支持本地与远程模型、向量数据库和聊天测试工作流。
            </p>
          </div>
        </div>
      </section>

      <Card>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-secondary">
              <Info className="h-4 w-4 text-icon-primary" />
            </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
              Overview
            </div>
            <div className="text-base font-semibold text-text-primary">
              项目概览
            </div>
            <p className="text-sm leading-6 text-text-secondary">
              当前项目聚焦在桌面端 AI/RAG 验证体验：连接模型、检查运行时健康、验证数据库连通性，并通过统一聊天入口完成对话链路测试。
            </p>
          </div>
        </div>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-primary shadow-shadow-sm border border-border">
            <Layers3 className="h-4 w-4 text-icon-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              Tech Stack
            </h2>
            <p className="text-sm text-text-secondary">
              构成当前桌面端体验的核心技术组件。
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {techStack.map((item) => (
            <Card key={item.label}>
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-secondary">
                  <Code2 className="h-4 w-4 text-icon-primary" />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="text-sm font-medium text-text-primary">
                    {item.label}
                  </div>
                  <div className="text-sm text-text-secondary">
                    {item.value}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Links</h2>
          <p className="text-sm text-text-secondary">
            项目仓库与作者相关链接。
          </p>
        </div>

        <div className="space-y-2.5">
          {links.map((item) => {
            const Icon = item.icon;

            return (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl border border-border bg-surface-primary px-4 py-3.5 shadow-shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-surface-secondary hover:shadow-shadow-md"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-secondary">
                      <Icon className="h-4 w-4 text-icon-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-text-primary">
                        {item.label}
                      </div>
                      <div className="truncate text-sm text-text-secondary">
                        {item.href}
                      </div>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 flex-shrink-0 text-icon-secondary" />
                </div>
              </a>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default About;
