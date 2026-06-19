import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { IconButton } from "@/shared/ui/Button";
import OverflowTooltip from "./OverflowTooltip";
import { getRagSourceAttribution, normalizeInlineText } from "./thread.parsers";
import type { RagSourceLike } from "./thread.types";

export type RagSourceDetail = {
  messageId?: string;
  sources: RagSourceLike[];
};

export function RagSourceDetailDrawer({
  open,
  detail,
  onClose,
}: {
  open: boolean;
  detail: RagSourceDetail | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);
  const [cachedDetail, setCachedDetail] = useState<RagSourceDetail | null>(
    detail,
  );

  useEffect(() => {
    if (open && detail) {
      setCachedDetail(detail);
      setMounted(true);
      const timer = window.setTimeout(() => setVisible(true), 16);
      return () => window.clearTimeout(timer);
    }

    setVisible(false);
    const timer = window.setTimeout(() => {
      setMounted(false);
      setCachedDetail(null);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [open, detail]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  const sources = cachedDetail?.sources ?? [];
  const normalizedSources = useMemo(
    () =>
      sources.map((source, index) => ({
        ...source,
        index,
        documentName: normalizeInlineText(source.documentName),
        content: normalizeInlineText(source.content),
        attribution: getRagSourceAttribution(source),
      })),
    [sources],
  );
  const tabs = useMemo(
    () => [
      {
        key: "knowledge-base",
        label: t("chat.thread.sources.knowledgeBaseTab"),
        count: normalizedSources.length,
      },
    ],
    [normalizedSources.length, t],
  );

  if (!mounted || !cachedDetail) {
    return null;
  }

  return (
    <aside
      aria-hidden={!visible}
      className={`relative z-20 hidden h-full shrink-0 overflow-hidden transition-[width,opacity] duration-200 ease-out lg:block ${
        visible ? "w-[23rem] xl:w-[25rem] opacity-100" : "w-0 opacity-0"
      }`}
    >
      <div
        className={`relative flex h-full w-full min-w-0 flex-col border-l border-border bg-surface-primary transition-transform duration-200 ease-out ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          boxShadow:
            "inset 12px 0 20px rgba(15,23,42,0.04), -18px 0 40px rgba(15,23,42,0.08)",
        }}
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-black/8 via-black/[0.04] to-transparent dark:from-white/8 dark:via-white/[0.04]" />

        <div className="border-b border-border/60 px-3 py-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-surface-secondary px-3 py-1.5 text-[12px] font-medium text-text-primary"
                >
                  <span>{tab.label}</span>
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-surface-primary px-1.5 py-0.5 text-[10px] text-text-tertiary">
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
            <IconButton
              ariaLabel={t("chat.thread.sources.closeDrawer")}
              onClick={onClose}
              className="mt-[-0.125rem] h-7 w-7 shrink-0 text-text-tertiary hover:bg-transparent hover:text-text-primary"
            >
              <X className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        </div>

        <div className="stable-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
          {normalizedSources.length === 0 ? (
            <div className="text-sm text-text-secondary">
              {t("chat.thread.sources.empty")}
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {normalizedSources.map((source) => (
                <section
                  key={`${cachedDetail.messageId ?? "source"}-${source.chunkId}-${source.index}`}
                  className="py-4 first:pt-1.5 last:pb-0"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-4 shrink-0 pt-0.5 text-right text-[12px] font-medium tabular-nums text-primary">
                      {source.index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <OverflowTooltip
                          text={source.documentName}
                          placement="top"
                          className="min-w-0 flex-1 truncate text-[14px] font-medium leading-6 text-text-primary"
                        >
                          <div>{source.documentName}</div>
                        </OverflowTooltip>
                        <span className="shrink-0 pt-0.5 text-[12px] font-medium tabular-nums text-primary">
                          {source.score.toFixed(2)}
                        </span>
                      </div>

                      <OverflowTooltip
                        text={source.content}
                        placement="top"
                        className="mt-1 text-[12px] leading-8 text-text-secondary"
                      >
                        <p className="line-clamp-8">{source.content}</p>
                      </OverflowTooltip>

                      <div className="mt-1.5 text-[11px] text-text-tertiary">
                        <span>{t("chat.thread.sources.hitLabel")}</span>
                        <span className="ml-1">{source.attribution.label}</span>
                      </div>
                    </div>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

export default RagSourceDetailDrawer;
