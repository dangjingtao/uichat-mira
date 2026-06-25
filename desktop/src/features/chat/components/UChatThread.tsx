"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BowArrow,
  EthernetPort,
  FileImage,
  MessageCircleCode,
} from "lucide-react";
import { useRoleModelConfigs } from "@/app/providers/RoleModelConfigProvider";
import { useChatKnowledgeBaseState } from "@/features/chat/core/knowledgeBaseState";
import {
  useChatRuntime,
  useChatRuntimeSelector,
  useChatThreadDraftState,
} from "@/features/chat/core/runtime";
import { useUChatComposerState } from "@/features/chat/core/composerPolicy";
import { resolveAttachmentSource } from "@/features/chat/core/protocol";
import type { KnowledgeBaseSummary } from "@/shared/api/knowledgeBase";
import {
  getRoleById,
  listRoles,
  type RoleSummary,
} from "@/shared/api/roles";
import { getBuiltinAvatarPack16Options } from "@/shared/avatars";
import { UChatThreadView } from "@/shared/uchat/ui";
import type {
  ChatComposerAction,
  ChatThreadContextTag,
} from "@/shared/uchat/core";
import { Modal, SearchSelectModal, message } from "@/shared/ui";
import {
  buildThreadContextTags,
  formatRoleReplyingLabel,
  resolveActiveRoleId,
  resolveRoleAvatarSrc,
  upsertRoleSummary,
} from "./roleChatState";
import ThreadContextSummaryModalContent from "./ThreadContextSummaryModalContent";

const modelBadgeMeta = {
  llm: { label: "LLM", icon: EthernetPort },
  task: { label: "Task", icon: MessageCircleCode },
  embedding: { label: "Embedding", icon: BowArrow },
  rerank: { label: "Rerank", icon: FileImage },
} as const;

const isConfiguredModelName = (name: string) => {
  const normalized = name.trim();
  if (!normalized) {
    return false;
  }

  return (
    !normalized.startsWith("未配置") && !normalized.startsWith("Unconfigured")
  );
};

