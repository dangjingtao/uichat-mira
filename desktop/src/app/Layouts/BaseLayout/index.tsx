"use client";

import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
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
import { ArrowLeft, LogOutIcon, SettingsIcon } from "lucide-react";
import { getChatApiUrl } from "@/shared/platform/desktopRuntime";
import { useRoleModelConfigs } from "@/app/providers/RoleModelConfigProvider";
import { CurrentThreadProvider } from "@/features/chat/Providers/CurrentThreadProvider";
import { getCurrentThreadRemoteIdForTransport } from "@/features/chat/Providers/threadRuntimeBridge";
import {
  KnowledgeBaseAvailabilityProvider,
  useKnowledgeBaseAvailability,
} from "@/app/providers/KnowledgeBaseAvailabilityProvider";
import { useSettingsNavigationItems } from "@/app/routes/settingsRoutes";
import { WebpImageAttachmentAdapter } from "@/features/chat/adapters/WebpImageAttachmentAdapter";
import { useRuntimeHealth } from "@/features/system/hooks/useRuntimeHealth";
import Divider from "@/shared/ui/Divider";

const threadListAdapter = new BackendThreadListAdapter();
const imageAttachmentAdapter = new WebpImageAttachmentAdapter();

type TransportMessagePartLike = {
  type?: string;
};

type TransportMessageLike = {
  id?: string;
  role?: "system" | "user" | "assistant";
  parts?: TransportMessagePartLike[];
};

const hasAttachmentParts = (message: TransportMessageLike) =>
  Array.isArray(message.parts) &&
  message.parts.some((part) => part?.type === "image" || part?.type === "file");

const trimHistoricalAttachmentMessages = <
  TMessage extends TransportMessageLike,
>(
  messages: readonly TMessage[],
) => {
  const latestUserIndex = [...messages]
    .map((message, index) => ({ message, index }))
    .reverse()
    .find(({ message }) => message.role === "user")?.index;

  if (latestUserIndex === undefined) {
    return messages;
  }

  return messages.map((message, index) => {
    if (index === latestUserIndex || !hasAttachmentParts(message)) {
      return message;
    }

    return {
      ...message,
      parts: message.parts?.filter(
        (part) => part?.type !== "image" && part?.type !== "file",
      ),
    };
  });
};

const getLatestUserMessageId = (messages: readonly TransportMessageLike[]) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "user" && typeof message.id === "string") {
      return message.id;
    }
  }

  return undefined;
};

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
  sidebarVariant?: "default" | "settings";
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
            className={`flex min-h-0 min-w-0 flex-1 ${contentClassName ?? ""}`}
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
        prepareSendMessagesRequest: async (options) => {
          const messages = trimHistoricalAttachmentMessages(options.messages);
          const threadId = getCurrentThreadRemoteIdForTransport();
          const messageId = getLatestUserMessageId(messages);

          return {
            ...options,
            body: {
              ...(options.body ?? {}),
              ...(threadId ? { id: threadId } : {}),
              ...(messageId ? { messageId } : {}),
              messages,
            },
          };
        },
      }),
      adapters: {
        attachments: imageAttachmentAdapter,
      },
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
        showBackToChatLink={false}
        sidebarContent={<SettingsNavigation />}
        mainContent={<SettingsLayout />}
        shellClassName="rounded-l-[28px] border border-border/70 bg-surface-secondary shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
        contentClassName="px-3 sm:px-4 lg:px-5 xl:px-6"
        sidebarVariant="settings"
      />
    </div>
  );
}

function SettingsNavigation() {
  const { t } = useTranslation();
  const settingsNavigationItems = useSettingsNavigationItems();

  const primaryItems = settingsNavigationItems.filter(
    (item) =>
      item.to === "/settings/general" || item.to === "/settings/model-setting",
  );

  const knowledgeBaseItems = settingsNavigationItems.filter(
    (item) =>
      item.to.startsWith("/settings/evaluation/") ||
      item.to === "/settings/knowledge-base",
  );

  const utilityItems = settingsNavigationItems.filter(
    (item) => item.to === "/settings/tools" || item.to === "/settings/about",
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <NavLink
        to="/chat"
        className="mb-3 inline-flex items-center gap-2 rounded-[10px] px-2 py-2 text-sm text-text-secondary transition-colors duration-150 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
      >
        <ArrowLeft size={15} />
        {t("common.actions.backToChat")}
      </NavLink>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <SettingsNavigationGroup items={primaryItems} />

        <Divider />

        <SettingsNavigationGroup
          title={t("settings.navigation.evaluationSection")}
          items={knowledgeBaseItems}
        />

        <Divider />

        <SettingsNavigationGroup items={utilityItems} />
      </div>
    </div>
  );
}

function SettingsNavigationGroup({
  title,
  items,
}: {
  title?: string;
  items: ReturnType<typeof useSettingsNavigationItems>;
}) {
  return (
    <div className="space-y-1">
      {title ? (
        <div className="px-2 pb-1 text-[12px] font-medium text-text-tertiary">
          {title}
        </div>
      ) : null}
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-[10px] px-3 py-1.5 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated ${
                isActive
                  ? "bg-primary/10 text-text-primary"
                  : "text-text-secondary hover:bg-surface-secondary/70 hover:text-text-primary"
              }`
            }
          >
            <Icon size={16} className="shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        );
      })}
    </div>
  );
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
