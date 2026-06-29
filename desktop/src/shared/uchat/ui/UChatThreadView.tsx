"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  ArrowUp,
  Bot,
  Copy,
  FileUp,
  Folder,
  LibraryBig,
  MessageSquareText,
  Paperclip,
  Plus,
  PencilLine,
  RefreshCcw,
  UserRound,
  Square,
  X,
} from "lucide-react";
import type {
  ChatComposerAction,
  ChatComposerState,
  ChatMessage,
  ChatMessagePresentationHints,
  ChatMessagePart,
  ChatRunStatus,
  ChatRuntimeCapabilities,
  ChatThreadContextTag,
} from "../core";
import ImagePreviewOverlay from "@/shared/ui/ImagePreviewOverlay";
import MarkdownText from "@/shared/ui/MarkdownText";
import Badge from "@/shared/ui/Badge";
import DropdownMenu from "@/shared/ui/DropdownMenu";
import Tooltip from "@/shared/ui/Tooltip";
import { Button } from "@/shared/ui";
import { copyTextToClipboard } from "@/shared/lib/clipboard";
import { message as uiMessage } from "@/shared/ui/Message";
import {
  getExecutionFailurePresentation,
  getExecutionProgressFromRenderableParts,
  getVisibleExecutionSources,
  toUChatRenderableParts,
  type UChatExecutionProgressDetail,
  type UChatExecutionSourceDetail,
} from "./executionParsers";
import type { RagNodeLike, RagSourceLike } from "./ragTypes";
import {
  UChatAssistantAvatar,
  UChatAssistantBubbleShell,
  UChatUserBubbleShell,
} from "./UChatMessageBubbleShells";
import { UChatExecutionTrace } from "./UChatExecutionTrace";
import { UChatRagProgressDetailDrawer } from "./UChatRagProgressDetailDrawer";
import { UChatRagSourceDetailDrawer } from "./UChatRagSourceDetailDrawer";
import { UChatThreadHeader } from "./UChatThreadHeader";
import { UChatToolTrace } from "./UChatToolTrace";
import { UChatWelcomeEmptyState } from "./UChatWelcomeEmptyState";

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

type DisplayMessagePart = Exclude<ChatMessagePart, { type: "data" }>;

type EditingAttachmentPart = Extract<DisplayMessagePart, { type: "image" | "file" }>;

const buildEditedUserMessageParts = (
  originalParts: DisplayMessagePart[],
  nextText: string,
  removedAttachmentKeys: Set<string> = new Set(),
): DisplayMessagePart[] => {
  const trimmedText = nextText.trim();
  const nextParts: DisplayMessagePart[] = [];

  if (trimmedText) {
    nextParts.push({
      type: "text",
      text: trimmedText,
    });
  }

  return [
    ...nextParts,
    ...originalParts.filter((part): part is EditingAttachmentPart => {
      if (part.type !== "image" && part.type !== "file") {
        return false;
      }

      return true;
    }).filter((part, index) => !removedAttachmentKeys.has(`${part.type}-${index}`)),
  ];
};

const attachmentPlaceholderPattern = /\[(?:Image|File) attachment:[^\]]+\]/g;

const stripAttachmentPlaceholders = (text: string) =>
  text.replace(attachmentPlaceholderPattern, "").replace(/\n{3,}/g, "\n\n");

const imageFileExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".avif",
]);

const isImageFile = (file: File) =>
  file.type.startsWith("image/") ||
  imageFileExtensions.has(
    `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`,
  );

const widthClassMap = {
  compact: "max-w-[min(100%,28rem)] xl:max-w-[min(100%,30rem)]",
  regular: "max-w-[min(100%,38rem)] xl:max-w-[min(100%,42rem)]",
  wide: "max-w-[min(100%,46rem)] xl:max-w-[min(100%,52rem)]",
} as const;

const resolveBubbleWidthClassName = (
  width: ChatMessagePresentationHints["assistantMaxWidth"] | undefined,
) => widthClassMap[width ?? "regular"];

const collapseDisplayParts = (
  parts: ChatMessagePart[],
): DisplayMessagePart[] => {
  const collapsed: DisplayMessagePart[] = [];

  for (const part of parts) {
    if (part.type === "data") {
      continue;
    }

    const lastPart = collapsed.at(-1);
    if (part.type === "text" && lastPart?.type === "text") {
      const sanitizedText = stripAttachmentPlaceholders(part.text);
      if (!sanitizedText) {
        continue;
      }

      lastPart.text += sanitizedText;
      continue;
    }

    if (part.type === "text") {
      const sanitizedText = stripAttachmentPlaceholders(part.text);
      if (!sanitizedText) {
        continue;
      }

      collapsed.push({ type: "text", text: sanitizedText });
      continue;
    }

    collapsed.push(part);
  }

  return collapsed;
};

