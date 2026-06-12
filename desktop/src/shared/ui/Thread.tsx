"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, FileText, Sparkles } from "lucide-react";

import MarkdownText from "@/shared/ui/MarkdownText";
import Switch from "@/shared/ui/Switch";
import Tooltip from "@/shared/ui/Tooltip";
import { requestThreadListRefresh } from "@/shared/lib/threadListRefresh";

const typingAnimationStyle = `
  @keyframes typing-dot {
    0%, 60%, 100% {
      transform: translateY(0);
      opacity: 0.4;
    }
    30% {
      transform: translateY(-4px);
      opacity: 1;
    }
  }
`;
import { getRoleModelConfigs } from "@/shared/api/modelSettings";
import { getMessages, getThreadById, updateThread } from "@/shared/api/thread";

import {
  ThreadPrimitive,
  MessagePrimitive,
  MessagePartPrimitive,
  ComposerPrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react";

const assistantAvatarClassName =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-primary text-[11px] font-semibold text-text-primary shadow-shadow-sm";

const shellClassName =
  "relative flex h-full min-h-0 flex-col overflow-hidden bg-surface-secondary text-text-primary";

const backdropOrbsClassName =
  "pointer-events-none absolute inset-0 overflow-hidden";

const contentColumnClassName =
  "mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-36 pt-6 sm:px-6 lg:px-8 xl:max-w-5xl";

const sectionCopyClassName =
  "mx-auto mb-10 flex w-full max-w-2xl flex-col items-start gap-3 px-1 transition-all duration-500 ease-out";

const bubbleBaseClassName =
  "rounded-[24px] px-4 py-3 text-sm leading-7 shadow-shadow-sm transition-colors duration-150";

type ThreadMessageLike = {
  id?: string;
  role?: string;
  content?: unknown;
  createdAt?: string | Date;
  metadata?: {
    rag?: {
      sources?: RagSourceLike[];
    };
  };
};

type RagSourceProviderMetadata = {
  rag?: {
    chunkId?: string | number | null;
    documentId?: string | null;
    score?: number | null;
    content?: string;
  };
};

type RagSourceLike = {
  chunkId: string | number;
  documentId?: string;
  documentName: string;
  score: number;
  content: string;
};

type RagSourceDataPartLike = {
  type?: string;
  name?: string;
  data?: unknown;
};

type SourcePartLike = {
  type?: string;
  sourceType?: string;
  id?: string;
  title?: string;
  filename?: string;
  providerMetadata?: RagSourceProviderMetadata;
};

const isRagSourceLike = (value: unknown): value is RagSourceLike => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RagSourceLike>;
  return (
    (typeof candidate.chunkId === "string" ||
      typeof candidate.chunkId === "number") &&
    typeof candidate.documentName === "string" &&
    typeof candidate.score === "number" &&
    typeof candidate.content === "string"
  );
};

const toRagSourceLike = (
  value: unknown,
  index: number,
): RagSourceLike | null => {
  if (isRagSourceLike(value)) {
    return value;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    chunkId?: string | number;
    documentId?: string;
    documentName?: string;
    score?: number;
    content?: string;
  };

  if (
    (typeof candidate.chunkId !== "string" &&
      typeof candidate.chunkId !== "number") ||
    typeof candidate.documentName !== "string"
  ) {
    return null;
  }

  return {
    chunkId: candidate.chunkId,
    documentId: candidate.documentId,
    documentName: candidate.documentName,
    score: typeof candidate.score === "number" ? candidate.score : 0,
    content: typeof candidate.content === "string" ? candidate.content : "",
  };
};

const getMessageText = (message: ThreadMessageLike | undefined) => {
  if (!message) {
    return "";
  }

  if (typeof message.content === "string") {
    return message.content.trim();
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (
          part &&
          typeof part === "object" &&
          "type" in part &&
          (part as { type?: string }).type === "text" &&
          "text" in part &&
          typeof (part as { text?: string }).text === "string"
        ) {
          return (part as { text: string }).text;
        }

        return "";
      })
      .join("")
      .trim();
  }

  return "";
};

