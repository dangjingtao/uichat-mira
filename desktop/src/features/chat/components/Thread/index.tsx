"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  BowArrow,
  ChevronDown,
  EthernetPort,
  FileText,
  FileUp,
  FolderSearch,
  MessageCircleCode,
  MessagesSquare,
  Sparkles,
} from "lucide-react";
import {
  MessagePartPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
} from "@assistant-ui/react";
import { useKnowledgeBaseAvailability } from "@/app/providers/KnowledgeBaseAvailabilityProvider";
import { useRoleModelConfigs } from "@/app/providers/RoleModelConfigProvider";
import { useCurrentThread } from "@/features/chat/Providers/CurrentThreadProvider";
import Card from "@/shared/ui/Card";
import MarkdownText from "@/shared/ui/MarkdownText";
import RagProgressDetailDrawer, {
  type RagProgressDetail,
} from "./RagProgressDetailDrawer";
import OverflowTooltip from "./OverflowTooltip";
import RagExecutionTrace from "./RagExecutionTrace";
import ThreadComposer from "./ThreadComposer";
import ThreadHeader from "./ThreadHeader";
import {
  getRagSourceAttribution,
  getRagProgressFromContentParts,
  getRagSourcesFromContentParts,
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

const assistantAvatarClassName =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/80 bg-surface-primary text-[11px] font-semibold text-text-primary shadow-shadow-sm";

const shellClassName =
  "relative flex h-full min-h-0 flex-col overflow-hidden bg-[#FAFBF7] text-text-primary";

const backdropOrbsClassName =
  "pointer-events-none absolute inset-0 overflow-hidden";

const contentColumnClassName =
  "mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-[12.5rem] pt-4 sm:px-6 lg:px-8 xl:max-w-5xl";

const sectionCopyClassName =
  "mx-auto mb-8 flex w-full max-w-3xl flex-col items-start gap-4 px-1 transition-all duration-500 ease-out";

const bubbleBaseClassName =
  "rounded-[20px] px-4 py-3 text-sm leading-7 transition-colors duration-150";

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

const welcomeQuickActions = [
  {
    icon: FolderSearch,
    title: "从知识库提问",
    description: "围绕已有文档发问，快速验证召回和回答效果。",
  },
  {
    icon: FileUp,
    title: "上传文档开始测试",
    description: "导入资料后直接发问，观察检索链路和回答质量。",
  },
  {
    icon: MessagesSquare,
    title: "试一个真实问题",
    description: "用自然语言提问，看看系统如何组织答案和来源。",
  },
] as const;

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

  return !normalized.startsWith("未配置");
};

// UserMessage only renders the compact right-aligned bubble and keeps
// assistant-ui message part handling out of the page shell.
const UserMessage = () => (
  <MessagePrimitive.Root className="flex justify-end px-0 py-2 sm:py-2.5">
    <div
      className={`${bubbleBaseClassName} max-w-[min(100%,32rem)] rounded-[18px] rounded-tr-md border border-border bg-surface-primary text-text-primary shadow-[0_1px_2px_rgba(15,23,42,0.05)] xl:max-w-[min(100%,34rem)]`}
    >
      <MessagePrimitive.Parts>
        {({ part }) => {
          if (part.type === "text") {
            return (
              <p className="whitespace-pre-wrap break-words">{part.text}</p>
            );
          }

          return null;
        }}
      </MessagePrimitive.Parts>
    </div>
  </MessagePrimitive.Root>
);