// MessagePartContent renders one canonical message part into visible content.
function MessagePartContent({
  part,
  preferMarkdownForText,
  resolveAttachmentSource,
  onPreviewImage,
  onLoadMedia,
}: {
  part: ChatMessagePart;
  preferMarkdownForText: boolean;
  resolveAttachmentSource: (value: string) => string;
  onPreviewImage: (value: ImagePreviewState) => void;
  onLoadMedia?: () => void;
}) {
  if (part.type === "text") {
    if (preferMarkdownForText) {
      return <MarkdownText className="text-[15px]">{part.text}</MarkdownText>;
    }

    return <p className="whitespace-pre-wrap break-words">{part.text}</p>;
  }

  if (part.type === "image") {
    const imageUrl = resolveAttachmentSource(part.source);
    return (
      <button
        type="button"
        className="mb-2 block max-w-[min(100%,22rem)] overflow-hidden rounded-[14px] border border-border/70 bg-surface-primary shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
        onClick={() => onPreviewImage({ src: imageUrl })}
      >
        <img
          src={imageUrl}
          alt={part.name ?? ""}
          className="block max-h-[18rem] min-h-24 w-full cursor-zoom-in object-cover"
          onLoad={onLoadMedia}
          draggable={false}
        />
      </button>
    );
  }

  if (part.type === "file") {
    return (
      <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-2xl border border-border/70 bg-surface-primary/92 px-3 py-2 text-xs text-text-secondary shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <FileUp className="h-4 w-4 shrink-0" />
        <span className="min-w-0 truncate font-medium text-text-primary">
          {part.name}
        </span>
      </div>
    );
  }

  return null;
}

