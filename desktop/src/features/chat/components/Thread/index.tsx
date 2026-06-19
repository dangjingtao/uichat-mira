"use client";

import React, {
  type WheelEvent,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  BowArrow,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  EthernetPort,
  FileImage,
  FileUp,
  FolderSearch,
  MessageCircleCode,
  MessagesSquare,
  Paperclip,
  Pencil,
  RefreshCw,
} from "lucide-react";
import {
  ActionBarPrimitive,
  AttachmentPrimitive,
  ComposerPrimitive,
  MessagePartPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAui,
  useAttachment,
  useAuiState,
} from "@assistant-ui/react";
import { useKnowledgeBaseAvailability } from "@/app/providers/KnowledgeBaseAvailabilityProvider";
import { useRoleModelConfigs } from "@/app/providers/RoleModelConfigProvider";
import { useCurrentThread } from "@/features/chat/Providers/CurrentThreadProvider";
import { resolveAttachmentUrl } from "@/shared/api/attachments";
import MarkdownText from "@/shared/ui/MarkdownText";
import RagProgressDetailDrawer, {
  type RagProgressDetail,
} from "./RagProgressDetailDrawer";
import RagSourceDetailDrawer from "./RagSourceDetailDrawer";
import OverflowTooltip from "./OverflowTooltip";
import RagExecutionTrace from "./RagExecutionTrace";
import ThreadComposer from "./ThreadComposer";
import ThreadHeader from "./ThreadHeader";
import WelcomeEmptyState from "./WelcomeEmptyState";
import {
  AssistantAvatar,
  AssistantBubbleShell,
  UserBubbleShell,
} from "./MessageBubbleShells";
import {
  getRagProgressFromContentParts,
  getRagSourcesFromContentParts,
  getVisibleRagSources,
  normalizeInlineText,
} from "./thread.parsers";
import type { RagSourceLike, ThreadMessageLike } from "./thread.types";
import { useThreadComposerState } from "./useThreadComposerState";
import { useThreadRagRuntime } from "./useThreadRagRuntime";

const typingAnimationStyle = `
  @keyframes typing-dot {
    0%, 80%, 100% {
      transform: scale(0.72);
      opacity: 0.28;
    }
    40% {
      transform: scale(1);
      opacity: 0.95;
    }
  }
`;

const shellClassName =
  "relative flex h-full min-h-0 flex-col overflow-hidden bg-surface-secondary text-text-primary";

const backdropOrbsClassName =
  "pointer-events-none absolute inset-0 overflow-hidden";

const contentColumnClassName =
  "mx-auto flex w-full flex-1 flex-col px-4 pb-[12.5rem] pt-4 sm:px-6 lg:px-8";

const actionButtonClassName =
  "inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-surface-primary/92 text-text-secondary transition-colors hover:border-border hover:bg-surface-primary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20";

type ImagePreviewState = {
  src: string;
};

type ThreadMessageRuntimeData = {
  messagesById: Record<string, ThreadMessageLike>;
  persistedSourcesByMessageId: Record<string, RagSourceLike[]>;
  onOpenRagProgressDetail: (detail: RagProgressDetail) => void;
  onOpenRagSourceDetail: (detail: {
    messageId?: string;
    sources: RagSourceLike[];
  }) => void;
};

const ThreadMessageRuntimeContext =
  React.createContext<ThreadMessageRuntimeData | null>(null);

function useThreadMessageRuntimeData() {
  const value = useContext(ThreadMessageRuntimeContext);

  if (!value) {
    throw new Error("Thread message runtime data is unavailable");
  }

  return value;
}

function PodiumIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 6V2h-1" />
      <path d="M9 15a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1" />
      <path d="M9 21V11a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v10" />
    </svg>
  );
}