const getRagSourcesFromContentParts = (content: unknown): RagSourceLike[] => {
  if (!Array.isArray(content)) {
    return [];
  }

  const inlineSources = content
    .filter(
      (part): part is SourcePartLike =>
        !!part &&
        typeof part === "object" &&
        "type" in part &&
        (part as { type?: string }).type === "source" &&
        "sourceType" in part &&
        (part as { sourceType?: string }).sourceType === "document",
    )
    .map((part, index) => {
      const rag = part.providerMetadata?.rag;
      return {
        chunkId: rag?.chunkId ?? part.id ?? index,
        documentId: rag?.documentId ?? undefined,
        documentName:
          part.filename || part.title || `Knowledge Base Document ${index + 1}`,
        score: typeof rag?.score === "number" ? rag.score : 0,
        content: rag?.content || "",
      };
    });

  if (inlineSources.length > 0) {
    return inlineSources;
  }

  return content
    .filter(
      (part): part is RagSourceDataPartLike =>
        !!part &&
        typeof part === "object" &&
        "type" in part &&
        (part as { type?: string }).type === "data" &&
        "name" in part &&
        (part as { name?: string }).name === "rag-sources",
    )
    .reduce<RagSourceLike[]>((allSources, part) => {
      if (!Array.isArray(part.data)) {
        return allSources;
      }

      const nextSources = part.data
        .map((source, index) => toRagSourceLike(source, index))
        .filter((source): source is RagSourceLike => source !== null);

      allSources.push(...nextSources);
      return allSources;
    }, []);
};

const normalizeInlineText = (value: string) =>
  value.replace(/\s+/g, " ").trim();

const OverflowTooltip = ({
  text,
  placement = "top",
  className,
  children,
}: {
  text: string;
  placement?: "top" | "bottom" | "left" | "right";
  className?: string;
  children: React.ReactNode;
}) => {
  const contentRef = useRef<HTMLDivElement | HTMLParagraphElement | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) {
      return;
    }

    const checkOverflow = () => {
      setIsOverflowing(element.scrollWidth > element.clientWidth);
    };

    checkOverflow();

    const resizeObserver = new ResizeObserver(checkOverflow);
    resizeObserver.observe(element);
    window.addEventListener("resize", checkOverflow);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", checkOverflow);
    };
  }, [text]);

  const content = React.cloneElement(children as React.ReactElement, {
    ref: contentRef,
    className,
  });

  if (!isOverflowing) {
    return content;
  }

  return (
    <Tooltip text={text} placement={placement}>
      {content}
    </Tooltip>
  );
};

