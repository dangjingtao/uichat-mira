import { useMemo, useState } from "react";
import type { RagProgressDetail } from "./RagProgressDetailDrawer";
import type { RagSourceDetail } from "./RagSourceDetailDrawer";
import {
  getRagProgressFromContentParts,
  getRagProgressRow,
} from "./thread.parsers";
import type {
  SelectedRagProgressKey,
  ThreadMessageLike,
} from "./thread.types";
import { usePersistedRagSources } from "./usePersistedRagSources";

type UseThreadRagRuntimeInput = {
  activeThreadId: string | undefined;
  isRunning: boolean;
  ragEnabled: boolean;
  remoteThreadId: string | null;
  threadMessages: readonly ThreadMessageLike[];
};

export function useThreadRagRuntime({
  activeThreadId,
  isRunning,
  ragEnabled,
  remoteThreadId,
  threadMessages,
}: UseThreadRagRuntimeInput) {
  const [selectedRagProgressKey, setSelectedRagProgressKey] =
    useState<SelectedRagProgressKey | null>(null);
  const [selectedRagSourceDetail, setSelectedRagSourceDetail] =
    useState<RagSourceDetail | null>(null);

  const persistedSourcesByMessageId = usePersistedRagSources({
    activeThreadId,
    isRunning,
    ragEnabled,
    remoteThreadId,
    threadMessages,
  });

  const messagesById = useMemo(
    () =>
      Object.fromEntries(
        threadMessages
          .filter((message) => typeof message.id === "string")
          .map((message) => [message.id as string, message]),
      ) as Record<string, ThreadMessageLike>,
    [threadMessages],
  );

  const selectedRagProgressDetail = useMemo<RagProgressDetail | null>(() => {
    if (!selectedRagProgressKey) {
      return null;
    }

    const message = messagesById[selectedRagProgressKey.messageId];
    const step = getRagProgressFromContentParts(message?.content).find(
      (item) => item.nodeId === selectedRagProgressKey.nodeId,
    );

    if (!step) {
      return null;
    }

    const row = getRagProgressRow(step);
    if (!row.clickable) {
      return null;
    }

    return {
      messageId: selectedRagProgressKey.messageId,
      nodeId: row.nodeId,
      nodeType: row.nodeType,
      label: row.label,
      status: row.phase,
      summary: row.summary,
      details: row.details,
      environment: row.environment,
    };
  }, [messagesById, selectedRagProgressKey]);

  return {
    persistedSourcesByMessageId,
    messagesById,
    hasSideDrawerOpen:
      selectedRagProgressDetail !== null || selectedRagSourceDetail !== null,
    selectedRagProgressDetail,
    selectedRagSourceDetail,
    openRagProgressDetail: (detail: RagProgressDetail) => {
      setSelectedRagSourceDetail(null);
      setSelectedRagProgressKey({
        messageId: detail.messageId,
        nodeId: detail.nodeId,
      });
    },
    openRagSourceDetail: (detail: RagSourceDetail) => {
      setSelectedRagProgressKey(null);
      setSelectedRagSourceDetail(detail);
    },
    closeRagProgressDetail: () => {
      setSelectedRagProgressKey(null);
    },
    closeRagSourceDetail: () => {
      setSelectedRagSourceDetail(null);
    },
  };
}
