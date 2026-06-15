"use client";

import { Outlet, useLocation } from "react-router-dom";
import React, { ReactNode, useEffect } from "react";
import Sidebar from "./Sidebar";
import {
  AssistantRuntimeProvider,
  useRemoteThreadListRuntime,
} from "@assistant-ui/react";
import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { useAuth } from "@/app/providers/AuthProvider";
import { ThreadListSidebar } from "./components/ThreadListSidebar";
import Thread from "@/shared/ui/Thread";
import { BackendThreadListAdapter } from "@/app/providers/BackendThreadListAdapter";
import NavItem from "@/shared/ui/NavItem";
import {
  Bolt,
  Info,
  LibraryBig,
  Blend,
  ArrowLeft,
  FlaskConical,
  ListChecks,
} from "lucide-react";
import { getChatApiUrl } from "@/shared/platform/desktopRuntime";
import { useRoleModelConfigs } from "@/app/providers/RoleModelConfigProvider";
import { CurrentThreadProvider } from "@/app/providers/CurrentThreadProvider";
import { KnowledgeBaseAvailabilityProvider, useKnowledgeBaseAvailability } from "@/app/providers/KnowledgeBaseAvailabilityProvider";

const settingNavItems = [
  { label: "通用", path: "/settings/general", icon: <Bolt size={16} /> },
  { label: "模型", path: "/settings/model-setting", icon: <Blend size={16} /> },
  {
    label: "知识库",
    path: "/settings/knowledge-base",
    icon: <LibraryBig size={16} />,
  },
  {
    label: "评测工作台",
    path: "/settings/evaluation/workbench",
    icon: <FlaskConical size={16} />,
  },
  {
    label: "评测中心",
    path: "/settings/evaluation/center",
    icon: <ListChecks size={16} />,
  },
  { label: "关于", path: "/settings/about", icon: <Info size={16} /> },
];

const threadListAdapter = new BackendThreadListAdapter();

function LayoutFrame({
  sidebarContents,
  showBackToChat,
  contents,
  shellClassName,
  contentClassName,
}: {
  sidebarContents: ReactNode;
  showBackToChat: boolean;
  contents: ReactNode;
  shellClassName?: string;
  contentClassName?: string;
}) {
  return (
    <div
      className="w-full min-w-0"
      style={{
        display: "grid",
        gridTemplateColumns: "240px 1fr",
        height: "100dvh",
      }}
    >
      <Sidebar>
        {showBackToChat && (
          <NavItem to="/chat" icon={<ArrowLeft size={16} />}>
            返回聊天
          </NavItem>
        )}

        <>{sidebarContents}</>
      </Sidebar>

      <main
        className={`flex h-screen w-full min-w-0 flex-col overflow-hidden px-0 ${
          shellClassName ??
          "rounded-l-[24px] bg-white"
        }`}
      >
        <section className="flex min-h-0 flex-1">
          <div
            className={`flex min-h-0 min-w-0 flex-1 ${
              contentClassName ?? ""
            }`}
          >
            {contents}
          </div>
        </section>
      </main>
    </div>
  );
}

function ChatRuntimeShell({ showChat }: { showChat: boolean }) {
  const { session } = useAuth();

  const useChatRuntimeHook = () => {
    return useChatRuntime({
      transport: new AssistantChatTransport({
        api: getChatApiUrl(),
        headers: {
          Authorization: `Bearer ${session?.token}`,
        },
      }),
    });
  };

  const runtime = useRemoteThreadListRuntime({
    runtimeHook: useChatRuntimeHook,
    adapter: threadListAdapter,
  });

  return (
    <AssistantRuntimeProvider
      key={session?.token ?? "anonymous"}
      runtime={runtime}
    >
      <KnowledgeBaseAvailabilityProvider>
        <ChatRouteKnowledgeBaseRefresher />
        <CurrentThreadProvider>
          <div className={showChat ? "flex min-h-0 flex-1" : "hidden"}>
            <LayoutFrame
              showBackToChat={false}
              sidebarContents={<ChatSidebar />}
              contents={<Thread />}
              shellClassName="rounded-l-[24px] bg-white"
            />
          </div>
        </CurrentThreadProvider>
      </KnowledgeBaseAvailabilityProvider>
    </AssistantRuntimeProvider>
  );
}

function SettingsLayout() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-[#FAFBF7]">
      <Outlet />
    </div>
  );
}

function SettingsPanel({ showSettings }: { showSettings: boolean }) {
  if (!showSettings) {
    return null;
  }

  return (
    <div className="flex min-h-0 flex-1">
      <LayoutFrame
        showBackToChat
        sidebarContents={<SettingsSidebar />}
        contents={<SettingsLayout />}
        shellClassName="rounded-l-[28px] border border-border/70 bg-[#FAFBF7] shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
        contentClassName="px-3 sm:px-4 lg:px-5 xl:px-6"
      />
    </div>
  );
}

function ChatSidebar() {
  return <ThreadListSidebar />;
}

function SettingsSidebar() {
  return settingNavItems.map((item) => {
    return (
      <NavItem key={item.path} to={item.path} icon={item.icon}>
          {item.label}
      </NavItem>
    );
  });
}

function ChatRouteModelConfigRefresher() {
  const location = useLocation();
  const { refresh } = useRoleModelConfigs();

  useEffect(() => {
    if (!location.pathname.startsWith("/chat")) {
      return;
    }

    void refresh();
  }, [location.pathname, refresh]);

  return null;
}

function ChatRouteKnowledgeBaseRefresher() {
  const location = useLocation();
  const { refresh } = useKnowledgeBaseAvailability();

  useEffect(() => {
    if (!location.pathname.startsWith("/chat")) {
      return;
    }

    void refresh();
  }, [location.pathname, refresh]);

  return null;
}

function BaseLayout() {
  const location = useLocation();
  const isSettingsRoute = location.pathname.startsWith("/settings");

  return (
    <>
      <ChatRouteModelConfigRefresher />
      <ChatRuntimeShell showChat={!isSettingsRoute} />
      <SettingsPanel showSettings={isSettingsRoute} />
    </>
  );
}

export default BaseLayout;
