"use client";

import { useEffect, useRef, useState } from "react";

import { getMessages } from "@/shared/api/thread";
import type { RagSourceLike, ThreadMessageLike } from "@/shared/ui/Thread/thread.types";

type UsePersistedRagSourcesParams = {
  activeThreadId: string | undefined;
  isRunning: boolean;
  ragEnabled: boolean;
  remoteThreadId: string | null;
  threadMessages: readonly ThreadMessageLike[];
};

export function usePersistedRagSources({
  activeThreadId,
  isRunning,
  ragEnabled,
  remoteThreadId,
  threadMessages,
}: UsePersistedRagSourcesParams) {
  const [persistedSourcesByMessageId, setPersistedSourcesByMessageId] =
    useState<Record<string, RagSourceLike[]>>({});
  const latestSyncSignatureRef = useRef<string | null>(null);
  const previousThreadIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (previousThreadIdRef.current !== activeThreadId) {
      previousThreadIdRef.current = activeThreadId;
      setPersistedSourcesByMessageId({});
      latestSyncSignatureRef.current = null;
    }
  }, [activeThreadId]);

  useEffect(() => {
    if (isRunning || !ragEnabled || !remoteThreadId) {
      return;
    }

    if (threadMessages.length === 0) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const persistedMessages = await getMessages(remoteThreadId);
        if (cancelled) {
          return;
        }

        const nextSourcesByMessageId = Object.fromEntries(
          persistedMessages
            .filter((message) => message.role === "assistant")
            .map((message) => {
              const sources =
                (
                  message.metadata?.rag as
                    | { sources?: RagSourceLike[] }
                    | undefined
                )?.sources ?? [];

              return [message.id, sources] as const;
            })
            .filter((entry) => entry[1].length > 0),
        ) as Record<string, RagSourceLike[]>;

        const signature = JSON.stringify(nextSourcesByMessageId);
        if (latestSyncSignatureRef.current === signature) {
          return;
        }

        latestSyncSignatureRef.current = signature;
        setPersistedSourcesByMessageId(nextSourcesByMessageId);
      } catch {
        if (!cancelled) {
          latestSyncSignatureRef.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isRunning, ragEnabled, remoteThreadId, threadMessages]);

  return persistedSourcesByMessageId;
}
