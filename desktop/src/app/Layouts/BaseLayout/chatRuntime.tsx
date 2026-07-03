"use client";

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useRoleModelConfigs } from "@/app/providers/RoleModelConfigProvider";
import { useChatKnowledgeBaseState } from "@/features/chat/core/knowledgeBaseState";
import { AppChatRuntimeProvider } from "@/features/chat/core/runtime";

export function ChatRuntimeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppChatRuntimeProvider>{children}</AppChatRuntimeProvider>
  );
}

/**
 * Refresh model config when returning to chat so runtime gating stays in sync
 * with settings changes without remounting the whole assistant runtime.
 */
export function ChatRouteModelConfigRefresher() {
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

/**
 * Refresh knowledge base availability on chat re-entry.
 *
 * Risk note:
 * This provider influences thread creation fallback and RAG availability.
 * Stale state here causes the selected knowledge base and newly-created thread
 * binding to drift apart.
 */
function ChatRouteKnowledgeBaseRefresher() {
  const location = useLocation();
  const { refresh } = useChatKnowledgeBaseState();

  useEffect(() => {
    if (!location.pathname.startsWith("/chat")) {
      return;
    }

    void refresh();
  }, [location.pathname, refresh]);

  return null;
}

export { ChatRouteKnowledgeBaseRefresher };
