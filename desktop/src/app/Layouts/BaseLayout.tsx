"use client";

import { Outlet, useLocation } from "react-router-dom";
import React, { ReactNode } from "react";
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
  CircleUser,
  Bolt,
  Info,
  LibraryBig,
  Blend,
  ArrowLeft,
} from "lucide-react";
import {
  getChatApiUrl,
} from "@/shared/platform/desktopRuntime";

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

const threadListAdapter = new BackendThreadListAdapter();

function LayoutFrame({
  sidebarContents,
  showBackToChat,
  contents,
}: {
  sidebarContents: ReactNode;
  showBackToChat: boolean;
  contents: ReactNode;
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
        className="flex h-screen w-full min-w-0 flex-col overflow-hidden border-l border-slate-200 bg-white px-0"
      >
        <section className="flex min-h-0 flex-1 shadow-sm">
          <div className="flex min-h-0 min-w-0 flex-1">{contents}</div>
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
      <div className={showChat ? "flex min-h-0 flex-1" : "hidden"}>
        <LayoutFrame
          showBackToChat={false}
          sidebarContents={<ChatSidebar />}
          contents={<Thread />}
        />
      </div>
    </AssistantRuntimeProvider>
  );
}

function SettingsLayout() {
  const contents = settingNavItems.map((item) => {
    return (
      <NavItem key={item.path} to={item.path} icon={item.icon}>
        {item.label}
      </NavItem>
    );
  });

  return (
    <>
      <div className="stable-scrollbar flex min-h-0 min-w-0 flex-1 overflow-y-scroll overflow-x-hidden">
        <Outlet />
      </div>
    </>
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

function BaseLayout() {
  const location = useLocation();
  const isSettingsRoute = location.pathname.startsWith("/settings");

  return (
    <>
      <ChatRuntimeShell showChat={!isSettingsRoute} />
      <SettingsPanel showSettings={isSettingsRoute} />
    </>
  );
}

export default BaseLayout;
