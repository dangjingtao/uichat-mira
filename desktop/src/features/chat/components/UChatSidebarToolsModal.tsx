"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ChatThreadSummary } from "@/shared/uchat/core";
import type { McpWorkspaceSelection } from "@/shared/api/tools";
import { Button, Modal, TextInput } from "@/shared/ui";

export type UChatSidebarToolMode = "search" | "workspace" | null;

interface UChatSidebarToolsModalProps {
  mode: UChatSidebarToolMode;
  open: boolean;
  threads: ChatThreadSummary[];
  activeThreadId: string | null;
  workspaceSelection: McpWorkspaceSelection | null;
  workspaceInput: string;
  isWorkspaceLoading: boolean;
  isWorkspaceSubmitting: boolean;
  onWorkspaceInputChange: (value: string) => void;
  onWorkspaceApply: () => void | Promise<void>;
  onSelectThread: (threadId: string) => void | Promise<void>;
  onClose: () => void;
}

const normalizeText = (value: string) => value.trim().toLowerCase();

export function UChatSidebarToolsModal({
  mode,
  open,
  threads,
  activeThreadId,
  workspaceSelection,
  workspaceInput,
  isWorkspaceLoading,
  isWorkspaceSubmitting,
  onWorkspaceInputChange,
  onWorkspaceApply,
  onSelectThread,
  onClose,
}: UChatSidebarToolsModalProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredThreads = useMemo(() => {
    const query = normalizeText(searchQuery);
    if (!query) {
      return threads;
    }

    return threads.filter((thread) => {
      const title = normalizeText(thread.title);
      return title.includes(query) || normalizeText(thread.id).includes(query);
    });
  }, [searchQuery, threads]);

  const title =
    mode === "search"
      ? t("chat.sidebar.tools.searchTitle")
      : t("chat.sidebar.tools.workspaceTitle");

  return (
    <Modal open={open} title={title} width={mode === "search" ? 560 : 640} footer={null} onClose={onClose}>
      {mode === "search" ? (
        <div className="space-y-4">
          <TextInput
            label={t("chat.sidebar.tools.searchInputLabel")}
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t("chat.sidebar.tools.searchPlaceholder")}
          />

          <div className="max-h-[420px] space-y-1 overflow-y-auto rounded-[16px] border border-border bg-surface-secondary/40 p-2">
            {filteredThreads.length === 0 ? (
              <div className="px-3 py-6 text-sm text-text-secondary">
                {t("chat.sidebar.tools.searchEmpty")}
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isActive = thread.id === activeThreadId;

                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => {
                      void onSelectThread(thread.id);
                      onClose();
                    }}
                    className={`flex w-full items-center justify-between rounded-[12px] px-3 py-2.5 text-left transition-colors hover:bg-surface-primary ${
                      isActive ? "bg-primary/8" : ""
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-text-primary">
                        {thread.title || t("chat.sidebar.untitledConversation")}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-text-secondary">
                        {new Date(thread.updatedAt).toLocaleString()}
                      </span>
                    </span>
                    {isActive ? (
                      <span className="ml-3 shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                        {t("chat.sidebar.tools.currentThread")}
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      {mode === "workspace" ? (
        <div className="space-y-4">
          <div className="rounded-[16px] border border-border bg-surface-secondary/40 px-4 py-3">
            <div className="text-sm font-medium text-text-primary">
              {t("chat.sidebar.tools.workspaceCurrent")}
            </div>
            <div className="mt-1 break-all text-sm text-text-secondary">
              {workspaceSelection?.rootPath ??
                t("chat.sidebar.tools.workspaceUnset")}
            </div>
          </div>

          <TextInput
            label={t("chat.sidebar.tools.workspaceInputLabel")}
            value={workspaceInput}
            onChange={onWorkspaceInputChange}
            placeholder={t("chat.sidebar.tools.workspacePlaceholder")}
            disabled={isWorkspaceLoading || isWorkspaceSubmitting}
          />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              {t("common.actions.cancel")}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                void onWorkspaceApply();
              }}
              disabled={isWorkspaceLoading || isWorkspaceSubmitting}
            >
              {t("chat.sidebar.tools.workspaceApply")}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
