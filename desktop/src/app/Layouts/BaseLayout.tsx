"use client";

import { Outlet, useLocation } from "react-router-dom";
import React, { FunctionComponent, ReactNode } from "react";
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

const threadListAdapter = new BackendThreadListAdapter();

function LayoutFrame({
  mode,
  contents,
  children,
}: {
  mode: BaseLayoutProps["mode"];
  contents: ReactNode;
  children?: ReactNode;
}) {
  const location = useLocation();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "240px 1fr",
        height: "100dvh",
      }}
    >
      <Sidebar>
        {mode !== "chat" && (
          <NavItem to="/chat" icon={<ArrowLeft size={16} />}>
            返回聊天
          </NavItem>
        )}

        <>{contents}</>
      </Sidebar>

      <main
        className="mx-auto flex h-screen w-full flex-col overflow-y-auto border border-slate-200 bg-white px-0"
      >
        <section className="flex min-h-0 flex-1 rounded-xl shadow-sm">
          <div
            key={`${mode}:${location.pathname}`}
            className="route-content-transition flex min-h-0 flex-1"
          >
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}

function ChatLayout() {
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
      <LayoutFrame mode="chat" contents={<ThreadListSidebar />}>
        <Thread />
      </LayoutFrame>
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
    <LayoutFrame mode="settings" contents={contents}>
      <Outlet />
    </LayoutFrame>
  );
}

const BaseLayout: FunctionComponent<BaseLayoutProps> = ({ mode }) => {
  return mode === "chat" ? <ChatLayout /> : <SettingsLayout />;
};

export default BaseLayout;