const UserMessage = () => (
  <MessagePrimitive.Root className="flex justify-end px-0 py-4 sm:py-5">
    <div
      className={`${bubbleBaseClassName} max-w-[min(100%,42rem)] rounded-tr-md border border-border/70 bg-surface-elevated/90 text-text-primary xl:max-w-[min(100%,50rem)]`}
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

const AssistantMessage = ({
  messagesById,
  persistedSourcesByMessageId,
}: {
  messagesById: Record<string, ThreadMessageLike>;
  persistedSourcesByMessageId: Record<string, RagSourceLike[]>;
}) => {
  const messageId = useAuiState((s) => s.message.id);
  const messageContent = useAuiState((s) => s.message.content);
  const inlineSources = getRagSourcesFromContentParts(messageContent);
  const sources =
    inlineSources.length > 0
      ? inlineSources
      : messageId
        ? (messagesById[messageId]?.metadata?.rag?.sources ??
          persistedSourcesByMessageId[messageId] ??
          [])
        : [];

  return (
    <MessagePrimitive.Root className="flex justify-start px-0 py-4 sm:py-5">
      <div className="flex w-full max-w-3xl items-start gap-3 xl:max-w-4xl">
        <div className={assistantAvatarClassName} aria-hidden="true">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div
            className={`${bubbleBaseClassName} inline-block max-w-full rounded-tl-md border border-border/70 bg-surface-primary text-text-primary`}
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
                        className="flex items-center gap-1.5"
                        aria-hidden="true"
                      >
                        <span className="inline-flex h-2 w-2 animate-[typing-dot_1.4s_infinite_ease-in-out] rounded-full bg-text-secondary/80" />
                        <span className="inline-flex h-2 w-2 animate-[typing-dot_1.4s_infinite_ease-in-out_0.2s_both] rounded-full bg-text-secondary/65" />
                        <span className="inline-flex h-2 w-2 animate-[typing-dot_1.4s_infinite_ease-in-out_0.4s_both] rounded-full bg-text-secondary/50" />
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
          {sources.length > 0 ? (
            <div className="mt-3 rounded-2xl border border-sky-200/70 bg-sky-50/65 p-2.5 shadow-[0_10px_30px_rgba(14,165,233,0.08)]">
              <div className="mb-2 flex items-center gap-2 px-1 text-[11px] font-semibold tracking-[0.08em] text-sky-700/90">
                <FileText className="h-3.5 w-3.5" />
                <span>参考来源</span>
                <span className="rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 shadow-sm">
                  {sources.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {sources.map((source, index) => {
                  const documentName = normalizeInlineText(source.documentName);
                  const content = normalizeInlineText(source.content);

                  return (
                    <div
                      key={`${messageId}-${source.chunkId}`}
                      className="rounded-xl border border-white/80 bg-white/95 px-3 py-2 shadow-[0_6px_18px_rgba(15,23,42,0.05)] transition-colors duration-150 hover:border-sky-200 hover:bg-white"
                    >
                      <div className="flex items-center gap-2">
                        <OverflowTooltip
                          text={documentName}
                          placement="top"
                          className="min-w-0 flex-1 truncate text-xs font-semibold text-sky-700"
                        >
                          <div>
                            {`Document #${index + 1} · ${documentName}`}
                          </div>
                        </OverflowTooltip>
                        <div className="shrink-0 rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                          {source.score.toFixed(3)}
                        </div>
                      </div>
                      <OverflowTooltip
                        text={content}
                        placement="top"
                        className="mt-1 truncate whitespace-nowrap text-[11px] leading-5 text-slate-600"
                      >
                        <p>{content}</p>
                      </OverflowTooltip>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

function CustomThread() {
  const [llmModelName, setLlmModelName] = useState<string>("未配置");
  const [embeddingModelName, setEmbeddingModelName] =
    useState<string>("未配置");
  const [rerankModelName, setRerankModelName] = useState<string>("未配置");
  const [ragEnabled, setRagEnabled] = useState(false);
  const [ragLoading, setRagLoading] = useState(false);
  const [resolvedThreadRemoteId, setResolvedThreadRemoteId] = useState<
    string | null
  >(null);
  const [persistedSourcesByMessageId, setPersistedSourcesByMessageId] =
    useState<Record<string, RagSourceLike[]>>({});
  const aui = useAui();
  const isThreadEmpty = useAuiState((s) => s.thread.isEmpty);
  const isRunning = useAuiState((s) => s.thread.isRunning);
  const activeThreadId = useAuiState((s) => s.threads.mainThreadId);
  const activeThreadRemoteId = useAuiState((s) => s.threadListItem.remoteId);
  const activeThreadTitle = useAuiState((s) => s.threadListItem.title);
  const threadMessages = useAuiState(
    (s) => s.thread.messages as readonly ThreadMessageLike[],
  );
  const previousThreadIdRef = useRef<string | undefined>(undefined);
  const latestSyncSignatureRef = useRef<string | null>(null);
  const latestThreadListRefreshSignatureRef = useRef<string | null>(null);
  const messagesById = useMemo(
    () =>
      Object.fromEntries(
        threadMessages
          .filter((message) => typeof message.id === "string")
          .map((message) => [message.id as string, message]),
      ),
    [threadMessages],
  );

  useEffect(() => {
    const fetchModelConfig = async () => {
      try {
        const configs = await getRoleModelConfigs();
        const llmConfig = configs.find((config) => config.type === "llm");
        const embeddingConfig = configs.find(
          (config) => config.type === "embedding",
        );
        const rerankConfig = configs.find((config) => config.type === "rerank");
        setLlmModelName(llmConfig?.name || "未配置LLM");
        setEmbeddingModelName(embeddingConfig?.name || "未配置embedding");
        setRerankModelName(rerankConfig?.name || "未配置rerank");
      } catch (error) {
        setLlmModelName("未配置LLM");
        setEmbeddingModelName("未配置embedding");
        setRerankModelName("未配置rerank");
      }
    };

    fetchModelConfig();
  }, []);

  useEffect(() => {
    if (activeThreadRemoteId) {
      setResolvedThreadRemoteId(activeThreadRemoteId);
      previousThreadIdRef.current = activeThreadId;
      return;
    }

    if (previousThreadIdRef.current !== activeThreadId) {
      previousThreadIdRef.current = activeThreadId;
      setResolvedThreadRemoteId(null);
      setRagEnabled(false);
      setPersistedSourcesByMessageId({});
      latestSyncSignatureRef.current = null;
      latestThreadListRefreshSignatureRef.current = null;
    }
  }, [activeThreadId, activeThreadRemoteId]);

  useEffect(() => {
    let cancelled = false;

    const fetchThreadConfig = async () => {
      if (!resolvedThreadRemoteId) {
        return;
      }

      try {
        const thread = await getThreadById(resolvedThreadRemoteId);
        if (!cancelled) {
          setRagEnabled(thread.ragEnabled);
        }
      } catch {
        if (!cancelled) {
          setRagEnabled(false);
        }
      }
    };

    void fetchThreadConfig();

    return () => {
      cancelled = true;
    };
  }, [resolvedThreadRemoteId]);

  useEffect(() => {
    if (isRunning || !ragEnabled || !resolvedThreadRemoteId) {
      return;
    }

    if (threadMessages.length === 0) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const persistedMessages = await getMessages(resolvedThreadRemoteId);
        if (cancelled) {
          return;
        }

        const nextSourcesByMessageId = Object.fromEntries(
          persistedMessages
            .filter((message) => message.role === "assistant")
            .map((message) => {
              const sources =
                (
                  message.metadata?.rag as
                    | { sources?: RagSourceLike[] }
                    | undefined
                )?.sources ?? [];

              return [message.id, sources] as const;
            })
            .filter((entry) => entry[1].length > 0),
        ) as Record<string, RagSourceLike[]>;

        const signature = JSON.stringify(nextSourcesByMessageId);
        if (latestSyncSignatureRef.current === signature) {
          return;
        }

        latestSyncSignatureRef.current = signature;
        setPersistedSourcesByMessageId(nextSourcesByMessageId);
        if (latestThreadListRefreshSignatureRef.current !== signature) {
          latestThreadListRefreshSignatureRef.current = signature;
          try {
            const latestThread = await getThreadById(resolvedThreadRemoteId);
            const latestTitle = latestThread.title.trim();
            if (latestTitle && latestTitle !== activeThreadTitle?.trim()) {
              await aui.threadListItem().rename(latestTitle);
              return;
            }
          } catch {
            // Fall through to a list reload if direct title sync fails.
          }

          requestThreadListRefresh({ remoteId: resolvedThreadRemoteId });
        }
      } catch {
        if (!cancelled) {
          latestSyncSignatureRef.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isRunning,
    ragEnabled,
    resolvedThreadRemoteId,
    threadMessages,
    messagesById,
    activeThreadTitle,
    aui,
  ]);

  const handleToggleRag = async () => {
    if (ragLoading) {
      return;
    }

    const remoteId =
      resolvedThreadRemoteId ||
      activeThreadRemoteId ||
      (await aui.threadListItem().initialize()).remoteId;

    if (!remoteId) {
      return;
    }

    const nextValue = !ragEnabled;
    setRagEnabled(nextValue);
    setRagLoading(true);

    try {
      setResolvedThreadRemoteId(remoteId);
      const updatedThread = await updateThread(remoteId, {
        ragEnabled: nextValue,
      });
      setRagEnabled(updatedThread.ragEnabled);
    } catch {
      setRagEnabled(!nextValue);
    } finally {
      setRagLoading(false);
    }
  };

  return (
    <div className="w-full">
      <ThreadPrimitive.Root className={shellClassName}>
        <style>{typingAnimationStyle}</style>
        <div className={backdropOrbsClassName} aria-hidden="true">
          <div className="absolute -left-24 top-[-7rem] h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute right-[-6rem] top-28 h-80 w-80 rounded-full bg-text-primary/5 blur-3xl" />
          <div className="absolute bottom-[-6rem] left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-surface-primary/60 blur-3xl" />
        </div>

        <ThreadPrimitive.Viewport className="stable-scrollbar relative flex min-h-0 flex-1 flex-col overflow-y-auto scroll-smooth">
          <div
            key={activeThreadId}
            className="route-content-transition flex min-h-0 flex-1 flex-col"
          >
            <div className={contentColumnClassName}>
              <div
                className={`${sectionCopyClassName} ${
                  isThreadEmpty
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-[-10px] pointer-events-none h-0 overflow-hidden"
                }`}
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface-primary/90 px-3 py-1 text-xs font-medium text-text-secondary shadow-shadow-sm backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>RAG Chat Tester</span>
                </div>
                <h1 className="text-[28px] font-semibold tracking-tight text-text-primary sm:text-[32px]">
                  智能检索，精准回答
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-text-secondary">
                  基于检索增强生成技术，为您提供准确、可靠的知识问答体验。上传文档，即刻开始智能对话。
                </p>
              </div>

              <ThreadPrimitive.Messages>
                {({ message }) => {
                  if (message.role === "user") {
                    return <UserMessage />;
                  }

                  return (
                    <AssistantMessage
                      messagesById={messagesById}
                      persistedSourcesByMessageId={persistedSourcesByMessageId}
                    />
                  );
                }}
              </ThreadPrimitive.Messages>
            </div>

            <ThreadPrimitive.ViewportFooter className="pointer-events-none sticky bottom-0 z-10 mt-auto">
              <div className="bg-gradient-to-t from-surface-secondary via-surface-secondary/95 to-transparent px-4 pb-5 pt-8 sm:px-6 lg:px-8">
                <div className="pointer-events-auto mx-auto w-full max-w-3xl xl:max-w-4xl">
                  <ComposerPrimitive.Root className="overflow-hidden rounded-[28px] border border-border/70 bg-surface-primary/95 shadow-shadow-lg backdrop-blur-xl">
                    {/* <div className="flex items-center justify-between gap-4 border-b border-border/70 px-4 py-3 text-xs text-text-tertiary">
                    <span>More context usually yields a better answer.</span>
                    <span>Enter 发送 · Shift + Enter 换行</span>
                  </div> */}
                    <ComposerPrimitive.Input
                      placeholder={
                        isRunning
                          ? "助手正在思考中..."
                          : "输入问题，回车发送..."
                      }
                      className={`min-h-[50px] w-full resize-none bg-transparent px-4 py-4 text-[15px] leading-7 text-text-primary placeholder:text-text-tertiary focus:outline-none ${
                        isRunning ? "cursor-not-allowed opacity-60" : ""
                      }`}
                      rows={4}
                      disabled={isRunning}
                    />
                    <div className="flex items-center justify-between gap-3 px-4 pb-4">
                      <div className="flex items-center gap-3 pl-1 text-xs text-text-tertiary">
                        <span className="font-medium text-text-secondary">
                          启用知识库
                        </span>
                        <Switch
                          checked={ragEnabled}
                          onChange={handleToggleRag}
                          disabled={ragLoading}
                          ariaLabel="启用RAG知识库检索"
                          size="sm"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="rounded-full border border-border bg-surface-secondary px-3 py-1 text-xs font-medium text-text-secondary">
                          {llmModelName}
                        </span>
                        <span className="rounded-full border border-border bg-surface-secondary px-3 py-1 text-xs font-medium text-text-secondary">
                          {embeddingModelName}
                        </span>
                        <span className="rounded-full border border-border bg-surface-secondary px-3 py-1 text-xs font-medium text-text-secondary">
                          {rerankModelName}
                        </span>
                        <ComposerPrimitive.Send
                          disabled={isRunning}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-text-primary text-text-inverted transition-all duration-150 hover:scale-[1.02] hover:bg-text-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </ComposerPrimitive.Send>
                      </div>
                    </div>
                  </ComposerPrimitive.Root>
                </div>
              </div>
            </ThreadPrimitive.ViewportFooter>
          </div>
        </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>
    </div>
  );
}

export default CustomThread;
