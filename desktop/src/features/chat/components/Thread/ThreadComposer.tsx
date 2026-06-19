"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, LibraryBig, Paperclip, Plus, Square } from "lucide-react";
import {
  AttachmentPrimitive,
  ComposerPrimitive,
  useAuiState,
} from "@assistant-ui/react";
import { useTranslation } from "react-i18next";

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
  const isRunning = useAuiState((s) => s.thread.isRunning);
  const attachmentSupported = useAuiState(
    (s) => s.thread.capabilities.attachments,
  );
  const attachmentCount = useAuiState((s) => s.composer.attachments.length);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isMenuOpen]);

  const knowledgeBaseButtonClassName = useMemo(
    () =>
      `inline-flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary ${
        ragEnabled
          ? "border-primary/35 bg-primary/12 text-primary hover:bg-primary/16"
          : "border-border/70 bg-surface-primary/90 text-text-secondary hover:border-border hover:bg-surface-primary hover:text-text-primary"
      } ${isRagToggleDisabled ? "cursor-not-allowed opacity-55" : ""}`,
    [isRagToggleDisabled, ragEnabled],
  );

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
            {attachmentSupported && attachmentCount > 0 ? (
              <div className="flex flex-wrap gap-2 border-b border-cloudy-4/55 px-4 pb-3 pt-3">
                <ComposerPrimitive.Attachments
                  components={{
                    Attachment: ComposerAttachmentChip,
                  }}
                />
              </div>
            ) : null}
            <ComposerPrimitive.Input
              placeholder={placeholder}
              className={`min-h-[44px] w-full resize-none bg-transparent px-4 py-3.5 text-[15px] leading-7 text-text-primary placeholder:text-cloudy-6 focus:outline-none ${
                isSendDisabled ? "cursor-not-allowed opacity-60" : ""
              }`}
              rows={3}
              disabled={isSendDisabled}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-cloudy-4/55 px-4 pb-3.5 pt-3">
              <div className="flex min-w-0 flex-1 items-center gap-2 pl-1 text-xs text-text-tertiary">
                <div ref={menuRef} className="relative flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!attachmentSupported}
                    onClick={() => {
                      setIsMenuOpen((current) => !current);
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-surface-primary/90 text-text-secondary transition-all duration-150 hover:border-border hover:bg-surface-primary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary disabled:cursor-not-allowed disabled:opacity-55"
                    title={t("chat.thread.composer.addAction")}
                    aria-label={t("chat.thread.composer.addAction")}
                    aria-haspopup="menu"
                    aria-expanded={isMenuOpen}
                  >
                    <Plus className="h-4 w-4" />
                  </button>

                  {isMenuOpen ? (
                    <div className="absolute bottom-[calc(100%+0.7rem)] left-0 z-[140]">
                      <div className="min-w-[12rem] rounded-[10px] border border-border bg-surface-elevated p-1.5 shadow-shadow-md">
                        <ComposerPrimitive.AddAttachment asChild>
                          <button
                            type="button"
                            onClick={() => {
                              setIsMenuOpen(false);
                            }}
                            className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-[13px] font-medium text-text-primary transition-colors hover:bg-surface-secondary"
                          >
                            <Paperclip className="h-3.5 w-3.5 text-text-secondary" />
                            <span>
                              {t("chat.thread.composer.attachmentMenu")}
                            </span>
                          </button>
                        </ComposerPrimitive.AddAttachment>
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => {
                      if (!isRagToggleDisabled) {
                        void onToggleRag();
                      }
                    }}
                    disabled={isRagToggleDisabled}
                    className={knowledgeBaseButtonClassName}
                    title={t("chat.thread.composer.enableKnowledgeBase")}
                    aria-label={t("chat.thread.composer.ragAria")}
                    aria-pressed={ragEnabled}
                  >
                    <LibraryBig className="h-4 w-4" />
                  </button>
                </div>

                <div className="min-w-0 leading-tight">
                  <p className="truncate text-[10px] text-text-tertiary">
                    {ragStatusHint}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {isRunning ? (
                  <ComposerPrimitive.Cancel
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-text-primary text-text-inverted transition-all duration-150 hover:scale-[1.02] hover:bg-text-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary"
                    title={t("chat.thread.composer.cancelGeneration")}
                  >
                    <Square className="h-3.5 w-3.5 fill-current stroke-[2.5]" />
                  </ComposerPrimitive.Cancel>
                ) : (
                  <ComposerPrimitive.Send
                    disabled={isSendDisabled}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-text-primary text-text-inverted transition-all duration-150 hover:scale-[1.02] hover:bg-text-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </ComposerPrimitive.Send>
                )}
              </div>
            </div>
          </ComposerPrimitive.Root>
        </div>
      </div>
    </div>
  );
}

function ComposerAttachmentChip() {
  const { t } = useTranslation();

  return (
    <AttachmentPrimitive.Root className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface-primary/92 px-3 py-1.5 text-xs text-text-secondary">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-surface-secondary text-text-secondary">
        <Paperclip className="h-3 w-3" />
      </span>
      <span className="max-w-44 truncate font-medium text-text-primary">
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