const modelBadgeMeta = {
  llm: { label: "LLM", icon: EthernetPort },
  task: { label: "Task", icon: MessageCircleCode },
  embedding: { label: "Embedding", icon: BowArrow },
  rerank: { label: "Rerank", icon: PodiumIcon },
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

const getStatusMessage = (
  reason:
    | "cancelled"
    | "length"
    | "content-filter"
    | "other"
    | "error"
    | "tool-calls",
  t: ReturnType<typeof useTranslation>["t"],
) => {
  if (reason === "cancelled") {
    return t("chat.thread.status.cancelled");
  }

  if (reason === "error") {
    return t("chat.thread.status.failed");
  }

  return t("chat.thread.status.stopped");
};

function ComposerAttachmentItem() {
  const { t } = useTranslation();
  return (
    <AttachmentPrimitive.Root className="inline-flex max-w-full items-center gap-2 rounded-2xl border border-border/70 bg-surface-primary/92 px-3 py-2 text-xs text-text-secondary shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <AttachmentPrimitive.unstable_Thumb className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-secondary text-[10px] font-medium text-text-secondary" />
      <span className="min-w-0 flex-1 truncate font-medium text-text-primary">
        <AttachmentPrimitive.Name />
      </span>
      <AttachmentPrimitive.Remove
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-surface-secondary hover:text-text-primary"
        title={t("chat.thread.composer.removeAttachment")}
      >
        <span className="text-xs leading-none">x</span>
      </AttachmentPrimitive.Remove>
    </AttachmentPrimitive.Root>
  );
}

function ReadOnlyAttachmentItem() {
  return (
    <AttachmentPrimitive.Root className="inline-flex max-w-full items-center gap-2 rounded-2xl border border-border/70 bg-surface-primary/92 px-3 py-2 text-xs text-text-secondary shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <AttachmentPrimitive.unstable_Thumb className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-secondary text-[10px] font-medium text-text-secondary" />
      <span className="min-w-0 flex-1 truncate font-medium text-text-primary">
        <AttachmentPrimitive.Name />
      </span>
    </AttachmentPrimitive.Root>
  );
}

function ImagePreviewOverlay({
  preview,
  onClose,
}: {
  preview: ImagePreviewState | null;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    setScale(1);
  }, [preview?.src]);

  useEffect(() => {
    if (!preview) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, preview]);

  if (!preview) {
    return null;
  }

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    setScale((current) =>
      Math.min(4, Math.max(0.6, current + direction * 0.16)),
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 p-6 backdrop-blur-sm"
      onClick={onClose}
      onWheel={handleWheel}
      role="dialog"
      aria-modal="true"
    >
      <img
        src={preview.src}
        alt=""
        className="max-h-[88vh] max-w-[88vw] select-none rounded-[16px] object-contain shadow-[0_24px_70px_rgba(0,0,0,0.35)] transition-transform duration-100 ease-out"
        style={{ transform: `scale(${scale})` }}
        onClick={(event) => event.stopPropagation()}
        draggable={false}
      />
    </div>
  );
}

function ReadOnlyImageAttachmentItem({
  onPreview,
}: {
  onPreview: (preview: ImagePreviewState) => void;
}) {
  const attachment = useAttachment();
  const imagePart = attachment.content?.find(
    (part): part is { type: "image"; image: string; filename?: string } =>
      part.type === "image" && typeof part.image === "string",
  );

  if (!imagePart) {
    return <ReadOnlyAttachmentItem />;
  }

  const imageUrl = resolveAttachmentUrl(imagePart.image);

  return (
    <AttachmentPrimitive.Root
      className="block max-w-[min(100%,22rem)] overflow-hidden rounded-[14px] border border-border/70 bg-surface-primary shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
      onClick={() => onPreview({ src: imageUrl })}
    >
      <img
        src={imageUrl}
        alt=""
        className="block max-h-[18rem] min-h-24 w-full cursor-zoom-in object-cover"
        draggable={false}
      />
    </AttachmentPrimitive.Root>
  );
}

