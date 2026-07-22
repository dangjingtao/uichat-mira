"use client";

import { ChevronDown, ChevronRight, Folder, FolderOpen, MoreHorizontal, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ChatSidebarEntry, ChatThreadSummary } from "../core";
import DropdownMenu from "@/shared/ui/DropdownMenu";
import Tooltip from "@/shared/ui/Tooltip";

type ChatWorkspaceGroup = {
  id: string;
  name: string;
  rootPath?: string | null;
  threads: ChatThreadSummary[];
  collapsed?: boolean;
};

const THREAD_TITLE_MAX_CHARS = 7;

const threadMenuButtonClassName =
  "mr-0.5 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-[8px] border border-transparent bg-transparent text-text-secondary transition-all duration-150 hover:bg-surface-secondary/70 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 data-[state=open]:opacity-100";

const threadTitleButtonClassName =
  "flex min-w-0 flex-1 overflow-hidden text-left focus-visible:outline-none";

const formatThreadTitle = (title: string) => {
  const normalized = title.trim();
  const chars = Array.from(normalized);
  if (chars.length <= THREAD_TITLE_MAX_CHARS) {
    return normalized;
  }

  return `${chars.slice(0, THREAD_TITLE_MAX_CHARS).join("")}...`;
};

function ThreadActionsMenu({
  threadId,
  isActive,
  capabilities,
  onArchiveThread,
  onDeleteThread,
}: {
  threadId: string;
  isActive: boolean;
  capabilities: {
    archiveThread?: boolean;
    deleteThread?: boolean;
  };
  onArchiveThread: (threadId: string) => void | Promise<void>;
  onDeleteThread: (threadId: string) => void | Promise<void>;
}) {
  const { t } = useTranslation();

  if (!capabilities.archiveThread && !capabilities.deleteThread) {
    return null;
  }

  return (
    <DropdownMenu
      trigger={
        <button
          type="button"
          aria-label={t("common.actions.more")}
          className={`${threadMenuButtonClassName} ${
            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <MoreHorizontal className="size-4" />
        </button>
      }
      items={[
        ...(capabilities.archiveThread
          ? [
              {
                id: "archive",
                label: t("chat.sidebar.archive"),
              },
            ]
          : []),
        ...(capabilities.deleteThread
          ? [
              {
                id: "delete",
                label: t("chat.sidebar.delete"),
                tone: "danger" as const,
              },
            ]
          : []),
      ]}
      onSelect={(item) => {
        if (item.id === "archive") {
          void onArchiveThread(threadId);
          return;
        }
        if (item.id === "delete") {
          void onDeleteThread(threadId);
        }
      }}
      align="end"
      sideOffset={4}
    />
  );
}

// UChatSidebarView is the pure presentational sidebar for thread creation,
// selection, archiving, and deletion.
export function UChatSidebarView({
  threads,
  activeThreadId,
  threadListStatus,
  capabilities,
  sidebarEntries,
  workspaceGroups,
  onCreateThread,
  onCreateWorkspace,
  onSidebarEntryClick,
  onToggleWorkspaceGroup,
  onDeleteWorkspace,
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
  sidebarEntries?: ChatSidebarEntry[];
  workspaceGroups?: ChatWorkspaceGroup[];
  onCreateThread: () => void | Promise<void>;
  onCreateWorkspace?: () => void | Promise<void>;
  onSidebarEntryClick?: (entry: ChatSidebarEntry) => void | Promise<void>;
  onToggleWorkspaceGroup?: (workspaceId: string) => void | Promise<void>;
  onDeleteWorkspace?: (workspaceId: string) => void | Promise<void>;
  onSelectThread: (threadId: string) => void | Promise<void>;
  onArchiveThread: (threadId: string) => void | Promise<void>;
  onDeleteThread: (threadId: string) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [collapsedWorkspaceIds, setCollapsedWorkspaceIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isHistoryCollapsed, setHistoryCollapsed] = useState(false);

  // The list is sorted in the view so the latest updated thread always floats
  // to the top even if the repository returns a stale ordering.
  const sortedThreads = useMemo(
    () =>
      [...threads].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      ),
    [threads],
  );

  const workspaceList = workspaceGroups ?? [];
  const workspaceThreadIds = new Set(
    workspaceList.flatMap((workspace) =>
      workspace.threads.map((thread) => thread.id),
    ),
  );
  const hasWorkspaceSection = workspaceList.length > 0 || Boolean(onCreateWorkspace);
  const hasWorkspaceGroups = workspaceList.length > 0;
  const visibleThreads = sortedThreads.filter(
    (thread) => !workspaceThreadIds.has(thread.id),
  );

  const toggleWorkspaceExpanded = (workspaceId: string) => {
    setCollapsedWorkspaceIds((current) => {
      const next = new Set(current);
      if (next.has(workspaceId)) {
        next.delete(workspaceId);
      } else {
        next.add(workspaceId);
      }
      return next;
    });
  };

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

      {sidebarEntries && sidebarEntries.length > 0 ? (
        <div className="shrink-0 px-2 pb-2 pr-4">
          <div className="space-y-1">
            {sidebarEntries.map((entry) => {
              const isWorkspaceCreate = entry.id === "workspace-create";
              return (
                <button
                  key={entry.id}
                  type="button"
                  disabled={entry.disabled}
                  onClick={() => {
                    void onSidebarEntryClick?.(entry);
                  }}
                  className="flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left transition-all duration-150 hover:bg-[rgb(var(--color-primary)/0.045)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {isWorkspaceCreate ? (
                      <Plus className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                    ) : (
                      <Search data-testid="chat-search-icon" className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                    )}
                    <span className="block truncate text-sm font-medium text-text-primary">
                      {entry.label}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3 pr-4">
        {hasWorkspaceSection ? (
          <div className="pb-2">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-text-tertiary">
                {t("chat.sidebar.workspaces")}
              </span>
              {onCreateWorkspace ? (
                <button
                  type="button"
                  aria-label={t("chat.sidebar.workspaceCreate")}
                  onClick={() => {
                    void onCreateWorkspace();
                  }}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-ui-control border border-transparent bg-transparent p-0 text-text-secondary transition-all duration-150 hover:bg-surface-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <div className="space-y-1">
              {hasWorkspaceGroups
                ? workspaceList.map((workspace) => {
              const isCollapsed =
                collapsedWorkspaceIds.has(workspace.id) || (workspace.collapsed ?? false);
              const hasThreads = workspace.threads.length > 0;

              return (
                <div key={workspace.id} className="space-y-0.5">
                  <div className="group flex items-center gap-1 rounded-[10px] px-1 py-1 transition-colors hover:bg-[rgb(var(--color-primary)/0.04)]">
                    <button
                      type="button"
                      onClick={() => {
                        toggleWorkspaceExpanded(workspace.id);
                        void onToggleWorkspaceGroup?.(workspace.id);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-[8px] px-2 py-1 text-left focus-visible:outline-none"
                    >
                      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-text-tertiary transition-transform duration-200 ease-out">
                        {isCollapsed ? (
                          <Folder className="h-3.5 w-3.5" />
                        ) : (
                          <FolderOpen className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-text-tertiary transition-transform duration-200 ease-out">
                        {isCollapsed ? (
                          <ChevronRight className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <Tooltip
                          text={workspace.rootPath?.trim() || workspace.name}
                          placement="top"
                        >
                          <span className="block truncate text-sm font-medium text-text-primary">
                            {workspace.name}
                          </span>
                        </Tooltip>
                      </span>
                    </button>

                    <div className="flex items-center gap-1">
                      {onDeleteWorkspace ? (
                        <DropdownMenu
                          trigger={
                            <button
                              type="button"
                              aria-label={t("common.actions.more")}
                              className={`mr-0.5 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center text-text-tertiary transition-all duration-150 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
                                "opacity-0 group-hover:opacity-100"
                              }`}
                            >
                              <MoreHorizontal className="size-4" />
                            </button>
                          }
                          items={[
                            {
                              id: "workspace-delete",
                              label: t("chat.sidebar.delete"),
                              leadingIcon: null,
                              tone: "danger" as const,
                            },
                          ]}
                          onSelect={(item) => {
                            if (item.id !== "workspace-delete") return;
                            void onDeleteWorkspace(workspace.id);
                          }}
                          align="end"
                        />
                      ) : null}
                    </div>
                  </div>

                  <div
                    className={`grid overflow-hidden pl-[21px] transition-[grid-template-rows,opacity] duration-200 ease-out ${
                      !isCollapsed && hasThreads
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="min-h-0">
                      <div className="space-y-0.5 pb-0.5">
                      {workspace.threads.map((thread) => {
                        const isActive = thread.id === activeThreadId;

                        return (
                          <div
                            key={thread.id}
                            className={`group relative flex items-center rounded-[8px] px-1 py-0 text-text-secondary transition-all duration-150 hover:bg-[rgb(var(--color-primary)/0.04)] hover:text-text-primary ${
                              isActive
                                ? "bg-[rgb(var(--color-primary)/0.04)] text-text-primary"
                                : ""
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                void onSelectThread(thread.id);
                              }}
                              className={`${threadTitleButtonClassName} px-3 py-2 pr-10`}
                            >
                              <span className="min-w-0 flex-1 overflow-hidden">
                                <span className="block truncate text-sm leading-5">
                                  {formatThreadTitle(
                                    thread.title || t("chat.sidebar.untitledConversation"),
                                  )}
                                </span>
                              </span>
                            </button>
                            <div className="absolute right-1 top-1/2 z-10 -translate-y-1/2 shrink-0">
                              <ThreadActionsMenu
                                threadId={thread.id}
                                isActive={isActive}
                                capabilities={capabilities}
                                onArchiveThread={onArchiveThread}
                                onDeleteThread={onDeleteThread}
                              />
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    </div>
                  </div>
                </div>
              );
                })
                : null}
            </div>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-col overflow-hidden">
          <button
            type="button"
            onClick={() => setHistoryCollapsed((current) => !current)}
            className="mb-2 flex items-center justify-between gap-2 rounded-[10px] px-1 py-1 text-left transition-colors hover:bg-[rgb(var(--color-primary)/0.04)] focus-visible:outline-none"
          >
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-text-tertiary">
              {t("chat.sidebar.historyThreads")}
            </span>
            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-text-tertiary transition-transform duration-200 ease-out">
              {isHistoryCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </span>
          </button>
          <div
            className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out ${
              !isHistoryCollapsed ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="min-h-0 pr-0.5">
            {threadListStatus === "loading" && visibleThreads.length === 0 ? (
              <div className="px-4 py-3 text-sm text-text-secondary">
                {t("common.status.loading")}
              </div>
            ) : null}

            {visibleThreads.map((thread) => {
              const isActive = thread.id === activeThreadId;

              return (
                <div
                  key={thread.id}
                  className={`group relative mb-0.5 flex items-center px-0.5 py-0 text-text-secondary transition-all duration-150 hover:bg-[rgb(var(--color-primary)/0.04)] hover:text-text-primary ${
                    isActive
                      ? "bg-[rgb(var(--color-primary)/0.04)] text-text-primary"
                      : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      void onSelectThread(thread.id);
                    }}
                    className={`${threadTitleButtonClassName} px-4 py-2 pr-11`}
                  >
                    <span className="min-w-0 flex-1 overflow-hidden">
                      <span className="block truncate text-sm leading-5">
                        {formatThreadTitle(
                          thread.title || t("chat.sidebar.untitledConversation"),
                        )}
                      </span>
                    </span>
                  </button>

                  <div className="absolute right-1 top-1/2 z-10 -translate-y-1/2 shrink-0">
                    <ThreadActionsMenu
                      threadId={thread.id}
                      isActive={isActive}
                      capabilities={capabilities}
                      onArchiveThread={onArchiveThread}
                      onDeleteThread={onDeleteThread}
                    />
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
