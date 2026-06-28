"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useChatRuntime, useChatRuntimeSelector } from "@/features/chat/core/runtime";
import type { ChatSidebarEntry, ChatThreadSummary } from "@/shared/uchat/core";
import { UChatSidebarView } from "@/shared/uchat/ui";
import { message, Modal, TextInput } from "@/shared/ui";
import {
  createChatWorkspace,
  deleteChatWorkspace,
  listChatWorkspaces,
  updateThread,
  type ChatWorkspace,
} from "@/shared/api/thread";
import { UChatSidebarToolsModal } from "./UChatSidebarToolsModal";

type WorkspaceGroup = {
  id: string;
  name: string;
  threads: ChatThreadSummary[];
};

const sortByUpdatedAtDesc = (left: { updatedAt: string }, right: { updatedAt: string }) =>
  right.updatedAt.localeCompare(left.updatedAt);

export function UChatThreadListSidebar() {
  const { t } = useTranslation();
  const runtime = useChatRuntime();
  const threads = useChatRuntimeSelector((state) => state.threads);
  const activeThreadId = useChatRuntimeSelector((state) => state.activeThreadId);
  const threadListStatus = useChatRuntimeSelector((state) => state.threadListStatus);
  const capabilities = useChatRuntimeSelector((state) => state.capabilities);
  const [workspaces, setWorkspaces] = useState<ChatWorkspace[]>([]);
  const [workspaceGroups, setWorkspaceGroups] = useState<WorkspaceGroup[]>([]);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceRootPath, setWorkspaceRootPath] = useState("");
  const [workspacePickerThreadId, setWorkspacePickerThreadId] = useState<string | null>(null);
  const [toolsModalMode, setToolsModalMode] = useState<"search" | "workspace" | null>(null);

  const refreshWorkspaces = async () => {
    setWorkspaces(await listChatWorkspaces());
  };

  useEffect(() => {
    void refreshWorkspaces();
  }, []);

  const groupedThreadIds = useMemo(() => {
    const set = new Set<string>();
    for (const workspace of workspaceGroups) {
      for (const thread of workspace.threads) {
        set.add(thread.id);
      }
    }
    return set;
  }, [workspaceGroups]);

  const ungroupedThreads = useMemo(
    () =>
      [...threads]
        .filter((thread) => !groupedThreadIds.has(thread.id))
        .sort(sortByUpdatedAtDesc),
    [groupedThreadIds, threads],
  );

  useEffect(() => {
    const nextGroups = workspaces.map<WorkspaceGroup>((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      threads: [...threads]
        .filter((thread) => thread.workspaceId === workspace.id)
        .sort(sortByUpdatedAtDesc),
    }));
    setWorkspaceGroups(nextGroups);
  }, [threads, workspaces]);

  const sidebarEntries = useMemo<ChatSidebarEntry[]>(
    () => [{ id: "chat-search", label: t("chat.sidebar.tools.search") }],
    [t],
  );

  const handleCreateThread = () => {
    runtime.enterWelcomeState();
    runtime.store.getState().resetComposer();
  };

  const handleSelectThread = async (threadId: string) => {
    await runtime.selectThread(threadId);
  };

  const handleArchiveThread = async (threadId: string) => {
    if (!capabilities.archiveThread) return;
    await runtime.archiveThread(threadId);
  };

  const handleDeleteThread = async (threadId: string) => {
    if (!capabilities.deleteThread) return;
    await runtime.deleteThread(threadId);
  };

  const handleSidebarEntryClick = async (entry: ChatSidebarEntry) => {
    if (entry.id === "chat-search") {
      setToolsModalMode("search");
      return;
    }
  };

  const handleOpenCreateWorkspace = () => {
    setWorkspaceName("");
    setWorkspaceRootPath("");
    setCreateWorkspaceOpen(true);
  };

  const handleCreateWorkspace = async () => {
    const name = workspaceName.trim();
    if (!name) {
      message.error(t("chat.sidebar.workspaceNameRequired"));
      return;
    }
    const rootPath = workspaceRootPath.trim();
    if (!rootPath) {
      message.error(t("chat.sidebar.workspaceRootPathRequired"));
      return;
    }

    try {
      await createChatWorkspace({ name, rootPath });
      await refreshWorkspaces();
      setCreateWorkspaceOpen(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "";
      message.error(
        errorMessage.includes("required")
          ? t("chat.sidebar.workspaceRootPathRequired")
          : errorMessage.includes("invalid")
            ? t("chat.sidebar.workspaceRootPathInvalid")
            : errorMessage || t("chat.sidebar.workspaceRootPathInvalid"),
      );
    }
  };

  const handleWorkspaceDelete = async (workspaceId: string) => {
    await deleteChatWorkspace(workspaceId);
    await refreshWorkspaces();
  };

  const handleWorkspaceAssign = async (workspaceId: string) => {
    const targetThreadId = workspacePickerThreadId ?? activeThreadId;
    if (!targetThreadId) {
      message.error(t("chat.sidebar.workspaceSelectThreadFirst"));
      return;
    }

    await updateThread(targetThreadId, { workspaceId });
    await runtime.refreshThread(targetThreadId);
    setWorkspacePickerThreadId(null);
    await refreshWorkspaces();
  };

  return (
    <>
      <UChatSidebarView
        threads={ungroupedThreads}
        activeThreadId={activeThreadId}
        threadListStatus={threadListStatus}
        capabilities={capabilities}
        sidebarEntries={sidebarEntries}
        workspaceGroups={workspaceGroups}
        onCreateThread={handleCreateThread}
        onCreateWorkspace={handleOpenCreateWorkspace}
        onSidebarEntryClick={handleSidebarEntryClick}
        onToggleWorkspaceGroup={() => {}}
        onDeleteWorkspace={handleWorkspaceDelete}
        onAddThreadToWorkspace={handleWorkspaceAssign}
        onSelectThread={handleSelectThread}
        onArchiveThread={handleArchiveThread}
        onDeleteThread={handleDeleteThread}
      />

      <UChatSidebarToolsModal
        mode={toolsModalMode}
        open={toolsModalMode !== null}
        threads={threads}
        activeThreadId={activeThreadId}
        workspaceSelection={null}
        workspaceInput={workspaceRootPath}
        isWorkspaceLoading={false}
        isWorkspaceSubmitting={false}
        onWorkspaceInputChange={setWorkspaceRootPath}
        onWorkspaceApply={() => {}}
        onSelectThread={handleSelectThread}
        onClose={() => setToolsModalMode(null)}
      />

      <Modal
        open={createWorkspaceOpen}
        title={t("chat.sidebar.workspaceCreate")}
        footer={null}
        onClose={() => setCreateWorkspaceOpen(false)}
      >
        <div className="space-y-4">
          <TextInput
            label={t("chat.sidebar.workspaceName")}
            value={workspaceName}
            onChange={setWorkspaceName}
            placeholder={t("chat.sidebar.workspaceNamePlaceholder")}
          />
          <TextInput
            label={t("chat.sidebar.workspaceRootPath")}
            value={workspaceRootPath}
            onChange={setWorkspaceRootPath}
            placeholder={t("chat.sidebar.workspaceRootPathPlaceholder")}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-ui-control border border-border px-3 py-2 text-sm"
              onClick={() => setCreateWorkspaceOpen(false)}
            >
              {t("common.actions.cancel")}
            </button>
            <button
              type="button"
              className="rounded-ui-control bg-primary px-3 py-2 text-sm text-white"
              onClick={() => {
                void handleCreateWorkspace();
              }}
            >
              {t("chat.sidebar.workspaceCreate")}
            </button>
          </div>
        </div>
      </Modal>

    </>
  );
}