function MessageActions({
  allowEdit,
  allowReload,
  fadeOnHover,
  inline,
}: {
  allowEdit?: boolean;
  allowReload?: boolean;
  fadeOnHover?: boolean;
  inline?: boolean;
}) {
  const { t } = useTranslation();
  const aui = useAui();
  const { ragEnabled } = useCurrentThread();
  const canCopy = useAuiState((s) => s.thread.capabilities.unstable_copy);
  const canEdit = useAuiState((s) => s.thread.capabilities.edit);
  const canReload = useAuiState((s) => s.thread.capabilities.reload);
  const isLastMessage = useAuiState((s) => s.message.isLast);
  const messageId = useAuiState((s) => s.message.id);
  const messageParentId = useAuiState((s) => s.message.parentId);
  const messageRole = useAuiState((s) => s.message.role);
  const lastUserMessageId = useAuiState((s) => {
    for (let index = s.thread.messages.length - 1; index >= 0; index -= 1) {
      const candidate = s.thread.messages[index];
      if (candidate?.role === "user") {
        return candidate.id;
      }
    }

    return null;
  });
  const showCopy = canCopy;
  const showEdit = Boolean(allowEdit && canEdit);
  const showReload = Boolean(
    allowReload &&
    canReload &&
    ((messageRole === "assistant" && isLastMessage) ||
      (messageRole === "user" && messageId === lastUserMessageId)),
  );

  if (!showCopy && !showEdit && !showReload) {
    return null;
  }

  return (
    <div className={inline ? "" : "mt-1 h-6"}>
      {showCopy || showEdit || showReload ? (
        <ActionBarPrimitive.Root
          hideWhenRunning
          className={`inline-flex items-center gap-2 transition-opacity duration-150 ease-out ${
            fadeOnHover
              ? "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
              : "opacity-100"
          }`}
        >
          {showCopy ? (
            <ActionBarPrimitive.Copy asChild>
              <button
                type="button"
                className={actionButtonClassName}
                title={t("chat.thread.actions.copy")}
              >
                <MessagePrimitive.If copied>
                  <Check className="h-3.5 w-3.5" />
                </MessagePrimitive.If>
                <MessagePrimitive.If copied={false}>
                  <Copy className="h-3.5 w-3.5" />
                </MessagePrimitive.If>
              </button>
            </ActionBarPrimitive.Copy>
          ) : null}
          {showEdit ? (
            <button
              type="button"
              className={actionButtonClassName}
              title={t("chat.thread.actions.edit")}
              onClick={() => {
                aui.composer().beginEdit();
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {showReload ? (
            <button
              type="button"
              className={actionButtonClassName}
              title={t("chat.thread.actions.regenerate")}
              onClick={() => {
                if (messageRole === "assistant") {
                  if (!ragEnabled) {
                    aui.thread().startRun({
                      parentId: messageParentId ?? null,
                      sourceId: null,
                    });
                    return;
                  }

                  void aui.message().reload();
                  return;
                }

                if (messageRole === "user" && messageId) {
                  aui.thread().startRun({
                    parentId: messageId,
                    sourceId: null,
                  });
                }
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </ActionBarPrimitive.Root>
      ) : null}
    </div>
  );
}

function InlineEditComposer() {
  const { t } = useTranslation();
  const attachmentSupported = useAuiState(
    (s) => s.thread.capabilities.attachments,
  );

  return (
    <MessagePrimitive.Root className="flex justify-end px-0 py-2 sm:py-2.5">
      <div className="w-full max-w-[min(100%,34rem)]">
        <ComposerPrimitive.Root className="overflow-hidden rounded-[18px] border border-primary/20 bg-surface-primary shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap gap-2 border-b border-border/70 px-4 py-3 empty:hidden">
            <ComposerPrimitive.Attachments>
              {() => <ComposerAttachmentItem />}
            </ComposerPrimitive.Attachments>
          </div>
          <ComposerPrimitive.Input
            className="min-h-[88px] w-full resize-none bg-transparent px-4 py-3 text-sm leading-7 text-text-primary placeholder:text-text-tertiary focus:outline-none"
            rows={4}
          />
          <div className="flex items-center justify-between gap-2 border-t border-border/70 px-3 py-3">
            <div className="flex items-center gap-2">
              {attachmentSupported ? (
                <ComposerPrimitive.AddAttachment asChild>
                  <button
                    type="button"
                    className={actionButtonClassName}
                    title={t("chat.thread.composer.attachmentMenu")}
                    aria-label={t("chat.thread.composer.attachmentMenu")}
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                  </button>
                </ComposerPrimitive.AddAttachment>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <ComposerPrimitive.Cancel className="rounded-full border border-border/70 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-secondary">
                {t("common.actions.cancel")}
              </ComposerPrimitive.Cancel>
              <ComposerPrimitive.Send className="rounded-full bg-text-primary px-3 py-1.5 text-xs font-medium text-text-inverted transition-colors hover:bg-text-primary/90">
                {t("common.actions.generate")}
              </ComposerPrimitive.Send>
            </div>
          </div>
        </ComposerPrimitive.Root>
      </div>
    </MessagePrimitive.Root>
  );
}

function MessageStatusNotice() {
  const { t } = useTranslation();
  const status = useAuiState((s) => s.message.status);

  if (!status || status.type !== "incomplete") {
    return null;
  }

  const errorText =
    typeof status.error === "string"
      ? status.error
      : status.error &&
          typeof status.error === "object" &&
          "message" in status.error &&
          typeof status.error.message === "string"
        ? status.error.message
        : null;

  return (
    <div className="mt-2 inline-flex max-w-full items-start gap-2 rounded-2xl border border-warning-border bg-warning-soft px-3 py-2 text-xs text-warning-text">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0">
        <div className="font-medium">{getStatusMessage(status.reason, t)}</div>
        {errorText ? (
          <div className="mt-0.5 break-words">{errorText}</div>
        ) : null}
      </div>
    </div>
  );
}

const UserMessage = () => {
  const [preview, setPreview] = useState<ImagePreviewState | null>(null);

  const imageAttachmentComponents = useMemo(
    () => ({
      Image: () => <ReadOnlyImageAttachmentItem onPreview={setPreview} />,
      Attachment: ReadOnlyAttachmentItem,
      Document: ReadOnlyAttachmentItem,
      File: ReadOnlyAttachmentItem,
    }),
    [],
  );

  return (
    <>
      <MessagePrimitive.Root className="group flex justify-end px-0 py-2 sm:py-2.5">
        <div className="flex max-w-[min(100%,34rem)] flex-col items-end">
          <MessagePrimitive.If hasAttachments>
            <div className="mb-2 flex flex-wrap justify-end gap-2">
              <MessagePrimitive.Attachments
                components={imageAttachmentComponents}
              />
            </div>
          </MessagePrimitive.If>
          <MessagePrimitive.If hasContent>
            <UserBubbleShell>
              <MessagePrimitive.Parts>
                {({ part }) => {
                  if (part.type === "text") {
                    return (
                      <p className="whitespace-pre-wrap break-words">
                        {part.text}
                      </p>
                    );
                  }

                  return null;
                }}
              </MessagePrimitive.Parts>
            </UserBubbleShell>
          </MessagePrimitive.If>
          <MessageActions allowEdit allowReload fadeOnHover />
        </div>
      </MessagePrimitive.Root>
      <ImagePreviewOverlay preview={preview} onClose={() => setPreview(null)} />
    </>
  );
};

const AssistantMessage = () => {
  const { t } = useTranslation();
  const { ragEnabled } = useCurrentThread();
  const {
    messagesById,
    persistedSourcesByMessageId,
    onOpenRagProgressDetail,
    onOpenRagSourceDetail,
  } = useThreadMessageRuntimeData();
  const messageId = useAuiState((s) => s.message.id);
  const messageContent = useAuiState((s) => s.message.content);
  const inlineSources = getRagSourcesFromContentParts(messageContent);
  const ragProgress = ragEnabled
    ? getRagProgressFromContentParts(messageContent)
    : [];
  const allSources =
    inlineSources.length > 0
      ? inlineSources
      : messageId
        ? (messagesById[messageId]?.metadata?.rag?.sources ??
          persistedSourcesByMessageId[messageId] ??
          [])
        : [];
  const sources = ragEnabled
    ? getVisibleRagSources(allSources, ragProgress)
    : [];

  return (
    <MessagePrimitive.Root className="group flex justify-start px-0 py-2 sm:py-2.5">
      <div className="flex w-full items-start gap-3">
        <AssistantAvatar />
        <div className="min-w-0 flex-1">
          <RagExecutionTrace
            messageId={messageId}
            steps={ragProgress}
            onOpenDetail={onOpenRagProgressDetail}
          />
          <AssistantBubbleShell>
            <MessagePrimitive.Parts
              components={{
                Empty: ({ status }) => {
                  if (status.type !== "running") {
                    return null;
                  }

                  return (
                    <div className="inline-flex items-center gap-3 text-sm text-text-secondary">
                      <div
                        className="flex items-center gap-1"
                        aria-hidden="true"
                      >
                        <span className="inline-flex h-1.5 w-1.5 animate-[typing-dot_1.1s_infinite_ease-in-out] rounded-full bg-text-secondary/85" />
                        <span className="inline-flex h-1.5 w-1.5 animate-[typing-dot_1.1s_infinite_ease-in-out_0.15s_both] rounded-full bg-text-secondary/72" />
                        <span className="inline-flex h-1.5 w-1.5 animate-[typing-dot_1.1s_infinite_ease-in-out_0.3s_both] rounded-full bg-text-secondary/60" />
                      </div>

                      <span
                        className="sr-only"
                        role="status"
                        aria-live="polite"
                      >
                        {t("chat.thread.assistantTyping")}
                      </span>
                    </div>
                  );
                },
                Text: () => (
                  <>
                    <MarkdownText className="prose prose-sm max-w-none break-words text-text-primary prose-headings:text-text-primary prose-headings:font-semibold prose-p:my-0 prose-p:text-text-primary prose-strong:text-text-primary prose-code:text-text-primary prose-pre:rounded-[12px] prose-pre:border prose-pre:border-border/60 prose-pre:bg-surface-secondary/92 prose-pre:text-text-primary prose-li:text-text-primary prose-blockquote:border-border prose-blockquote:text-text-secondary" />
                    <MessagePartPrimitive.InProgress>
                      <span className="ml-1 inline-block align-baseline text-text-tertiary">
                        ●
                      </span>
                    </MessagePartPrimitive.InProgress>
                  </>
                ),
              }}
            />
          </AssistantBubbleShell>
          <MessageStatusNotice />
          <div className="mt-1 flex items-center gap-2 pl-1">
            <MessageActions allowReload inline />
            {sources.length > 0 ? (
              <button
                type="button"
                onClick={() =>
                  onOpenRagSourceDetail({
                    messageId,
                    sources,
                  })
                }
                className="inline-flex h-7 items-center gap-2 rounded-[10px] border border-border/70 bg-surface-primary/92 px-3 text-[12px] text-text-secondary transition-colors hover:border-border hover:bg-surface-primary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              >
                <span>{t("chat.thread.sources.title")}</span>
                <span className="text-text-tertiary">{sources.length}</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

function ThreadContent() {
  const { t } = useTranslation();
  const isThreadEmpty = useAuiState((s) => s.thread.isEmpty);
  const isRunning = useAuiState((s) => s.thread.isRunning);
  const activeThreadId = useAuiState((s) => s.threads.mainThreadId);
  const threadMessages = useAuiState(
    (s) => s.thread.messages as readonly ThreadMessageLike[],
  );
  const { configMap, hasDefaultEmbedding, hasDefaultLlm } =
    useRoleModelConfigs();
  const { hasEnabledDocuments } = useKnowledgeBaseAvailability();
  const {
    ragEnabled,
    remoteId: resolvedThreadRemoteId,
    displayTitle: currentThreadTitle,
    loading: currentThreadLoading,
    toggleRagEnabled,
  } = useCurrentThread();
  const {
    persistedSourcesByMessageId,
    messagesById,
    hasSideDrawerOpen,
    selectedRagProgressDetail,
    selectedRagSourceDetail,
    openRagProgressDetail,
    openRagSourceDetail,
    closeRagProgressDetail,
    closeRagSourceDetail,
  } = useThreadRagRuntime({
    activeThreadId,
    isRunning,
    ragEnabled,
    remoteThreadId: resolvedThreadRemoteId,
    threadMessages,
  });

  const handleToggleRag = async () => {
    if (currentThreadLoading) {
      return;
    }

    try {
      await toggleRagEnabled();
    } catch {
      // CurrentThreadProvider remains the single source of truth.
    }
  };

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

  const { isSendDisabled, placeholder } = useThreadComposerState({
    isRunning,
    ragEnabled,
    hasDefaultLlm,
    hasDefaultEmbedding,
  });
  const isRagToggleDisabled =
    currentThreadLoading || (!ragEnabled && !hasEnabledDocuments);
  const ragStatusHint = isRunning
    ? t("chat.thread.composer.generating")
    : ragEnabled
      ? ""
      : !hasEnabledDocuments
        ? t("chat.thread.composer.ragUnavailableHint")
        : "";

  const threadMessageRuntimeData = useMemo(
    () => ({
      messagesById,
      persistedSourcesByMessageId,
      onOpenRagProgressDetail: openRagProgressDetail,
      onOpenRagSourceDetail: openRagSourceDetail,
    }),
    [
      messagesById,
      openRagProgressDetail,
      openRagSourceDetail,
      persistedSourcesByMessageId,
    ],
  );

  const messageComponents = useMemo(
    () => ({
      UserMessage,
      AssistantMessage,
      EditComposer: InlineEditComposer,
    }),
    [],
  );

  return (
    <div className="w-full">
      <ThreadPrimitive.Root className={shellClassName}>
        <style>{typingAnimationStyle}</style>
        <div className={backdropOrbsClassName} aria-hidden="true">
          <div className="absolute left-[-6rem] top-[-7rem] h-44 w-44 rounded-full bg-pampas-5/55 blur-3xl" />
          <div className="absolute right-[-8rem] top-10 h-52 w-52 rounded-full bg-pampas-4/60 blur-3xl" />
        </div>

        <div className="relative flex min-h-0 flex-1">
          <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-l-[28px] border border-border/70 bg-surface-secondary shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <ThreadHeader
              title={
                currentThreadTitle ||
                (isThreadEmpty
                  ? t("chat.thread.header.newConversation")
                  : t("chat.thread.header.untitledConversation"))
              }
              badges={modelBadges}
            />
            <ThreadPrimitive.Viewport className="stable-scrollbar relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto scroll-smooth bg-surface-secondary">
              <div
                key={activeThreadId}
                className="flex min-h-0 flex-1 flex-col bg-surface-secondary pt-14"
              >
                <div
                  className={`${contentColumnClassName} ${
                    hasSideDrawerOpen
                      ? "max-w-3xl xl:max-w-3xl"
                      : "max-w-3xl xl:max-w-4xl"
                  }`}
                >
                  <WelcomeEmptyState
                    activeThreadId={activeThreadId}
                    isVisible={isThreadEmpty}
                  />

                  <ThreadMessageRuntimeContext.Provider
                    value={threadMessageRuntimeData}
                  >
                    <ThreadPrimitive.Messages components={messageComponents} />
                  </ThreadMessageRuntimeContext.Provider>
                </div>
              </div>
            </ThreadPrimitive.Viewport>

            <ThreadComposer
              hasRagProgressDrawerOpen={hasSideDrawerOpen}
              placeholder={placeholder}
              isSendDisabled={isSendDisabled}
              ragEnabled={ragEnabled}
              isRagToggleDisabled={isRagToggleDisabled}
              ragStatusHint={ragStatusHint}
              onToggleRag={handleToggleRag}
            />
          </div>

          <RagProgressDetailDrawer
            open={!!selectedRagProgressDetail}
            detail={selectedRagProgressDetail}
            onClose={closeRagProgressDetail}
          />
          <RagSourceDetailDrawer
            open={!!selectedRagSourceDetail}
            detail={selectedRagSourceDetail}
            onClose={closeRagSourceDetail}
          />
        </div>
      </ThreadPrimitive.Root>
    </div>
  );
}

export default ThreadContent;
