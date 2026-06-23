"use client";

import { useMemo } from "react";
import {
  useChatRuntime,
  useChatRuntimeSelector,
  useChatThreadDraftState,
} from "@/features/chat/core/runtime";
import { UChatSidebarView } from "@/shared/uchat/ui";

// UChatThreadListSidebar is now a thin container that binds app runtime state
// to the shared uchat sidebar view.
export function UChatThreadListSidebar() {
  const runtime = useChatRuntime();
  const { resetDraft } = useChatThreadDraftState();
  const threads = useChatRuntimeSelector((state) => state.threads);
  const activeThreadId = useChatRuntimeSelector((state) => state.activeThreadId);
  const threadListStatus = useChatRuntimeSelector((state) => state.threadListStatus);
  const capabilities = useChatRuntimeSelector((state) => state.capabilities);

  // We keep the list sorted in the view so the latest updated thread always
  // floats to the top even if the repository returns a stale ordering.
  const sortedThreads = useMemo(
    () =>
      [...threads].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      ),
    [threads],
  );

  // Creating a new conversation now enters a pure client-side welcome state.
  // We do not create or persist a thread until the first user send happens.
  const handleCreateThread = () => {
    resetDraft();
    runtime.enterWelcomeState();
    runtime.store.getState().resetComposer();
  };

  // Thread selection hydrates the full history on first open.
  const handleSelectThread = async (threadId: string) => {
    resetDraft();
    await runtime.selectThread(threadId);
  };

  // Archive is optional at the repository boundary, so the action only runs
  // when the current app adapter exposes it.
  const handleArchiveThread = async (threadId: string) => {
    if (!capabilities.archiveThread) {
      return;
    }

    const wasActive = runtime.getState().activeThreadId === threadId;
    await runtime.archiveThread(threadId);

    if (wasActive) {
      runtime.store.getState().setActiveThreadId(null);
    }
  };

  // Delete reloads the list and moves selection to the next available thread.
  const handleDeleteThread = async (threadId: string) => {
    if (!capabilities.deleteThread) {
      return;
    }

    const wasActive = runtime.getState().activeThreadId === threadId;
    await runtime.deleteThread(threadId);

    if (wasActive) {
      runtime.store.getState().setActiveThreadId(null);
    }
  };

  return (
    <UChatSidebarView
      threads={sortedThreads}
      activeThreadId={activeThreadId}
      threadListStatus={threadListStatus}
      capabilities={capabilities}
      onCreateThread={handleCreateThread}
      onSelectThread={handleSelectThread}
      onArchiveThread={handleArchiveThread}
      onDeleteThread={handleDeleteThread}
    />
  );
}
