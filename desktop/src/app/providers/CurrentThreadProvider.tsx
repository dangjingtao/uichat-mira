import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAui, useAuiState } from "@assistant-ui/react";
import {
  getThreadById,
  updateThread,
  type ThreadWithMessages,
} from "@/shared/api/thread";
import { useKnowledgeBaseAvailability } from "@/app/providers/KnowledgeBaseAvailabilityProvider";

const DEFAULT_THREAD_TITLE = "新对话";
const TITLE_SYNC_POLL_INTERVAL_MS = 600;
const TITLE_SYNC_POLL_ATTEMPTS = 6;

type CurrentThreadContextValue = {
  thread: ThreadWithMessages | null;
  remoteId: string | null;
  title: string;
  displayTitle: string;
  ragEnabled: boolean;
  loading: boolean;
  ensureRemoteId: () => Promise<string | null>;
  refresh: () => Promise<ThreadWithMessages | null>;
  updateRagEnabled: (nextValue: boolean) => Promise<ThreadWithMessages | null>;
  toggleRagEnabled: () => Promise<ThreadWithMessages | null>;
};

const CurrentThreadContext = createContext<CurrentThreadContextValue | null>(
  null,
);

export function CurrentThreadProvider({
  children,
}: {
  children: ReactNode;
}) {
  const aui = useAui();
  const { hasEnabledDocuments } = useKnowledgeBaseAvailability();
  const activeThreadRemoteId = useAuiState((s) => s.threadListItem.remoteId);
  const activeThreadListTitle = useAuiState((s) => s.threadListItem.title);
  const isThreadRunning = useAuiState((s) => s.thread.isRunning);
  const threadMessageCount = useAuiState((s) => s.thread.messages.length);
  const [thread, setThread] = useState<ThreadWithMessages | null>(null);
  const [loading, setLoading] = useState(false);
  const persistedTitle = thread?.title?.trim() ?? "";
  const runtimeTitle = activeThreadListTitle?.trim() ?? "";
  const previousRunningRef = useRef(false);
  const titleSyncAbortRef = useRef(0);

  const shouldWaitForGeneratedTitle = useCallback(
    (title: string) => {
      return !title || title === DEFAULT_THREAD_TITLE;
    },
    [],
  );

  const ensureRemoteId = useCallback(async () => {
    if (activeThreadRemoteId) {
      return activeThreadRemoteId;
    }

    const initialized = await aui.threadListItem().initialize();
    return initialized.remoteId ?? null;
  }, [activeThreadRemoteId, aui]);

  const refresh = useCallback(async () => {
    if (!activeThreadRemoteId) {
      setThread(null);
      return null;
    }

    setLoading(true);

    try {
      const nextThread = await getThreadById(activeThreadRemoteId);
      setThread(nextThread);
      return nextThread;
    } finally {
      setLoading(false);
    }
  }, [activeThreadRemoteId]);

  const refreshThreadState = useCallback(async () => {
    const nextThread = await refresh();

    if (!nextThread) {
      return null;
    }

    const nextTitle = nextThread.title?.trim() ?? "";

    if (
      !shouldWaitForGeneratedTitle(nextTitle) &&
      nextTitle !== runtimeTitle
    ) {
      await aui.threadListItem().rename(nextTitle);
    }

    return nextThread;
  }, [aui, refresh, runtimeTitle, shouldWaitForGeneratedTitle]);

  useEffect(() => {
    if (!activeThreadRemoteId) {
      setThread(null);
      return;
    }

    void refresh();
  }, [activeThreadRemoteId, refresh]);

  useEffect(() => {
    if (!activeThreadRemoteId || !runtimeTitle || !persistedTitle) {
      return;
    }

    if (runtimeTitle === persistedTitle) {
      return;
    }

    void refreshThreadState();
  }, [
    activeThreadRemoteId,
    persistedTitle,
    refreshThreadState,
    runtimeTitle,
  ]);

  useEffect(() => {
    const wasRunning = previousRunningRef.current;
    previousRunningRef.current = isThreadRunning;

    if (
      !activeThreadRemoteId ||
      isThreadRunning ||
      !wasRunning ||
      threadMessageCount === 0
    ) {
      return;
    }

    void refreshThreadState();
  }, [
    activeThreadRemoteId,
    isThreadRunning,
    refreshThreadState,
    threadMessageCount,
  ]);

  useEffect(() => {
    if (
      !activeThreadRemoteId ||
      isThreadRunning ||
      threadMessageCount === 0 ||
      !shouldWaitForGeneratedTitle(persistedTitle)
    ) {
      return;
    }

    const abortToken = Date.now();
    titleSyncAbortRef.current = abortToken;

    void (async () => {
      for (let attempt = 0; attempt < TITLE_SYNC_POLL_ATTEMPTS; attempt += 1) {
        await new Promise((resolve) =>
          window.setTimeout(resolve, TITLE_SYNC_POLL_INTERVAL_MS),
        );

        if (titleSyncAbortRef.current !== abortToken) {
          return;
        }

        const nextThread = await refreshThreadState();
        const nextTitle = nextThread?.title?.trim() ?? "";

        if (!shouldWaitForGeneratedTitle(nextTitle)) {
          return;
        }
      }
    })();

    return () => {
      if (titleSyncAbortRef.current === abortToken) {
        titleSyncAbortRef.current = 0;
      }
    };
  }, [
    activeThreadRemoteId,
    isThreadRunning,
    persistedTitle,
    refreshThreadState,
    shouldWaitForGeneratedTitle,
    threadMessageCount,
  ]);

  const updateRagEnabled = useCallback(
    async (nextValue: boolean) => {
      if (nextValue && !hasEnabledDocuments) {
        return null;
      }

      const remoteId = activeThreadRemoteId || (await ensureRemoteId());

      if (!remoteId) {
        return null;
      }

      setLoading(true);

      try {
        await updateThread(remoteId, {
          ragEnabled: nextValue,
        });
        const nextThread = await getThreadById(remoteId);
        setThread(nextThread);
        return nextThread;
      } finally {
        setLoading(false);
      }
    },
    [activeThreadRemoteId, ensureRemoteId, hasEnabledDocuments],
  );

  const toggleRagEnabled = useCallback(async () => {
    return updateRagEnabled(!thread?.ragEnabled);
  }, [thread?.ragEnabled, updateRagEnabled]);

  const value = useMemo<CurrentThreadContextValue>(
    () => ({
      thread,
      remoteId: activeThreadRemoteId ?? null,
      title: persistedTitle,
      displayTitle: persistedTitle || runtimeTitle || "",
      ragEnabled: thread?.ragEnabled ?? false,
      loading,
      ensureRemoteId,
      refresh,
      toggleRagEnabled,
      updateRagEnabled,
    }),
    [
      ensureRemoteId,
      activeThreadListTitle,
      activeThreadRemoteId,
      loading,
      persistedTitle,
      refresh,
      runtimeTitle,
      toggleRagEnabled,
      thread,
      updateRagEnabled,
    ],
  );

  return (
    <CurrentThreadContext.Provider value={value}>
      {children}
    </CurrentThreadContext.Provider>
  );
}

export function useCurrentThread() {
  const context = useContext(CurrentThreadContext);

  if (!context) {
    throw new Error(
      "useCurrentThread must be used within CurrentThreadProvider",
    );
  }

  return context;
}
