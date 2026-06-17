"use client";

import React from "react";
import { ArrowUp } from "lucide-react";
import { ComposerPrimitive } from "@assistant-ui/react";
import { useTranslation } from "react-i18next";
import Switch from "@/shared/ui/Switch";

type ThreadComposerProps = {
  hasRagProgressDrawerOpen: boolean;
  placeholder: string;
  isSendDisabled: boolean;
  ragEnabled: boolean;
  isRagToggleDisabled: boolean;
  ragStatusHint: string;
  onToggleRag: () => void | Promise<void>;
};

// ThreadComposer owns the docked input shell so placeholder, send-state,
// and RAG toggle behavior can change without reopening the full thread layout.
export default function ThreadComposer({
  hasRagProgressDrawerOpen,
  placeholder,
  isSendDisabled,
  ragEnabled,
  isRagToggleDisabled,
  ragStatusHint,
  onToggleRag,
}: ThreadComposerProps) {
  const { t } = useTranslation();
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
      <div className="bg-gradient-to-t from-surface-secondary via-surface-secondary/95 to-transparent px-4 pb-5 pt-8 sm:px-6 lg:px-8">
        <div
          className={`pointer-events-auto mx-auto w-full ${
            hasRagProgressDrawerOpen
              ? "max-w-full xl:max-w-3xl"
              : "max-w-3xl xl:max-w-4xl"
          }`}
        >
          <ComposerPrimitive.Root className="overflow-hidden rounded-[24px] border border-cloudy-4/70 bg-pampas-2/90 shadow-[0_8px_22px_rgba(15,23,42,0.035)] backdrop-blur-xl transition-[border-color,background-color,box-shadow] duration-150 hover:border-cloudy-5/80 hover:bg-pampas-1/94 hover:shadow-[0_10px_24px_rgba(15,23,42,0.045)]">
            <ComposerPrimitive.Input
              placeholder={placeholder}
              className={`min-h-[44px] w-full resize-none bg-transparent px-4 py-3.5 text-[15px] leading-7 text-text-primary placeholder:text-cloudy-6 focus:outline-none ${
                isSendDisabled ? "cursor-not-allowed opacity-60" : ""
              }`}
              rows={3}
              disabled={isSendDisabled}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-cloudy-4/55 px-4 pb-3.5 pt-3">
              <div className="flex min-w-0 flex-1 items-center gap-3 pl-1 text-xs text-text-tertiary">
                <Switch
                  checked={ragEnabled}
                  onChange={onToggleRag}
                  disabled={isRagToggleDisabled}
                  ariaLabel={t("chat.thread.composer.ragAria")}
                  size="sm"
                />
                <div className="min-w-0">
                  <div className="font-medium text-text-secondary">
                    {t("chat.thread.composer.enableKnowledgeBase")}
                  </div>
                  <p className="truncate text-[11px] text-text-tertiary">
                    {ragStatusHint}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <ComposerPrimitive.Send
                  disabled={isSendDisabled}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-text-primary text-text-inverted transition-all duration-150 hover:scale-[1.02] hover:bg-text-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowUp className="h-4 w-4" />
                </ComposerPrimitive.Send>
              </div>
            </div>
          </ComposerPrimitive.Root>
        </div>
      </div>
    </div>
  );
}
