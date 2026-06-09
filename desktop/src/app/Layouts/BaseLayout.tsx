"use client";

import { Outlet, Link } from "react-router-dom";
import React, { FunctionComponent, ReactNode } from "react";
import Sidebar from "./Sidebar";

import { useMemo } from "react";
import { Thread, type SuggestionConfig } from "@assistant-ui/react-ui";
import type { AssistantRuntime } from "@assistant-ui/react";
import {
  AssistantRuntimeImpl,
  LocalRuntimeCore,
} from "@assistant-ui/core/internal";
import { useAuth } from "@/app/providers/AuthProvider";
import { useRuntimeHealth } from "@/features/system/hooks/useRuntimeHealth";
import { localChatModel } from "./lib/localChatModel";
import { AssistantRuntimeProvider } from "@assistant-ui/react";

import { ChatProvider } from "@/app/providers/ChatProvider";
import { ThreadListSidebar } from "./components/ThreadListSidebar";

import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";

const getChatApiUrl = () => {
  if (window.location.protocol === "file:") {
    return `${window.desktopApi?.backendUrl ?? ""}/proxy/chat/default`;
  }

  return "/api/proxy/chat/default";
};

const defaultSuggestions: SuggestionConfig[] = [
  { prompt: "帮我总结今天的任务重点" },
  { prompt: "给我一个 RAG 系统排障清单" },
  { prompt: "设计一个接口联调计划" },
];

import NavItem from "@/shared/ui/NavItem";
import {
  CircleUser,
  Bolt,
  Info,
  LibraryBig,
  Blend,
  ArrowLeft,
} from "lucide-react";

interface BaseLayoutProps {
  children?: ReactNode;
  mode: "chat" | "settings";
}

const settingNavItems = [
  { label: "通用", path: "/settings/general", icon: <Bolt size={16} /> },
  {
    label: "账号",
    path: "/settings/account",
    icon: <CircleUser size={16} />,
  },
  { label: "模型", path: "/settings/model-setting", icon: <Blend size={16} /> },
  {
    label: "知识库",
    path: "/settings/knowledge-base",
    icon: <LibraryBig size={16} />,
  },
  { label: "关于", path: "/settings/about", icon: <Info size={16} /> },
];

const BaseLayout: FunctionComponent<BaseLayoutProps> = ({ mode, children }) => {
  const contents =
    mode === "chat" ? (
      <ThreadListSidebar />
    ) : (
      settingNavItems.map((item) => {
        return (
          <NavItem key={item.path} to={item.path} icon={item.icon}>
            {item.label}
          </NavItem>
        );
      })
    );

  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: getChatApiUrl(),
    }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "240px 1fr",
          height: "100dvh",
        }}
      >
        {/* 侧边栏 */}
        <Sidebar>
          {mode !== "chat" && (
            <NavItem to="/chat" icon={<ArrowLeft size={16} />}>
              返回聊天
            </NavItem>
          )}

          <>{contents}</>
        </Sidebar>

        {/* 主区域：子路由渲染到这里 */}
        <main
          className={`mx-auto flex h-screen w-full flex-col border border-slate-200 bg-white px-0 ${
            mode === "settings" ? "overflow-hidden" : "overflow-y-auto"
          }`}
        >
          <section className="flex min-h-0 flex-1 rounded-xl shadow-sm">
            <div
              style={{ display: mode === "chat" ? "block" : "none" }}
              className="w-full"
            >
              <Thread
                welcome={{
                  message: "你好，我是 UI Chat RAG 助手。请输入你的问题。",
                  suggestions: defaultSuggestions,
                }}
                strings={{
                  composer: {
                    input: {
                      placeholder: "输入问题，回车发送...",
                    },
                  },
                }}
              />
            </div>
            {mode === "settings" && <Outlet />}
          </section>
        </main>
      </div>
    </AssistantRuntimeProvider>
  );
};

export default BaseLayout;
