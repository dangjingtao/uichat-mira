"use client";

import UChatThread from "@/features/chat/components/UChatThread";
import { UChatThreadListSidebar } from "@/features/chat/components/UChatThreadListSidebar";
import { ChatKnowledgeBaseStateProvider } from "@/features/chat/core/knowledgeBaseState";
import { WorkspaceShell } from "./layoutShared";
import {
  ChatRouteKnowledgeBaseRefresher,
  ChatRuntimeProvider,
} from "./chatRuntime";

/**
 * Chat workspace owns the uchat runtime and keeps it mounted while the
 * settings workspace is shown/hidden.
 */
export function ChatWorkspace({ visible }: { visible: boolean }) {
  return (
    <ChatKnowledgeBaseStateProvider>
      <ChatRouteKnowledgeBaseRefresher />
      <ChatRuntimeProvider>
        <div className={visible ? "flex min-h-0 flex-1" : "hidden"}>
          <WorkspaceShell
            showBackToChatLink={false}
            sidebarContent={<UChatThreadListSidebar />}
            mainContent={<UChatThread />}
            shellClassName="rounded-l-[24px] bg-surface-primary"
          />
        </div>
      </ChatRuntimeProvider>
    </ChatKnowledgeBaseStateProvider>
  );
}
