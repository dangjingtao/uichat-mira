"use client";

import React, { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles } from "lucide-react";

import MarkdownText from "@/shared/ui/MarkdownText";
import Switch from "@/shared/ui/Switch";

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
import {
  getRoleModelConfigs,
} from "@/shared/api/modelSettings";
import { getThreadById, updateThread } from "@/shared/api/thread";

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

const AssistantMessage = () => (
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

                    <span className="sr-only" role="status" aria-live="polite">
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
      </div>
    </div>
  </MessagePrimitive.Root>
);

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

  const aui = useAui();
  const isThreadEmpty = useAuiState((s) => s.thread.isEmpty);
  const isRunning = useAuiState((s) => s.thread.isRunning);
  const activeThreadId = useAuiState((s) => s.threads.mainThreadId);
  const activeThreadRemoteId = useAuiState((s) => s.threadListItem.remoteId);
  const previousThreadIdRef = useRef<string | undefined>(undefined);

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

                  return <AssistantMessage />;
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
