"use client";

import { MoreHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ChatThreadSummary } from "../core";

// UChatSidebarView is the pure presentational sidebar for thread creation,
// selection, archiving, and deletion.
export function UChatSidebarView({
  threads,
  activeThreadId,
  threadListStatus,
  capabilities,
  onCreateThread,
  onSelectThread,
  onArchiveThread,
  onDeleteThread,
}: {
  threads: ChatThreadSummary[];
  activeThreadId: string | null;
  threadListStatus: "idle" | "loading" | "ready" | "error";
  capabilities: {
    archiveThread?: boolean;
    deleteThread?: boolean;
  };
  onCreateThread: () => void | Promise<void>;
  onSelectThread: (threadId: string) => void | Promise<void>;
  onArchiveThread: (threadId: string) => void | Promise<void>;
  onDeleteThread: (threadId: string) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [openMenuThreadId, setOpenMenuThreadId] = useState<string | null>(null);

  // The list is sorted in the view so the latest updated thread always floats
  // to the top even if the repository returns a stale ordering.
  const sortedThreads = useMemo(
    () =>
      [...threads].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      ),
    [threads],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
      <div className="shrink-0 px-2 pb-2 pr-4 pt-0">
        <button
          type="button"
          onClick={() => {
            void onCreateThread();
          }}
          className="flex h-8 w-full cursor-pointer items-center justify-start rounded-[10px] bg-transparent px-3 text-sm font-medium text-text-primary transition-all duration-150 hover:bg-[rgb(var(--color-primary)/0.045)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary"
        >
          {t("chat.sidebar.newConversation")}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-2 py-3">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="h-0 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
            {threadListStatus === "loading" && sortedThreads.length === 0 ? (
              <div className="px-4 py-3 text-sm text-text-secondary">
                {t("common.status.loading")}
              </div>
            ) : null}

            {sortedThreads.map((thread) => {
              const isActive = thread.id === activeThreadId;
              const isMenuOpen = openMenuThreadId === thread.id;

              return (
                <div
                  key={thread.id}
                  className={`group relative mb-0.5 flex items-center px-0.5 py-0 text-text-secondary transition-all duration-150 hover:bg-[rgb(var(--color-primary)/0.04)] hover:text-text-primary ${
                    isActive ? "" : ""
                  }`}
                >
                  <span
                    className={`pointer-events-none absolute inset-y-1 left-0 w-[2px] rounded-full bg-primary/85 transition-opacity duration-150 ${
                      isActive ? "opacity-100" : "opacity-0"
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenuThreadId(null);
                      void onSelectThread(thread.id);
                    }}
                    className="flex min-w-0 flex-1 px-4 py-2 text-left focus-visible:outline-none"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm leading-5">
                        {thread.title || t("chat.sidebar.untitledConversation")}
                      </span>
                    </span>
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenuThreadId((current) =>
                          current === thread.id ? null : thread.id,
                        )
                      }
                      className={`mr-0.5 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center text-text-tertiary transition-all duration-150 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
                        isMenuOpen || isActive
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      <MoreHorizontal className="size-4" />
                    </button>

                    {isMenuOpen &&
                    (capabilities.archiveThread ||
                      capabilities.deleteThread) ? (
                      <div className="absolute right-0 top-[calc(100%+0.25rem)] z-[140] min-w-[128px] rounded-[10px] border border-border bg-surface-elevated p-1 shadow-shadow-md">
                        {capabilities.archiveThread ? (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuThreadId(null);
                              void onArchiveThread(thread.id);
                            }}
                            className="flex w-full cursor-pointer items-center rounded-[8px] px-2.5 py-1.5 text-sm text-text-primary transition-colors duration-150 hover:bg-surface-secondary"
                          >
                            {t("chat.sidebar.archive")}
                          </button>
                        ) : null}
                        {capabilities.deleteThread ? (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuThreadId(null);
                              void onDeleteThread(thread.id);
                            }}
                            className="flex w-full cursor-pointer items-center rounded-[8px] px-2.5 py-1.5 text-sm text-danger-text transition-colors duration-150 hover:bg-danger-soft"
                          >
                            {t("chat.sidebar.delete")}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
