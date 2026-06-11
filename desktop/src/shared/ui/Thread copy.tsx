"use client";

import React from "react";
import { ArrowUp, Sparkles } from "lucide-react";

import MarkdownText from "@/shared/ui/MarkdownText";

import {
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
} from "@assistant-ui/react";

const assistantAvatarClassName =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-primary text-[11px] font-semibold text-text-primary shadow-shadow-sm";

const shellClassName =
  "relative flex h-full min-h-0 flex-col overflow-hidden bg-surface-secondary text-text-primary";

const backdropOrbsClassName =
  "pointer-events-none absolute inset-0 overflow-hidden";

const contentColumnClassName =
  "mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-36 pt-6 sm:px-6 lg:px-8";

const sectionCopyClassName =
  "mx-auto mb-10 flex w-full max-w-2xl flex-col items-start gap-3 px-1";

const bubbleBaseClassName =
  "rounded-[24px] px-4 py-3 text-sm leading-7 shadow-shadow-sm transition-colors duration-150";

const UserMessage = () => (
  <MessagePrimitive.Root className="flex justify-end px-0 py-4 sm:py-5">
    <div
      className={`${bubbleBaseClassName} max-w-[min(100%,42rem)] rounded-tr-md border border-border/70 bg-surface-elevated/90 text-text-primary`}
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
    <div className="flex w-full max-w-3xl items-start gap-3">
      <div className={assistantAvatarClassName} aria-hidden="true">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div
          className={`${bubbleBaseClassName} inline-block max-w-full rounded-tl-md border border-border/70 bg-surface-primary text-text-primary`}
        >
          <MessagePrimitive.Parts>
            {({ part }) => {
              if (part.type === "text") {
                return (
                  <MarkdownText className="prose prose-sm max-w-none break-words text-text-primary prose-headings:text-text-primary prose-p:text-text-primary prose-strong:text-text-primary prose-code:text-text-primary prose-pre:bg-surface-secondary prose-pre:text-text-primary prose-li:text-text-primary prose-blockquote:border-border prose-blockquote:text-text-secondary" />
                );
              }

              return null;
            }}
          </MessagePrimitive.Parts>
        </div>
      </div>
    </div>
  </MessagePrimitive.Root>
);

function CustomThread() {
  return (
    <ThreadPrimitive.Root className={shellClassName}>
      <div className={backdropOrbsClassName} aria-hidden="true">
        <div className="absolute -left-24 top-[-7rem] h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-[-6rem] top-28 h-80 w-80 rounded-full bg-text-primary/5 blur-3xl" />
        <div className="absolute bottom-[-6rem] left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-surface-primary/60 blur-3xl" />
      </div>

      <ThreadPrimitive.Viewport className="relative flex min-h-0 flex-1 flex-col overflow-y-auto scroll-smooth">
        <div className={contentColumnClassName}>
          <div className={sectionCopyClassName}>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface-primary/90 px-3 py-1 text-xs font-medium text-text-secondary shadow-shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              <span>OpenAI-style thread</span>
            </div>
            <h1 className="text-[28px] font-semibold tracking-tight text-text-primary sm:text-[32px]">
              Clean spacing. Quiet chrome. Better reading flow.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-text-secondary">
              A calmer conversation surface with softer contrast, centered
              content, and a docked composer that stays out of the way until you
              need it.
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
            <div className="pointer-events-auto mx-auto w-full max-w-3xl">
              <ComposerPrimitive.Root className="overflow-hidden rounded-[28px] border border-border/70 bg-surface-primary/95 shadow-shadow-lg backdrop-blur-xl">
                <div className="flex items-center justify-between gap-4 border-b border-border/70 px-4 py-3 text-xs text-text-tertiary">
                  <span>More context usually yields a better answer.</span>
                  <span>Enter 发送 · Shift + Enter 换行</span>
                </div>
                <ComposerPrimitive.Input
                  placeholder="输入问题，回车发送..."
                  className="min-h-[50px] w-full resize-none bg-transparent px-4 py-4 text-[15px] leading-7 text-text-primary placeholder:text-text-tertiary focus:outline-none"
                  rows={4}
                />
                <div className="flex items-center justify-between gap-3 px-4 pb-4">
                  <div className="pl-1 text-xs text-text-tertiary">
                    Responses are generated from the current thread context
                  </div>
                  <ComposerPrimitive.Send className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-text-primary text-text-inverted transition-all duration-150 hover:scale-[1.02] hover:bg-text-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary disabled:cursor-not-allowed disabled:opacity-50">
                    <ArrowUp className="h-4 w-4" />
                  </ComposerPrimitive.Send>
                </div>
              </ComposerPrimitive.Root>
            </div>
          </div>
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}

export default CustomThread;
