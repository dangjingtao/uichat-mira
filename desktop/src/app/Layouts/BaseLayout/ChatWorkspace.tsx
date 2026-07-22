"use client";

import UChatThread from "@/features/chat/components/UChatThread";
import { UChatThreadListSidebar } from "@/features/chat/components/UChatThreadListSidebar";
import { ChatKnowledgeBaseStateProvider } from "@/features/chat/core/knowledgeBaseState";
import { ChatRuntimeKnowledgeBaseBinding } from "@/features/chat/core/runtime";
import { WorkspaceShell } from "./layoutShared";
import { ChatRouteKnowledgeBaseRefresher } from "./chatRuntime";

/**
 * Chat workspace owns only the visible chat surface. The application-scoped
 * UChat runtime is mounted above the authenticated workspace routes.
 */
export function ChatWorkspace({ visible }: { visible: boolean }) {
  if (!visible) {
    return null;
  }

  return (
    <ChatKnowledgeBaseStateProvider>
      <ChatRouteKnowledgeBaseRefresher />
      <ChatRuntimeKnowledgeBaseBinding />
      <div className="flex min-h-0 flex-1">
        <WorkspaceShell
          showBackToChatLink={false}
          sidebarContent={<UChatThreadListSidebar />}
          mainContent={<UChatThread />}
          shellClassName="rounded-l-[24px] bg-surface-primary"
        />
      </div>
    </ChatKnowledgeBaseStateProvider>
  );
}