// UChatThreadView is the pure presentational thread surface. It receives a
// fully prepared view model and emits user intents through callbacks.
export function UChatThreadView({
  activeThreadId,
  title,
  badges,
  messages,
  composer,
  runStatus,
  threadStatus,
  capabilities,
  hasKnowledgeBase,
  placeholder,
  isSendDisabled,
  onComposerTextChange,
  onComposerAttachmentsChange,
  onComposerAttachmentsAppend,
  onComposerAttachmentRemove,
  onSend,
  onAgentSend,
  onApproveAgentRun,
  onRejectAgentRun,
  onCancelSend,
  onRegenerate,
  onEditUserMessage,
  onComposerAction,
  threadContextTags,
  onRemoveThreadContextTag,
  resolveAttachmentSource,
  assistantAvatarSrc,
  assistantDisplayName,
  assistantTypingLabel,
  isAgentRunning,
  agentEnabled,
  agentAvailability,
  onToggleAgentEnabled,
}: {
  activeThreadId: string | null;
  title: string;
  badges: Array<{
    key: string;
    name: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  }>;
  messages: ChatMessage[];
  composer: ChatComposerState;
  runStatus: ChatRunStatus;
  threadStatus: "idle" | "loading" | "ready" | "error";
  capabilities: ChatRuntimeCapabilities;
  hasKnowledgeBase: boolean;
  placeholder: string;
  isSendDisabled: boolean;
  onComposerTextChange: (value: string) => void;
  onComposerAttachmentsChange: (files: File[]) => void;
  onComposerAttachmentsAppend?: (files: File[]) => void | Promise<void>;
  onComposerAttachmentRemove?: (attachmentId: string) => void | Promise<void>;
  onSend: () => void | Promise<void>;
  onAgentSend?: () => void | Promise<void>;
  onApproveAgentRun?: (runId: string) => void | Promise<void>;
  onRejectAgentRun?: (runId: string) => void | Promise<void>;
  onCancelSend?: () => void | Promise<void>;
  onRegenerate?: (messageId: string) => void | Promise<void>;
  onEditUserMessage?: (
    messageId: string,
    text: string,
    parts?: DisplayMessagePart[],
  ) => void | Promise<void>;
  onComposerAction: (action: ChatComposerAction) => void | Promise<void>;
  threadContextTags: ChatThreadContextTag[];
  onRemoveThreadContextTag?: (
    tag: ChatThreadContextTag,
  ) => void | Promise<void>;
  resolveAttachmentSource: (value: string) => string;
  assistantAvatarSrc?: string | null;
  assistantDisplayName?: string;
  assistantTypingLabel?: string;
  isAgentRunning?: boolean;
  agentEnabled?: boolean;
  agentAvailability?: {
    enabled: boolean;
    disabledReason?: string;
  };
  onToggleAgentEnabled?: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const isRunning = runStatus.type === "running";
  const [imagePreview, setImagePreview] = useState<ImagePreviewState | null>(
    null,
  );
  const [selectedRagProgressDetail, setSelectedRagProgressDetail] =
    useState<UChatExecutionProgressDetail | null>(null);
  const [selectedRagSourceDetail, setSelectedRagSourceDetail] =
    useState<UChatExecutionSourceDetail | null>(null);
  const [agentRunActionState, setAgentRunActionState] = useState<{
    runId: string;
    action: "approve" | "reject";
  } | null>(null);
  const [agentRunActionError, setAgentRunActionError] = useState<{
    runId: string;
    message: string;
  } | null>(null);
  const [editingUserMessage, setEditingUserMessage] = useState<{
    id: string;
    draftText: string;
    originalText: string;
  } | null>(null);
  const messagePresentation = capabilities.messagePresentation ?? {};
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const isRunningRef = useRef(isRunning);

  const scrollToBottom = () => {
    const viewport = scrollViewportRef.current;
    if (!viewport) {
      return;
    }

    viewport.scrollTop = viewport.scrollHeight;
  };

  const requestScrollToBottom = () => {
    shouldStickToBottomRef.current = true;
    scrollToBottom();
  };

  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) {
      return;
    }

    const handleScroll = () => {
      const distanceToBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      shouldStickToBottomRef.current = distanceToBottom <= 48;
    };

    handleScroll();
    viewport.addEventListener("scroll", handleScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    setSelectedRagProgressDetail(null);
    setSelectedRagSourceDetail(null);
    setAgentRunActionError(null);
  }, [activeThreadId]);

  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport || !shouldStickToBottomRef.current) {
      return;
    }

    scrollToBottom();
  }, [activeThreadId, messages, runStatus.type]);

  return (
    <div className="w-full">
      <div className={shellClassName}>
        <div className={backdropOrbsClassName} aria-hidden="true">
          <div className="absolute left-[-6rem] top-[-7rem] h-44 w-44 rounded-full bg-pampas-5/55 blur-3xl" />
          <div className="absolute right-[-8rem] top-10 h-52 w-52 rounded-full bg-pampas-4/60 blur-3xl" />
        </div>

        <div className="relative flex min-h-0 flex-1">
          <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-l-[28px] border border-border/70 bg-surface-secondary shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <UChatThreadHeader title={title} badges={badges} />

            <div className="relative flex min-h-0 min-w-0 flex-1">
              <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
                <div
                  ref={scrollViewportRef}
                  className="stable-scrollbar relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-surface-secondary"
                >
                  <div
                    key={activeThreadId ?? "empty-thread"}
                    className="flex min-h-0 flex-1 flex-col bg-surface-secondary pt-14"
                  >
                    <div
                      className={`${contentColumnClassName} max-w-3xl xl:max-w-4xl`}
                    >
                      <UChatWelcomeEmptyState
                        activeThreadId={activeThreadId}
                        isVisible={messages.length === 0}
                      />

                      {threadStatus === "loading" && messages.length === 0 ? (
                        <div className="py-6 text-sm text-text-secondary">
                          {t("common.status.loading")}
                        </div>
                      ) : null}

                      {messages.map((message) => (
                      <UChatMessageRow
                          key={message.id}
                          message={message}
                          isRunning={isRunning}
                          assistantAvatarSrc={assistantAvatarSrc}
                          assistantDisplayName={assistantDisplayName}
                          assistantTypingLabel={assistantTypingLabel}
                          isAgentRunning={isAgentRunning}
                          editingUserMessage={editingUserMessage}
                          messagePresentation={messagePresentation}
                          resolveAttachmentSource={resolveAttachmentSource}
                          onRequestScrollToBottom={requestScrollToBottom}
                          onPreviewImage={setImagePreview}
                          onOpenProgressDetail={(detail) => {
                            setSelectedRagSourceDetail(null);
                            setSelectedRagProgressDetail(detail);
                          }}
                          onOpenSourceDetail={(detail) => {
                            setSelectedRagProgressDetail(null);
                            setSelectedRagSourceDetail(detail);
                          }}
                          onRegenerate={onRegenerate}
                          onApproveAgentRun={onApproveAgentRun}
                          onRejectAgentRun={onRejectAgentRun}
                          agentRunActionState={agentRunActionState}
                          onAgentRunActionStateChange={setAgentRunActionState}
                          agentRunActionError={agentRunActionError}
                          onAgentRunActionErrorChange={setAgentRunActionError}
                          onEditUserMessage={onEditUserMessage}
                          onRequestEditUserMessage={(messageId, text) => {
                            setEditingUserMessage({
                              id: messageId,
                              draftText: text,
                              originalText: text,
                            });
                          }}
                          onUpdateEditUserMessage={(messageId, text) => {
                            setEditingUserMessage((current) =>
                              current?.id === messageId
                                ? {
                                    ...current,
                                    draftText: text,
                                  }
                                : current,
                            );
                          }}
                          onResetEditUserMessage={(messageId) => {
                            setEditingUserMessage((current) =>
                              current?.id === messageId
                                ? {
                                    ...current,
                                    draftText: current.originalText,
                                  }
                                : current,
                            );
                          }}
                          onCancelEditUserMessage={() =>
                            setEditingUserMessage(null)
                          }
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
                  <div className="bg-gradient-to-t from-surface-secondary via-surface-secondary/95 to-transparent px-4 pb-5 pt-8 sm:px-6 lg:px-8">
                    <div className="pointer-events-auto mx-auto w-full max-w-3xl xl:max-w-4xl">
                      <div className="overflow-hidden rounded-[24px] border border-cloudy-4/70 bg-pampas-2/90 shadow-[0_8px_22px_rgba(15,23,42,0.035)] backdrop-blur-xl">
                        {composer.attachments.length > 0 ? (
                          <div className="flex flex-wrap gap-2 border-b border-cloudy-4/55 px-4 pb-3 pt-3">
                            {composer.attachments.map((attachment) => (
                              <div
                                key={attachment.id}
                                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface-primary/92 px-3 py-1.5 text-xs text-text-secondary"
                              >
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-surface-secondary text-text-secondary">
                                  <Paperclip className="h-3 w-3" />
                                </span>
                                <span className="max-w-44 truncate font-medium text-text-primary">
                                  {attachment.file.name}
                                </span>
                                <button
                                  type="button"
                                  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-surface-secondary hover:text-text-primary focus-visible:outline-none"
                                  aria-label={`Remove ${attachment.file.name}`}
                                  onClick={() => {
                                    void onComposerAttachmentRemove?.(
                                      attachment.id,
                                    );
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        <textarea
                          value={composer.text}
                          onChange={(event) =>
                            onComposerTextChange(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && event.ctrlKey) {
                              event.preventDefault();
                              requestScrollToBottom();
                              void onSend();
                            }
                          }}
                          onPaste={(event) => {
                            const files = Array.from(
                              event.clipboardData?.files ?? [],
                            ).filter(isImageFile);

                            if (files.length > 0) {
                              event.preventDefault();
                              void onComposerAttachmentsAppend?.(files);
                            }
                          }}
                          placeholder={placeholder}
                          className={`min-h-[40px] w-full resize-none bg-transparent px-4 py-2.5 text-[15px] leading-6 text-text-primary placeholder:text-cloudy-6 focus:outline-none ${
                            isSendDisabled
                              ? "cursor-not-allowed opacity-60"
                              : ""
                          }`}
                          rows={3}
                          disabled={isSendDisabled}
                        />

                        <UChatComposerActions
                          composerActions={capabilities.composerActions ?? []}
                          threadContextTags={threadContextTags}
                          isRunning={isRunning}
                          isSendDisabled={isSendDisabled}
                          agentEnabled={agentEnabled}
                          agentAvailability={agentAvailability}
                          onComposerAction={onComposerAction}
                          onRemoveThreadContextTag={onRemoveThreadContextTag}
                          onToggleAgentEnabled={onToggleAgentEnabled}
                          onSend={() => {
                            requestScrollToBottom();
                            return onSend();
                          }}
                          onAgentSend={
                            onAgentSend
                              ? () => {
                                  requestScrollToBottom();
                                  return onAgentSend();
                                }
                              : undefined
                          }
                          onCancelSend={onCancelSend}
                          onComposerAttachmentsChange={
                            onComposerAttachmentsChange
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <UChatRagProgressDetailDrawer
                open={selectedRagProgressDetail !== null}
                detail={selectedRagProgressDetail}
                onClose={() => setSelectedRagProgressDetail(null)}
              />
              <UChatRagSourceDetailDrawer
                open={selectedRagSourceDetail !== null}
                detail={selectedRagSourceDetail}
                onClose={() => setSelectedRagSourceDetail(null)}
              />
            </div>
          </div>
        </div>
      </div>

      <ImagePreviewOverlay
        open={Boolean(imagePreview)}
        src={imagePreview?.src ?? null}
        onClose={() => setImagePreview(null)}
      />
    </div>
  );
}

// UChatMessageRow renders either a user or assistant message row from the
// canonical message model.
function UChatMessageRow({
  message,
  isRunning,
  assistantAvatarSrc,
  assistantDisplayName,
  assistantTypingLabel,
  isAgentRunning,
  editingUserMessage,
  messagePresentation,
  resolveAttachmentSource,
  onPreviewImage,
  onOpenProgressDetail,
  onOpenSourceDetail,
  onRegenerate,
  onApproveAgentRun,
  onRejectAgentRun,
  agentRunActionState,
  onAgentRunActionStateChange,
  agentRunActionError,
  onAgentRunActionErrorChange,
  onEditUserMessage,
  onRequestEditUserMessage,
  onUpdateEditUserMessage,
  onResetEditUserMessage,
  onCancelEditUserMessage,
  onRequestScrollToBottom,
}: {
  message: ChatMessage;
  isRunning: boolean;
  assistantAvatarSrc?: string | null;
  assistantDisplayName?: string;
  assistantTypingLabel?: string;
  isAgentRunning?: boolean;
  editingUserMessage: {
    id: string;
    draftText: string;
    originalText: string;
  } | null;
  messagePresentation: ChatMessagePresentationHints;
  resolveAttachmentSource: (value: string) => string;
  onPreviewImage: (value: ImagePreviewState) => void;
  onOpenProgressDetail: (detail: UChatExecutionProgressDetail) => void;
  onOpenSourceDetail: (detail: UChatExecutionSourceDetail) => void;
  onRegenerate?: (messageId: string) => void | Promise<void>;
  onApproveAgentRun?: (runId: string) => void | Promise<void>;
  onRejectAgentRun?: (runId: string) => void | Promise<void>;
  agentRunActionState: {
    runId: string;
    action: "approve" | "reject";
  } | null;
  onAgentRunActionStateChange: (
    state: { runId: string; action: "approve" | "reject" } | null,
  ) => void;
  agentRunActionError: {
    runId: string;
    message: string;
  } | null;
  onAgentRunActionErrorChange: (
    state: { runId: string; message: string } | null,
  ) => void;
  onEditUserMessage?: (
    messageId: string,
    text: string,
    parts?: DisplayMessagePart[],
  ) => void | Promise<void>;
  onRequestEditUserMessage?: (messageId: string, text: string) => void;
  onUpdateEditUserMessage?: (messageId: string, text: string) => void;
  onResetEditUserMessage?: (messageId: string) => void;
  onCancelEditUserMessage?: () => void;
  onRequestScrollToBottom: () => void;
}) {
  const { t } = useTranslation();
  const ragProgress = useMemo(
    () =>
      getExecutionProgressFromRenderableParts(
        toUChatRenderableParts(message),
      ) as RagNodeLike[],
    [message],
  );
  const metadataSources = Array.isArray(
    message.metadata?.rag &&
      typeof message.metadata.rag === "object" &&
      !Array.isArray(message.metadata.rag)
      ? (message.metadata.rag as { sources?: unknown }).sources
      : undefined,
  )
    ? (((message.metadata?.rag as { sources?: unknown }).sources ??
        []) as RagSourceLike[])
    : [];
  const sources = getVisibleExecutionSources(metadataSources, ragProgress);
  const textAndMediaParts = useMemo(
    () => collapseDisplayParts(message.parts),
    [message.parts],
  );
  const failurePresentation =
    message.status === "error"
    ? getExecutionFailurePresentation(ragProgress, message.errorMessage)
      : null;
  const toolTraceEntries = message.toolTrace ?? [];
  const agentMetadata =
    message.metadata?.agent &&
    typeof message.metadata.agent === "object" &&
    !Array.isArray(message.metadata.agent)
      ? (message.metadata.agent as {
          status?: "waiting_approval" | "blocked" | "completed" | "failed";
          runId?: string;
          pendingApproval?: { toolId?: string; reason?: string };
          errorMessage?: string | null;
        })
      : null;
  const agentStatusTone =
    agentMetadata?.status === "blocked"
      ? {
          containerClassName: "border border-rose-200 bg-rose-50 text-rose-700",
          detailClassName: "text-rose-700/90",
        }
      : agentMetadata?.status === "failed"
        ? {
            containerClassName:
              "border border-amber-200 bg-amber-50 text-amber-700",
            detailClassName: "text-amber-700/90",
          }
        : {
            containerClassName: "border border-sky-200 bg-sky-50 text-sky-700",
            detailClassName: "text-sky-700/90",
          };
  const hasExecutionTrace = ragProgress.length > 0;
  const isApprovingAgentRun =
    typeof agentRunActionState?.runId === "string" &&
    agentRunActionState.runId === agentMetadata?.runId &&
    agentRunActionState.action === "approve";
  const isRejectingAgentRun =
    typeof agentRunActionState?.runId === "string" &&
    agentRunActionState.runId === agentMetadata?.runId &&
    agentRunActionState.action === "reject";
  const agentRunInlineError =
    typeof agentRunActionError?.runId === "string" &&
    agentRunActionError.runId === agentMetadata?.runId
      ? agentRunActionError.message
      : null;
  const preferMarkdownForText =
    messagePresentation.preferMarkdownForText !== false;
  const assistantBubbleWidthClassName = resolveBubbleWidthClassName(
    messagePresentation.assistantMaxWidth,
  );
  const userBubbleWidthClassName = resolveBubbleWidthClassName(
    messagePresentation.userMaxWidth,
  );

  if (message.role === "user") {
    const isEditingThisMessage = editingUserMessage?.id === message.id;

    if (isEditingThisMessage && editingUserMessage) {
      return (
        <div className="group flex justify-end px-0 py-2 sm:py-2.5">
          <div
            className={`flex ${userBubbleWidthClassName} w-full max-w-[min(100%,34rem)] flex-col items-end`}
          >
            <InlineUserMessageEditor
              parts={textAndMediaParts}
              value={editingUserMessage.draftText}
              resolveAttachmentSource={resolveAttachmentSource}
              onChange={(value) => onUpdateEditUserMessage?.(message.id, value)}
              onCancel={() => onCancelEditUserMessage?.()}
              onSubmit={(nextParts) => {
                onCancelEditUserMessage?.();
                void onEditUserMessage?.(
                  message.id,
                  editingUserMessage.draftText,
                  nextParts,
                );
              }}
              onReset={() => onResetEditUserMessage?.(message.id)}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="group flex justify-end px-0 py-2 sm:py-2.5">
        <div className={`flex ${userBubbleWidthClassName} flex-col items-end`}>
          <UChatUserBubbleShell>
            {textAndMediaParts.map((part, index) => (
              <MessagePartContent
                key={`${message.id}-${part.type}-${index}`}
                part={part}
                preferMarkdownForText={preferMarkdownForText}
                resolveAttachmentSource={resolveAttachmentSource}
                onPreviewImage={onPreviewImage}
                onLoadMedia={onRequestScrollToBottom}
              />
            ))}
          </UChatUserBubbleShell>
          <div className=" transition-all duration-150 opacity-0 group-hover:opacity-100 group-hover:flex group-hover:items-center group-hover:gap-2">
            <button
              type="button"
              className="mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-surface-primary/92 text-text-secondary transition-colors hover:border-border hover:bg-surface-primary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              onClick={() => {
                const content = textAndMediaParts
                  .filter(
                    (
                      part,
                    ): part is Extract<ChatMessagePart, { type: "text" }> =>
                      part.type === "text",
                  )
                  .map((part) => part.text)
                  .join("\n");
                void copyTextToClipboard(content)
                  .then((ok) => {
                    uiMessage[ok ? "success" : "error"](
                      ok
                        ? t("chat.thread.actions.copySuccess")
                        : t("chat.thread.actions.copyFailed"),
                    );
                  })
                  .catch(() => {
                    uiMessage.error(t("chat.thread.actions.copyFailed"));
                  });
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            {onEditUserMessage ? (
              <button
                type="button"
                className="mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-surface-primary/92 text-text-secondary transition-colors hover:border-border hover:bg-surface-primary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                onClick={() => {
                  const content = textAndMediaParts
                    .filter(
                      (
                        part,
                      ): part is Extract<ChatMessagePart, { type: "text" }> =>
                        part.type === "text",
                    )
                    .map((part) => part.text)
                    .join("\n");
                  onRequestEditUserMessage?.(message.id, content);
                }}
                aria-label={t("chat.thread.actions.edit")}
                title={t("chat.thread.actions.edit")}
              >
                <PencilLine className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex justify-start px-0 py-2 sm:py-2.5">
      <div className="flex w-full items-start gap-3">
        <UChatAssistantAvatar
          src={assistantAvatarSrc}
          name={assistantDisplayName}
        />
        <div className={`min-w-0 ${assistantBubbleWidthClassName}`}>
          <UChatExecutionTrace
            messageId={message.id}
            steps={ragProgress}
            onOpenDetail={onOpenProgressDetail}
          />
          <UChatAssistantBubbleShell>
            {textAndMediaParts.length === 0 && isRunning ? (
              <div className="inline-flex items-center gap-2 text-sm text-text-secondary">
                <span
                  className="inline-flex items-center gap-1"
                  aria-hidden="true"
                >
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-secondary/85" />
                  <span
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-secondary/85"
                    style={{ animationDelay: "120ms" }}
                  />
                  <span
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-secondary/85"
                    style={{ animationDelay: "240ms" }}
                  />
                </span>
                <span>
                  {isAgentRunning
                    ? t("chat.thread.agent.running")
                    : assistantTypingLabel ?? t("chat.thread.assistantTyping")}
                </span>
              </div>
            ) : null}

            {textAndMediaParts.map((part, index) => (
              <MessagePartContent
                key={`${message.id}-${part.type}-${index}`}
                part={part}
                preferMarkdownForText={preferMarkdownForText}
                resolveAttachmentSource={resolveAttachmentSource}
                onPreviewImage={onPreviewImage}
                onLoadMedia={onRequestScrollToBottom}
              />
            ))}

            {failurePresentation ? (
              <div
                className={`${
                  textAndMediaParts.length > 0 ? "mt-3" : ""
                } inline-flex max-w-full items-start gap-2 rounded-2xl border border-warning-border bg-warning-soft px-3 py-2.5 text-sm text-warning-text`}
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium">{failurePresentation.title}</div>
                  {failurePresentation.detail ? (
                    <div className="mt-1 break-words text-xs text-warning-text/90">
                      {failurePresentation.detail}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {agentMetadata?.status === "waiting_approval" ||
            agentMetadata?.status === "blocked" ||
            (agentMetadata?.status === "failed" && !failurePresentation) ? (
              <div
                className={`inline-flex max-w-full items-start gap-2 rounded-2xl px-3 py-2.5 text-sm ${agentStatusTone.containerClassName}`}
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium">
                    {agentMetadata.status === "blocked"
                      ? t("chat.thread.agent.blockedTitle")
                      : agentMetadata.status === "failed"
                        ? t("chat.thread.agent.failedTitle")
                        : t("chat.thread.agent.waitingApprovalTitle")}
                  </div>
                  <div
                    className={`mt-1 break-words text-xs ${agentStatusTone.detailClassName}`}
                  >
                    {agentMetadata.status === "blocked"
                      ? agentMetadata.errorMessage ??
                        t("chat.thread.agent.blockedDetail")
                      : agentMetadata.status === "failed"
                        ? agentMetadata.errorMessage ??
                          t("chat.thread.agent.failedDetail")
                        : agentMetadata.pendingApproval?.reason ??
                          t("chat.thread.agent.waitingApprovalDetail")}
                  </div>
                  {agentMetadata.status === "waiting_approval" &&
                  typeof agentMetadata.runId === "string" ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        className="min-w-[4.5rem] justify-center"
                        disabled={isApprovingAgentRun || isRejectingAgentRun}
                        onClick={() => {
                          onAgentRunActionErrorChange(null);
                          onAgentRunActionStateChange({
                            runId: agentMetadata.runId as string,
                            action: "approve",
                          });
                          void Promise.resolve(
                            onApproveAgentRun?.(agentMetadata.runId as string),
                          )
                            .catch((error) => {
                              onAgentRunActionErrorChange({
                                runId: agentMetadata.runId as string,
                                message:
                                  error instanceof Error
                                    ? error.message
                                    : t("chat.thread.agent.approveFailed"),
                              });
                            })
                            .finally(() => {
                              onAgentRunActionStateChange(null);
                            });
                        }}
                      >
                        {isApprovingAgentRun
                          ? t("chat.thread.agent.approving")
                          : t("common.actions.approve")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-w-[4.5rem] justify-center"
                        disabled={isApprovingAgentRun || isRejectingAgentRun}
                        onClick={() => {
                          onAgentRunActionErrorChange(null);
                          onAgentRunActionStateChange({
                            runId: agentMetadata.runId as string,
                            action: "reject",
                          });
                          void Promise.resolve(
                            onRejectAgentRun?.(agentMetadata.runId as string),
                          )
                            .catch((error) => {
                              onAgentRunActionErrorChange({
                                runId: agentMetadata.runId as string,
                                message:
                                  error instanceof Error
                                    ? error.message
                                    : t("chat.thread.agent.rejectFailed"),
                              });
                            })
                            .finally(() => {
                              onAgentRunActionStateChange(null);
                            });
                        }}
                      >
                        {isRejectingAgentRun
                          ? t("chat.thread.agent.rejecting")
                          : t("common.actions.reject")}
                      </Button>
                    </div>
                  ) : null}
                  {agentRunInlineError ? (
                    <div className="mt-2 break-words text-xs text-rose-700/90">
                      {agentRunInlineError}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {toolTraceEntries.length > 0 && !hasExecutionTrace ? (
              <UChatToolTrace entries={toolTraceEntries} />
            ) : null}
          </UChatAssistantBubbleShell>

          <div className="mt-1 flex items-center gap-2 pl-1">
            <button
              type="button"
              className={actionButtonClassName}
              onClick={() => {
                const content = textAndMediaParts
                  .filter(
                    (
                      part,
                    ): part is Extract<ChatMessagePart, { type: "text" }> =>
                      part.type === "text",
                  )
                  .map((part) => part.text)
                  .join("\n");
                void copyTextToClipboard(content)
                  .then((ok) => {
                    uiMessage[ok ? "success" : "error"](
                      ok
                        ? t("chat.thread.actions.copySuccess")
                        : t("chat.thread.actions.copyFailed"),
                    );
                  })
                  .catch(() => {
                    uiMessage.error(t("chat.thread.actions.copyFailed"));
                  });
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            {onRegenerate ? (
              <button
                type="button"
                onClick={() => {
                  void onRegenerate(message.id);
                }}
                className={actionButtonClassName}
                aria-label={t("chat.thread.actions.regenerate")}
                title={t("chat.thread.actions.regenerate")}
              >
                <RefreshCcw className="h-3.5 w-3.5" />
              </button>
            ) : null}

            {sources.length > 0 ? (
              <button
                type="button"
                onClick={() =>
                  onOpenSourceDetail({
                    messageId: message.id,
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
    </div>
  );
}

function InlineUserMessageEditor({
  parts,
  value,
  resolveAttachmentSource,
  onChange,
  onCancel,
  onSubmit,
  onReset,
}: {
  parts: DisplayMessagePart[];
  value: string;
  resolveAttachmentSource: (value: string) => string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: (parts: DisplayMessagePart[]) => void | Promise<void>;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const [removedAttachmentKeys, setRemovedAttachmentKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const attachmentParts = parts.filter(
    (part): part is Extract<DisplayMessagePart, { type: "image" | "file" }> =>
      part.type === "image" || part.type === "file",
  );
  const visibleAttachmentParts = attachmentParts.filter(
    (part, index) => !removedAttachmentKeys.has(`${part.type}-${index}`),
  );
  const visibleImageAttachmentParts = visibleAttachmentParts.filter(
    (part): part is Extract<DisplayMessagePart, { type: "image" }> =>
      part.type === "image",
  );
  const visibleFileAttachmentParts = visibleAttachmentParts.filter(
    (part): part is Extract<DisplayMessagePart, { type: "file" }> =>
      part.type === "file",
  );

  useEffect(() => {
    setRemovedAttachmentKeys(new Set());
  }, [parts, value]);

  const nextParts = buildEditedUserMessageParts(
    parts,
    value,
    removedAttachmentKeys,
  );

  return (
    <div className="w-full rounded-[24px] border border-border/80 bg-surface-primary/96 p-3 shadow-shadow-sm">
      <div className="space-y-3">
        <div className="rounded-[14px] border border-primary/20 bg-surface-secondary/40 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onCancel();
              }

              if (event.key === "Enter" && event.ctrlKey) {
                event.preventDefault();
                void onSubmit(nextParts);
              }
            }}
            rows={4}
            className="min-h-[104px] w-full resize-none rounded-[12px] border-0 bg-transparent px-3 py-2.5 text-[15px] leading-6 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-0"
            placeholder={t("chat.thread.actions.edit")}
            autoFocus
          />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          {visibleAttachmentParts.length > 0 ? (
            <div className="min-w-0 bg-surface-secondary/40 p-2">
              <div className="flex flex-wrap gap-2">
                {visibleImageAttachmentParts.map((part, index) => {
                  const imageUrl = resolveAttachmentSource(part.source);
                  const attachmentKey = `${part.type}-${index}`;

                  return (
                    <div
                      key={attachmentKey}
                      className="group relative h-12 w-12 overflow-hidden rounded-[10px] border border-border/60 bg-surface-primary shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
                    >
                      <img
                        src={imageUrl}
                        alt={part.name ?? ""}
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                      <button
                        type="button"
                        className="absolute right-0.5 top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-black/55 text-white/95 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                        aria-label={t("common.actions.delete")}
                        title={t("common.actions.delete")}
                        onClick={() => {
                          setRemovedAttachmentKeys((current) => {
                            const next = new Set(current);
                            next.add(attachmentKey);
                            return next;
                          });
                        }}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                      <span className="absolute inset-x-0 bottom-0 truncate bg-black/35 px-1 py-0.5 text-[9px] text-white/95 opacity-0 transition-opacity group-hover:opacity-100">
                        {part.name ??
                          part.source.split("/").pop() ??
                          t("chat.thread.actions.imageAttachment")}
                      </span>
                    </div>
                  );
                })}

                {visibleFileAttachmentParts.map((part, index) => (
                    <div
                      key={`${part.type}-${index}`}
                      className="inline-flex min-w-[8.5rem] max-w-full items-center gap-2 rounded-[12px] border border-border/60 bg-surface-primary px-3 py-2 text-sm text-text-secondary"
                    >
                      <FileUp className="h-4 w-4 shrink-0" />
                      <span className="block truncate">{part.name}</span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div />
          )}
          <div className="flex flex-shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="min-w-[5.25rem] justify-center"
              onClick={onReset}
            >
              {t("common.actions.reset")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="min-w-[5.25rem] justify-center"
              onClick={onCancel}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="min-w-[5.25rem] justify-center"
              onClick={() => void onSubmit(nextParts)}
            >
              {t("common.actions.save")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// UChatComposerActions renders the attachment, knowledge-base, and send
// buttons without coupling to any specific runtime implementation.
function UChatComposerActions({
  composerActions,
  threadContextTags,
  isRunning,
  isSendDisabled,
  agentEnabled,
  agentAvailability,
  onComposerAction,
  onRemoveThreadContextTag,
  onToggleAgentEnabled,
  onSend,
  onAgentSend,
  onCancelSend,
  onComposerAttachmentsChange,
}: {
  composerActions: ChatComposerAction[];
  threadContextTags: ChatThreadContextTag[];
  isRunning: boolean;
  isSendDisabled: boolean;
  agentEnabled?: boolean;
  agentAvailability?: {
    enabled: boolean;
    disabledReason?: string;
  };
  onComposerAction: (action: ChatComposerAction) => void | Promise<void>;
  onRemoveThreadContextTag?: (
    tag: ChatThreadContextTag,
  ) => void | Promise<void>;
  onToggleAgentEnabled?: () => void | Promise<void>;
  onSend: () => void | Promise<void>;
  onAgentSend?: () => void | Promise<void>;
  onCancelSend?: () => void | Promise<void>;
  onComposerAttachmentsChange: (files: File[]) => void;
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingAttachmentAction, setPendingAttachmentAction] =
    useState<ChatComposerAction | null>(null);
  const isAgentToggleDisabled =
    agentEnabled !== true && agentAvailability?.enabled === false;

  const handleAction = (action: ChatComposerAction) => {
    if (action.disabled) {
      return;
    }

    if (action.kind === "attachment") {
      setPendingAttachmentAction(action);
      fileInputRef.current?.click();
      return;
    }

    if (action.kind === "command") {
      void onComposerAction(action);
    }
  };

  const menuItems = composerActions.map((action) => ({
    id: action.id,
    label: action.label,
    title: action.title,
    disabled: action.disabled,
    children: action.children?.map((child) => ({
      id: child.id,
      label: child.label,
      title: child.title,
      disabled: child.disabled,
      leadingIcon: child.id.includes("knowledge-base") ? (
        <LibraryBig className="h-4 w-4" />
      ) : child.id.includes("role") ? (
        <UserRound className="h-4 w-4" />
      ) : child.id.includes("context-summary") ? (
        <MessageSquareText className="h-4 w-4" />
      ) : child.kind === "attachment" ? (
        <Paperclip className="h-4 w-4" />
      ) : null,
    })),
    leadingIcon: action.id.includes("knowledge-base") ? (
      <LibraryBig className="h-4 w-4" />
    ) : action.id.includes("role") ? (
      <UserRound className="h-4 w-4" />
    ) : action.id.includes("workspace") ? (
      <Folder className="h-4 w-4" />
    ) : action.id.includes("context-summary") ? (
      <MessageSquareText className="h-4 w-4" />
    ) : action.kind === "attachment" ? (
      <Paperclip className="h-4 w-4" />
    ) : null,
  }));

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-cloudy-4/55 px-4 pb-3.5 pt-3">
      <div className="flex min-w-0 flex-1 items-center gap-2 pl-1 text-xs text-text-tertiary">
        {composerActions.length > 0 ? (
          <DropdownMenu
            items={menuItems}
            onSelect={(item) => {
              const directAction =
                composerActions.find((action) => action.id === item.id) ??
                composerActions
                  .flatMap((action) => action.children ?? [])
                  .find((action) => action.id === item.id);

              if (directAction) {
                handleAction(directAction);
              }
            }}
            trigger={
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-surface-primary/90 text-text-secondary transition-all duration-150 hover:border-border hover:bg-surface-primary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary"
                title="Composer menu"
                aria-label="Composer menu"
              >
                <Plus className="h-4 w-4" />
              </button>
            }
          />
        ) : null}
        {onToggleAgentEnabled ? (
          <button
            type="button"
            disabled={isAgentToggleDisabled}
            onClick={() => {
              void onToggleAgentEnabled();
            }}
            className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs transition-colors ${
              agentEnabled
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-border/70 bg-surface-primary/90 text-text-secondary"
            } disabled:cursor-not-allowed disabled:opacity-50`}
            aria-pressed={agentEnabled ? "true" : "false"}
            title={
              isAgentToggleDisabled
                ? agentAvailability?.disabledReason ?? t("chat.thread.agent.toggleOn")
                : agentEnabled
                  ? t("chat.thread.agent.toggleOff")
                  : t("chat.thread.agent.toggleOn")
            }
            aria-label={
              agentEnabled
                ? t("chat.thread.agent.toggleOff")
                : t("chat.thread.agent.toggleOn")
            }
          >
            <Bot className="h-3.5 w-3.5" />
            <span>Agent</span>
          </button>
        ) : null}

        {threadContextTags.map((tag) => (
          <Tooltip key={tag.id} text={tag.tooltip ?? tag.label} placement="top">
            <Badge
              variant="primary"
              size="sm"
              className="gap-1.5 border border-primary/20 bg-primary/10 pr-1 text-primary shadow-none"
            >
              {tag.kind === "role" && tag.avatarSrc ? (
                <img
                  src={tag.avatarSrc}
                  alt=""
                  className="h-4 w-4 rounded-full object-cover"
                  draggable={false}
                />
              ) : (
                <LibraryBig className="h-3.5 w-3.5" />
              )}
              <span className="max-w-28 truncate">{tag.label}</span>
              {tag.removable ? (
                <button
                  type="button"
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-primary/80 transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none"
                  aria-label={`Remove ${tag.label}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void onRemoveThreadContextTag?.(tag);
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </Badge>
          </Tooltip>
        ))}

        <input
          ref={fileInputRef}
          type="file"
          accept={pendingAttachmentAction?.accept}
          multiple={pendingAttachmentAction?.multiple ?? true}
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []).filter(
              isImageFile,
            );
            onComposerAttachmentsChange(files);
            event.currentTarget.value = "";
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Tooltip
          text={
            !isRunning && agentEnabled && agentAvailability?.enabled === false
              ? agentAvailability.disabledReason ?? ""
              : ""
          }
          placement="top"
        >
          <button
            type="button"
            disabled={
              !isRunning &&
              (isSendDisabled || (agentEnabled && agentAvailability?.enabled === false))
            }
            onClick={() => {
              if (isRunning) {
                void onCancelSend?.();
                return;
              }

              if (agentEnabled && onAgentSend) {
                void onAgentSend();
                return;
              }

              void onSend();
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-text-primary text-text-inverted transition-all duration-150 hover:scale-[1.02] hover:bg-text-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={
              isRunning
                ? t("chat.thread.composer.cancelGeneration")
                : agentEnabled
                  ? t("chat.thread.agent.run")
                  : t("chat.thread.actions.send")
            }
            title={
              isRunning
                ? t("chat.thread.composer.cancelGeneration")
                : agentEnabled
                  ? t("chat.thread.agent.run")
                  : t("chat.thread.actions.send")
            }
          >
            {isRunning ? (
              <Square className="h-3.5 w-3.5 fill-current" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
