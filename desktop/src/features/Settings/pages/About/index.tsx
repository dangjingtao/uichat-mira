// src/pages/About.tsx
import { Info, Code, ExternalLink, GitBranch, Users } from "lucide-react";

function About() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      {/* 标题 */}
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
          About this project
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          A lightweight LLM chat interface built with modern web tech.
        </p>
      </div>

      {/* 项目简介 */}
      <Card
        icon={<Info className="w-5 h-5" />}
        title="Overview"
        description="An initialization project for an Electron desktop application aimed at enterprise knowledge base verification, supporting dual-mode switching between local and remote models and vector databases."
      />

      {/* 技术栈 */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Tech Stack
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TechCard label="Vite" value="Build tool" />
          <TechCard label="React + TS" value="Frontend" />
          <TechCard label="Tailwind CSS" value="Styling" />
          <TechCard label="assistant-ui" value="Chat components" />
          <TechCard label="Ollama / Custom API" value="LLM backend" />
          <TechCard label="React Router" value="Routing" />
        </div>
      </section>

      {/* 链接 */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Links
        </h2>
        <div className="space-y-2">
          <LinkRow
            icon={<GitBranch className="w-4 h-4" />}
            label="GitHub Repository"
            href="https://github.com/dangjingtao/ui-chat-rag-tester"
          />
          <LinkRow
            icon={<Users className="w-4 h-4" />}
            label="Contributors"
            href="https://github.com/dangjingtao"
          />
        </div>
      </section>
    </div>
  );
}

/* ===== 子组件 ===== */

function Card({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      className="
        flex gap-4
        rounded-2xl
        bg-gray-50 dark:bg-white/5
        border border-gray-200 dark:border-white/10
        p-5
      "
    >
      <div className="mt-0.5 text-gray-500 dark:text-gray-400">{icon}</div>
      <div className="space-y-1">
        <div className="text-sm font-medium text-gray-900 dark:text-white">
          {title}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

function TechCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="
        rounded-xl
        bg-gray-50 dark:bg-white/5
        border border-gray-200 dark:border-white/10
        px-4 py-3
      "
    >
      <div className="text-sm font-medium text-gray-900 dark:text-white">
        {label}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{value}</div>
    </div>
  );
}

function LinkRow({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="
        flex items-center justify-between
        rounded-xl
        bg-gray-50 dark:bg-white/5
        border border-gray-200 dark:border-white/10
        px-4 py-3
        text-sm
        text-gray-700 dark:text-gray-300
        hover:bg-gray-100 dark:hover:bg-white/10
        transition
      "
    >
      <div className="flex items-center gap-3">
        {icon}
        {label}
      </div>
      <ExternalLink className="w-4 h-4 opacity-60" />
    </a>
  );
}
interface AboutProps {}

export default About;