export default function UChatThread() {
  const { t } = useTranslation();
  const runtime = useChatRuntime();
  const activeThreadId = useChatRuntimeSelector((state) => state.activeThreadId);
  const threads = useChatRuntimeSelector((state) => state.threads);
  const composer = useChatRuntimeSelector((state) => state.composer);
  const runStatus = useChatRuntimeSelector((state) => state.runStatus);
  const threadStatus = useChatRuntimeSelector((state) => state.threadStatus);
  const capabilities = useChatRuntimeSelector((state) => state.capabilities);
  const activeThread =
    threads.find((thread) => thread.id === activeThreadId) ?? null;
  const messages = activeThread?.messages ?? [];
  const isRunning = runStatus.type === "running";
  const { configMap, hasDefaultEmbedding, hasDefaultLlm } =
    useRoleModelConfigs();
  const { knowledgeBases } = useChatKnowledgeBaseState();
  const {
    draftKnowledgeBaseId,
    draftRoleId,
    setDraftKnowledgeBaseId,
    setDraftRoleId,
  } = useChatThreadDraftState();
  const [isKnowledgeBasePickerOpen, setKnowledgeBasePickerOpen] = useState(false);
  const [isRolePickerOpen, setRolePickerOpen] = useState(false);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const avatarOptions = useMemo(() => getBuiltinAvatarPack16Options(), []);

  const threadKnowledgeBaseId =
    typeof activeThread?.metadata?.knowledgeBaseId === "string" ||
    activeThread?.metadata?.knowledgeBaseId === null
      ? activeThread.metadata.knowledgeBaseId
      : undefined;
  const activeKnowledgeBaseId =
    threadKnowledgeBaseId !== undefined
      ? threadKnowledgeBaseId
      : draftKnowledgeBaseId;
  const hasKnowledgeBase = Boolean(activeKnowledgeBaseId);
  const persistedRoleId =
    typeof activeThread?.metadata?.roleId === "string" ||
    activeThread?.metadata?.roleId === null
      ? activeThread.metadata.roleId
      : undefined;

  const { isSendDisabled, placeholder } = useUChatComposerState({
    isRunning,
    hasKnowledgeBase,
    hasDefaultLlm,
    hasDefaultEmbedding,
  });

  const modelBadges = useMemo(() => {
    const items = [
      { key: "llm", name: configMap.llm?.name ?? t("chat.thread.models.llm") },
      {
        key: "task",
        name: configMap.task?.name ?? t("chat.thread.models.task"),
      },
      {
        key: "embedding",
        name: configMap.embedding?.name ?? t("chat.thread.models.embedding"),
      },
      {
        key: "rerank",
        name: configMap.rerank?.name ?? t("chat.thread.models.rerank"),
      },
    ] as const;

    return items
      .filter((item) => isConfiguredModelName(item.name))
      .map((item) => ({
        ...item,
        label: modelBadgeMeta[item.key].label,
        icon: modelBadgeMeta[item.key].icon,
      }));
  }, [configMap, t]);

  const activeKnowledgeBase = useMemo(
    () =>
      activeKnowledgeBaseId
        ? knowledgeBases.find((item) => item.id === activeKnowledgeBaseId) ?? null
        : null,
    [activeKnowledgeBaseId, knowledgeBases],
  );

  useEffect(() => {
    let disposed = false;

    const loadRoleList = async () => {
      try {
        const nextRoles = await listRoles({
          status: "active",
          sortBy: "updatedAt",
          sortOrder: "desc",
        });
        if (!disposed) {
          setRoles(nextRoles);
        }
      } catch (error) {
        if (!disposed) {
          message.error(
            error instanceof Error
              ? error.message
              : t("chat.thread.roles.loadFailed"),
          );
        }
      }
    };

    void loadRoleList();

    return () => {
      disposed = true;
    };
  }, [t]);

  const activeRoleId = resolveActiveRoleId({
    hasPersistedThread: Boolean(activeThreadId),
    persistedRoleId,
    welcomeRoleId: draftRoleId,
  });
  const activeRole = useMemo(
    () => roles.find((item) => item.id === activeRoleId) ?? null,
    [activeRoleId, roles],
  );
  const activeRoleAvatarSrc = useMemo(
    () => resolveRoleAvatarSrc(activeRole?.avatarId ?? null, avatarOptions),
    [activeRole?.avatarId, avatarOptions],
  );
  const assistantTypingLabel = formatRoleReplyingLabel(
    activeRole?.name ?? null,
    t("chat.thread.assistantTyping"),
    t("chat.thread.roles.replyingSuffix"),
  );

  const threadContextTags = useMemo<ChatThreadContextTag[]>(
    () =>
      buildThreadContextTags({
        knowledgeBase: activeKnowledgeBase,
        role: activeRole,
        roleAvatarSrc: activeRoleAvatarSrc,
      }),
    [activeKnowledgeBase, activeRole, activeRoleAvatarSrc],
  );

  const handleUpdateThreadKnowledgeBase = async (
    nextKnowledgeBaseId: string | null,
  ) => {
    if (!activeThreadId || !activeThread) {
      return;
    }

    await runtime.updateThread(activeThreadId, {
      metadata: nextKnowledgeBaseId
        ? { knowledgeBaseId: nextKnowledgeBaseId }
        : { knowledgeBaseId: null },
    });
    await runtime.refreshThread(activeThreadId);
  };

  const handleComposerAction = async (action: ChatComposerAction) => {
    if (action.id === "role-picker") {
      setRolePickerOpen(true);
      return;
    }

    if (action.id === "knowledge-base-picker") {
      setKnowledgeBasePickerOpen(true);
      return;
    }

    if (action.id === "context-summary") {
      if (!activeThreadId || !activeThread) {
        message.error(t("chat.thread.contextSummary.requiresThread"));
        return;
      }

      let modalKey = "";
      modalKey = Modal.show({
        title: t("chat.thread.contextSummary.modalTitle"),
        width: 720,
        content: (
          <ThreadContextSummaryModalContent
            threadId={activeThreadId}
            initialSummary={
              typeof activeThread.metadata?.contextSummary === "string"
                ? activeThread.metadata.contextSummary
                : null
            }
            initialUpdatedAt={
              typeof activeThread.metadata?.contextSummaryUpdatedAt === "string"
                ? activeThread.metadata.contextSummaryUpdatedAt
                : null
            }
            onSaved={({ contextSummary, contextSummaryUpdatedAt }) => {
              void runtime.updateThread(activeThreadId, {
                metadata: {
                  ...((activeThread.metadata ?? {}) as Record<string, unknown>),
                  contextSummary,
                  contextSummaryUpdatedAt,
                },
              });
            }}
            onClose={() => Modal.close(modalKey)}
          />
        ),
        footer: null,
      });
    }
  };

  const handleSelectRole = async (roleId: string) => {
    const selectedRole = await getRoleById(roleId);
    setRoles((currentRoles) => upsertRoleSummary(currentRoles, selectedRole));

    if (activeThreadId) {
      await runtime.updateThread(activeThreadId, {
        metadata: {
          ...((activeThread?.metadata ?? {}) as Record<string, unknown>),
          roleId,
        },
      });
      await runtime.refreshThread(activeThreadId);
      setDraftRoleId(null);
    } else {
      setDraftRoleId(roleId);
    }

    return true;
  };

  const handleSelectKnowledgeBase = async (knowledgeBaseId: string) => {
    if (!activeThreadId || !activeThread) {
      setDraftKnowledgeBaseId(knowledgeBaseId);
      return true;
    }

    await handleUpdateThreadKnowledgeBase(knowledgeBaseId);
    return true;
  };

  const handleRemoveThreadContextTag = async (tag: ChatThreadContextTag) => {
    if (tag.kind === "role") {
      if (activeThreadId) {
        await runtime.updateThread(activeThreadId, {
          metadata: {
            ...((activeThread?.metadata ?? {}) as Record<string, unknown>),
            roleId: null,
          },
        });
        await runtime.refreshThread(activeThreadId);
        setDraftRoleId(null);
      } else {
        setDraftRoleId(null);
      }
      return;
    }

    if (!activeThreadId || !activeThread) {
      setDraftKnowledgeBaseId(null);
      return;
    }

    await handleUpdateThreadKnowledgeBase(null);
  };

  const handleSend = async () => {
    if (isSendDisabled) {
      return;
    }

    await runtime.send();
  };

  return (
    <>
      <UChatThreadView
        activeThreadId={activeThreadId}
        title={
          activeThread?.title ||
          (messages.length === 0
            ? t("chat.thread.header.newConversation")
            : t("chat.thread.header.untitledConversation"))
        }
        badges={modelBadges}
        messages={messages}
        composer={composer}
        runStatus={runStatus}
        threadStatus={threadStatus}
        capabilities={capabilities}
        hasKnowledgeBase={hasKnowledgeBase}
        placeholder={placeholder}
        isSendDisabled={isSendDisabled}
        onComposerTextChange={(value) => runtime.setComposerText(value)}
        onComposerAttachmentsChange={(files) => runtime.setComposerAttachments(files)}
        onComposerAttachmentsAppend={(files) =>
          runtime.appendComposerAttachments(files)
        }
        onComposerAttachmentRemove={(attachmentId) =>
          runtime.removeComposerAttachment(attachmentId)
        }
        onSend={handleSend}
        onCancelSend={() => runtime.cancelSend()}
        onRegenerate={(messageId) => runtime.regenerate(messageId)}
        onEditUserMessage={(messageId, text, parts) =>
          runtime.editUserMessage(messageId, text, parts)
        }
        onComposerAction={handleComposerAction}
        threadContextTags={threadContextTags}
        onRemoveThreadContextTag={handleRemoveThreadContextTag}
        resolveAttachmentSource={resolveAttachmentSource}
        assistantAvatarSrc={activeRoleAvatarSrc}
        assistantDisplayName={activeRole?.name}
        assistantTypingLabel={assistantTypingLabel}
      />

      <SearchSelectModal<RoleSummary[]>
        open={isRolePickerOpen}
        title={t("chat.thread.roles.title")}
        url="/roles?status=active&sortBy=updatedAt&sortOrder=desc"
        width={520}
        selectedId={activeRoleId}
        searchPlaceholder={t("chat.thread.roles.searchPlaceholder")}
        emptyText={t("chat.thread.roles.empty")}
        loadingText={t("chat.thread.roles.loading")}
        loadErrorText={t("chat.thread.roles.loadFailed")}
        normalizeItems={(items) =>
          items.map((item) => ({
            id: item.id,
            label: item.name,
            description: item.summary,
            keywords: [item.id, ...item.tags],
            meta: item.status,
            title: item.name,
            leadingAvatarSrc: resolveRoleAvatarSrc(item.avatarId, avatarOptions),
          }))
        }
        onCheck={(item) => handleSelectRole(item.id)}
        onClose={() => setRolePickerOpen(false)}
      />

      <SearchSelectModal<KnowledgeBaseSummary[]>
        open={isKnowledgeBasePickerOpen}
        title="Select knowledge base"
        url="/knowledge-bases"
        width={520}
        selectedId={activeKnowledgeBaseId}
        searchPlaceholder="Search knowledge bases"
        emptyText="No knowledge bases found"
        loadingText="Loading knowledge bases..."
        normalizeItems={(items) =>
          items.map((item) => ({
            id: item.id,
            label: item.name,
            description: item.description,
            keywords: [item.id],
            meta: `${item.enabledDocumentCount} enabled / ${item.documentCount} total`,
            title: item.name,
            disabled: item.enabledDocumentCount === 0,
          }))
        }
        onCheck={(item) => handleSelectKnowledgeBase(item.id)}
        onClose={() => setKnowledgeBasePickerOpen(false)}
      />
    </>
  );
}
