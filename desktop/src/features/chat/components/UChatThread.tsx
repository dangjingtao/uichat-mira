"use client";

import React, { useMemo, useState } from "react";
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
import { UChatThreadView } from "@/shared/uchat/ui";
import type {
  ChatComposerAction,
  ChatThreadContextTag,
} from "@/shared/uchat/core";
import { SearchSelectModal, message } from "@/shared/ui";

// The same badge metadata from the previous thread view is reused so model
// presentation stays visually consistent while the runtime changes underneath.
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

// UChatThread is the current app-owned thread surface. It keeps the existing
// runtime wiring and business decisions, while visual rendering now lives in
// shared/uchat/ui.
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
  const { draftKnowledgeBaseId, setDraftKnowledgeBaseId } =
    useChatThreadDraftState();
  const [isKnowledgeBasePickerOpen, setKnowledgeBasePickerOpen] = useState(false);

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

  // Composer gating continues to respect the existing model configuration rules.
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

  const threadContextTags = useMemo<ChatThreadContextTag[]>(
    () =>
      activeKnowledgeBase
        ? [
            {
              id: `knowledge-base:${activeKnowledgeBase.id}`,
              kind: "knowledge-base",
              label: activeKnowledgeBase.name,
              tooltip: `${activeKnowledgeBase.name} (${activeKnowledgeBase.enabledDocumentCount} enabled documents)`,
              removable: true,
            },
          ]
        : [],
    [activeKnowledgeBase],
  );

  const handleUpdateThreadKnowledgeBase = async (nextKnowledgeBaseId: string | null) => {
    if (!activeThreadId || !activeThread) {
      return;
    }

    await runtime.updateThread(activeThreadId, {
      metadata: nextKnowledgeBaseId ? { knowledgeBaseId: nextKnowledgeBaseId } : { knowledgeBaseId: null },
    });
    await runtime.refreshThread(activeThreadId);
  };

  const handleComposerAction = async (action: ChatComposerAction) => {
    if (action.id === "knowledge-base-picker") {
      setKnowledgeBasePickerOpen(true);
    }
  };

  const handleSelectKnowledgeBase = async (knowledgeBaseId: string) => {
    if (!activeThreadId || !activeThread) {
      setDraftKnowledgeBaseId(knowledgeBaseId);
      return true;
    }

    await handleUpdateThreadKnowledgeBase(knowledgeBaseId);
    return true;
  };

  const handleRemoveThreadContextTag = async () => {
    if (!activeThreadId || !activeThread) {
      setDraftKnowledgeBaseId(null);
      return;
    }

    await handleUpdateThreadKnowledgeBase(null);
  };

  // Sending delegates to uchat runtime after the local draft state is synced.
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
