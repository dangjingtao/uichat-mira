"use client";

import { Outlet, useLocation } from "react-router-dom";
import React, { ReactNode, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Sidebar from "../Sidebar";
import {
  AssistantRuntimeProvider,
  useRemoteThreadListRuntime,
} from "@assistant-ui/react";
import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { useAuth } from "@/app/providers/AuthProvider";
import { ThreadListSidebar } from "@/features/chat/components/ThreadListSidebar";
import Thread from "@/features/chat/components/Thread";
import { BackendThreadListAdapter } from "@/features/chat/adapters/BackendThreadListAdapter";
import NavItem from "@/shared/ui/NavItem";
import { ArrowLeft } from "lucide-react";
import { getChatApiUrl } from "@/shared/platform/desktopRuntime";
import { useRoleModelConfigs } from "@/app/providers/RoleModelConfigProvider";
import { CurrentThreadProvider } from "@/features/chat/Providers/CurrentThreadProvider";
import {
  KnowledgeBaseAvailabilityProvider,
  useKnowledgeBaseAvailability,
} from "@/app/providers/KnowledgeBaseAvailabilityProvider";
import { useSettingsNavigationItems } from "@/app/routes/settingsRoutes";

const threadListAdapter = new BackendThreadListAdapter();

function SidebarLayoutFrame({
  sidebarContent,
  showBackToChatLink,
  mainContent,
  shellClassName,
  contentClassName,
}: {
  sidebarContent: ReactNode;
  showBackToChatLink: boolean;
  mainContent: ReactNode;
  shellClassName?: string;
  contentClassName?: string;
}) {
  const { t } = useTranslation();

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
        {showBackToChatLink && (
          <NavItem to="/chat" icon={<ArrowLeft size={16} />}>
            {t("common.actions.backToChat")}
          </NavItem>
        )}

        <>{sidebarContent}</>
      </Sidebar>

      <main
        className={`flex h-screen w-full min-w-0 flex-col overflow-hidden px-0 ${
          shellClassName ?? "rounded-l-[24px] bg-surface-primary"
        }`}
      >
        <section className="flex min-h-0 flex-1">
          <div
            className={`flex min-h-0 min-w-0 flex-1 ${
              contentClassName ?? ""
            }`}
          >
            {mainContent}
          </div>
        </section>
      </main>
    </div>
  );
}

function ChatWorkspacePane({ showChatPane }: { showChatPane: boolean }) {
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
          <div className={showChatPane ? "flex min-h-0 flex-1" : "hidden"}>
            <SidebarLayoutFrame
              showBackToChatLink={false}
              sidebarContent={<ThreadListSidebar />}
              mainContent={<Thread />}
              shellClassName="rounded-l-[24px] bg-surface-primary"
            />
          </div>
        </CurrentThreadProvider>
      </KnowledgeBaseAvailabilityProvider>
    </AssistantRuntimeProvider>
  );
}

function SettingsLayout() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-surface-secondary">
      <Outlet />
    </div>
  );
}

function SettingsWorkspacePane({
  showSettingsPane,
}: {
  showSettingsPane: boolean;
}) {
  if (!showSettingsPane) {
    return null;
  }

  return (
    <div className="flex min-h-0 flex-1">
      <SidebarLayoutFrame
        showBackToChatLink
        sidebarContent={<SettingsNavigation />}
        mainContent={<SettingsLayout />}
        shellClassName="rounded-l-[28px] border border-border/70 bg-surface-secondary shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
        contentClassName="px-3 sm:px-4 lg:px-5 xl:px-6"
      />
    </div>
  );
}

function SettingsNavigation() {
  const settingsNavigationItems = useSettingsNavigationItems();

  return settingsNavigationItems.map((item) => {
    const Icon = item.icon;

    return (
      <NavItem key={item.to} to={item.to} icon={<Icon size={16} />}>
        {item.label}
      </NavItem>
    );
  });
}

// 聊天页恢复可见时，同步最新角色模型配置，避免设置页修改后继续使用旧配置。
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

// 聊天页恢复可见时，刷新知识库可用性，保证侧边栏和线程状态能拿到最新后端结果。
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

// BaseLayout 同时挂载聊天运行时和设置页容器，通过路由控制可见性以保留聊天线程状态。
function BaseLayout() {
  const location = useLocation();
  const isSettingsRoute = location.pathname.startsWith("/settings");

  return (
    <>
      <ChatRouteModelConfigRefresher />
      <ChatWorkspacePane showChatPane={!isSettingsRoute} />
      <SettingsWorkspacePane showSettingsPane={isSettingsRoute} />
    </>
  );
}

export default BaseLayout;