// AssistantMessage owns assistant bubble rendering plus all message-local
// RAG affordances such as sources and execution trace expansion.
const AssistantMessage = ({
  messagesById,
  persistedSourcesByMessageId,
  onOpenRagProgressDetail,
}: {
  messagesById: Record<string, ThreadMessageLike>;
  persistedSourcesByMessageId: Record<string, RagSourceLike[]>;
  onOpenRagProgressDetail: (detail: RagProgressDetail) => void;
}) => {
  const messageId = useAuiState((s) => s.message.id);
  const messageContent = useAuiState((s) => s.message.content);
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);
  const inlineSources = getRagSourcesFromContentParts(messageContent);
  const ragProgress = getRagProgressFromContentParts(messageContent);
  const sources =
    inlineSources.length > 0
      ? inlineSources
      : messageId
        ? (messagesById[messageId]?.metadata?.rag?.sources ??
          persistedSourcesByMessageId[messageId] ??
          [])
        : [];

  useEffect(() => {
    setIsSourcesOpen(false);
  }, [messageId]);

  return (
    <MessagePrimitive.Root className="flex justify-start px-0 py-2 sm:py-2.5">
      <div className="flex w-full max-w-[42rem] items-start gap-2 xl:max-w-[44rem]">
        <div className={assistantAvatarClassName} aria-hidden="true">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div
            className={`${bubbleBaseClassName} inline-block max-w-[min(100%,38rem)] rounded-[18px] rounded-tl-md border border-border/70 bg-surface-primary text-text-primary shadow-[0_1px_2px_rgba(15,23,42,0.03)]`}
          >
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
                        助手正在输入回复
                      </span>
                    </div>
                  );
                },
                Text: () => (
                  <>
                    <MarkdownText className="prose prose-sm max-w-none break-words text-text-primary prose-headings:text-text-primary prose-p:text-text-primary prose-strong:text-text-primary prose-code:text-text-primary prose-pre:bg-surface-secondary prose-pre:text-text-primary prose-li:text-text-primary prose-blockquote:border-border prose-blockquote:text-text-secondary" />
                    <MessagePartPrimitive.InProgress>
                      <span className="ml-1 inline-block align-baseline text-text-tertiary">
                        ●
                      </span>
                    </MessagePartPrimitive.InProgress>
                  </>
                ),
              }}
            />
          </div>
          <RagExecutionTrace
            messageId={messageId}
            steps={ragProgress}
            onOpenDetail={onOpenRagProgressDetail}
          />
          {sources.length > 0 ? (
            <div className="mt-3 rounded-2xl border border-primary-4/70 bg-primary-1/90 p-2.5 shadow-[0_4px_10px_rgba(170,92,42,0.04)] transition-[border-color,background-color,box-shadow] duration-200">
              <button
                type="button"
                onClick={() => setIsSourcesOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-1 text-left transition-colors hover:bg-primary-2/40"
                aria-expanded={isSourcesOpen}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em] text-primary-8">
                    <FileText className="h-3.5 w-3.5" />
                    <span>参考来源</span>
                    <span className="rounded-full border border-primary-3/70 bg-primary-2/95 px-1.5 py-0.5 text-[10px] font-medium text-primary-8">
                      {sources.length}
                    </span>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full  bg-primary-2/90 px-2 py-1 text-[10px] font-medium text-primary-8">
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${
                      isSourcesOpen ? "rotate-180" : ""
                    }`}
                  />
                </span>
              </button>
              <div
                aria-hidden={!isSourcesOpen}
                className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out ${
                  isSourcesOpen
                    ? "mt-2 grid-rows-[1fr] opacity-100"
                    : "mt-0 grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="min-h-0">
                  <div className="space-y-1.5">
                    {sources.map((source, index) => {
                      const documentName = normalizeInlineText(
                        source.documentName,
                      );
                      const content = normalizeInlineText(source.content);
                      const attribution = getRagSourceAttribution(source);
                      const isLast = index === sources.length - 1;

                      return (
                        <div
                          key={`${messageId}-${source.chunkId}`}
                          className={`px-3 py-2.5 ${isLast ? "" : "border-b border-primary-4/70"}`}
                        >
                          <div className="flex items-start gap-2">
                            <OverflowTooltip
                              text={documentName}
                              placement="top"
                              className="min-w-0 flex-1 truncate text-xs font-semibold text-primary-8"
                            >
                              <div>
                                {`Document #${index + 1} · ${documentName}`}
                              </div>
                            </OverflowTooltip>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${attribution.toneClassName}`}
                              >
                                {attribution.label}
                              </span>
                              <span className="rounded-full border border-primary-3/70 bg-primary-2/90 px-2 py-0.5 text-[10px] font-medium text-primary-8/90">
                                相关度 {source.score.toFixed(3)}
                              </span>
                            </div>
                          </div>
                          <OverflowTooltip
                            text={content}
                            placement="top"
                            className="mt-1.5 text-[11px] leading-5 text-text-secondary"
                          >
                            <p className="max-h-10 overflow-hidden">{content}</p>
                          </OverflowTooltip>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

// ThreadContent is the page-level shell that composes provider state,
// assistant-ui primitives, and the RAG runtime hooks into one chat screen.
function ThreadContent() {
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
    hasRagProgressDrawerOpen,
    selectedRagProgressDetail,
    openRagProgressDetail,
    closeRagProgressDetail,
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
      { key: "llm", name: configMap.llm?.name ?? "未配置LLM" },
      { key: "task", name: configMap.task?.name ?? "未配置Task" },
      {
        key: "embedding",
        name: configMap.embedding?.name ?? "未配置embedding",
      },
      { key: "rerank", name: configMap.rerank?.name ?? "未配置rerank" },
    ] as const;

    return items
      .filter((item) => isConfiguredModelName(item.name))
      .map((item) => ({
        ...item,
        label: modelBadgeMeta[item.key].label,
        icon: modelBadgeMeta[item.key].icon,
      }));
  }, [configMap]);

  const { isSendDisabled, placeholder } = useThreadComposerState({
    isRunning,
    ragEnabled,
    hasDefaultLlm,
    hasDefaultEmbedding,
  });
  const isRagToggleDisabled =
    currentThreadLoading || (!ragEnabled && !hasEnabledDocuments);
  const ragStatusHint = ragEnabled
    ? "回答会优先结合知识库内容，并在消息下展示来源与执行过程。"
    : hasEnabledDocuments
      ? "关闭后按普通聊天处理；打开后可查看来源和检索过程。"
      : "当前还没有可用文档，先去知识库上传资料后再开启。";

  return (
    <div className="w-full">
      <ThreadPrimitive.Root className={shellClassName}>
        <style>{typingAnimationStyle}</style>
        <div className={backdropOrbsClassName} aria-hidden="true">
          <div className="absolute left-[-6rem] top-[-7rem] h-44 w-44 rounded-full bg-pampas-5/55 blur-3xl" />
          <div className="absolute right-[-8rem] top-10 h-52 w-52 rounded-full bg-pampas-4/60 blur-3xl" />
        </div>

        <div className="relative flex min-h-0 flex-1">
          <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-l-[28px] border border-border/70 bg-[#FAFBF7] shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <ThreadHeader
              title={
                currentThreadTitle || (isThreadEmpty ? "开始新对话" : "新对话")
              }
              badges={modelBadges}
            />
            <ThreadPrimitive.Viewport className="stable-scrollbar relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto scroll-smooth bg-[#FAFBF7]">
              <div
                key={activeThreadId}
                className="flex min-h-0 flex-1 flex-col pt-14 bg-[#FAFBF7]"
              >
                <div
                  className={`${contentColumnClassName} ${
                    hasRagProgressDrawerOpen ? "xl:max-w-4xl" : "xl:max-w-5xl"
                  }`}
                >
                  <div
                    key={
                      isThreadEmpty
                        ? `welcome-${activeThreadId ?? "empty"}`
                        : "welcome-hidden"
                    }
                    className={`${sectionCopyClassName} ${
                      isThreadEmpty
                        ? "animate-in fade-in slide-in-from-top-2 opacity-100 translate-y-0"
                        : "opacity-0 translate-y-[-10px] pointer-events-none h-0 overflow-hidden"
                    }`}
                  >
                    <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface-secondary/88 px-3 py-1 text-xs font-medium text-text-secondary">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>RAG Chat Tester</span>
                    </div>
                    <div className="space-y-3">
                      <h1 className="text-[28px] font-semibold tracking-tight text-text-primary sm:text-[34px]">
                        <span className="tracking-[0.08em]">
                          从文档到<span className="text-primary">答案</span>，
                        </span>
                        <span className="block tracking-[0.08em] text-text-secondary">
                          答案有据可查。
                        </span>
                      </h1>
                      <p className="max-w-2xl text-sm leading-6 text-text-secondary">
                        把文档变成可提问的知识来源，直连真实检索场景。
                      </p>
                    </div>
                    <div className="grid w-full gap-3 pt-1 md:grid-cols-3">
                      {welcomeQuickActions.map((action) => {
                        const Icon = action.icon;

                        return (
                          <Card
                            key={action.title}
                            className="group rounded-[26px] border-cloudy-3/80 bg-pampas-2/95 p-5 shadow-[0_12px_28px_rgba(73,52,33,0.05)] transition-[transform,border-color,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:border-cloudy-5/85 hover:bg-pampas-1/98 hover:shadow-[0_16px_34px_rgba(73,52,33,0.08)]"
                          >
                            <div className="flex h-6 w-full items-center gap-2 text-text-primary">
                              <Icon className="h-4 w-4 text-cloudy-7" />
                              <div className="text-[15px] font-semibold text-text-primary">
                                {action.title}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <p className="mt-2 max-w-[23ch] text-sm leading-6 text-text-secondary">
                                {action.description}
                              </p>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>

                  <ThreadPrimitive.Messages>
                    {({ message }) => {
                      if (message.role === "user") {
                        return <UserMessage />;
                      }

                      return (
                        <AssistantMessage
                          messagesById={messagesById}
                          persistedSourcesByMessageId={
                            persistedSourcesByMessageId
                          }
                          onOpenRagProgressDetail={openRagProgressDetail}
                        />
                      );
                    }}
                  </ThreadPrimitive.Messages>
                </div>
              </div>
            </ThreadPrimitive.Viewport>

            <ThreadComposer
              hasRagProgressDrawerOpen={hasRagProgressDrawerOpen}
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
        </div>
      </ThreadPrimitive.Root>
    </div>
  );
}

export default ThreadContent;
