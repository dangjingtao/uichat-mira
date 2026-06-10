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

const bubbleBaseClassName =
  "rounded-3xl px-4 py-3 text-sm leading-7 shadow-shadow-sm transition-colors duration-150";

const UserMessage = () => (
  <MessagePrimitive.Root className="flex justify-end px-1 py-3">
    <div
      className={`${bubbleBaseClassName} max-w-[min(80%,42rem)] rounded-br-xl bg-text-primary text-text-inverted`}
    >
      <MessagePrimitive.Parts>
        {({ part }) => {
          if (part.type === "text") {
            return <p className="whitespace-pre-wrap break-words">{part.text}</p>;
          }

          return null;
        }}
      </MessagePrimitive.Parts>
    </div>
  </MessagePrimitive.Root>
);

const AssistantMessage = () => (
  <MessagePrimitive.Root className="flex justify-start px-1 py-3">
    <div className="flex w-full items-start gap-3">
      <div className={assistantAvatarClassName} aria-hidden="true">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 pt-1">
        <div
          className={`${bubbleBaseClassName} max-w-[min(100%,48rem)] rounded-tl-xl border border-border/70 bg-surface-primary text-text-primary`}
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
    <ThreadPrimitive.Root className="flex h-full min-h-0 flex-col bg-surface-secondary">
      <ThreadPrimitive.Viewport className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-32 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto mb-8 flex w-full max-w-3xl flex-col items-center px-2 pt-2 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-primary px-3 py-1 text-xs font-medium text-text-secondary shadow-shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI Assistant</span>
            </div>
            <h1 className="mt-4 text-[28px] font-semibold tracking-tight text-text-primary sm:text-[32px]">
              Ask clearly. Read comfortably.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
              A calmer, more OpenAI-like thread with better spacing, softer chrome,
              and cleaner reading rhythm.
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
              <ComposerPrimitive.Root className="overflow-hidden rounded-[28px] border border-border bg-surface-elevated shadow-shadow-lg backdrop-blur">
                <div className="border-b border-border/70 px-4 py-2 text-xs text-text-tertiary">
                  Add a little more context and the answer usually gets better.
                </div>
                <ComposerPrimitive.Input
                  placeholder="Send a message. Press Enter to submit, Shift + Enter for a new line."
                  className="min-h-[88px] w-full resize-none bg-transparent px-4 py-3 text-sm leading-7 text-text-primary placeholder:text-text-tertiary focus:outline-none"
                  rows={3}
                />
                <div className="flex items-center justify-between gap-3 px-3 pb-3">
                  <div className="pl-1 text-xs text-text-tertiary">
                    Responses are generated from the current thread context
                  </div>
                  <ComposerPrimitive.Send className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-text-primary text-text-inverted transition-all duration-150 hover:scale-[1.02] hover:bg-text-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated disabled:cursor-not-allowed disabled:opacity-50">
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
