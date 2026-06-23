import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Braces, Copy, X } from "lucide-react";
import { IconButton } from "@/shared/ui/Button";
import { message } from "@/shared/ui/Message";
import type { UChatRagProgressDetail } from "./ragParsers";

// UChatRagProgressDetailDrawer renders structured RAG node execution metadata.
export function UChatRagProgressDetailDrawer({
  open,
  detail,
  onClose,
}: {
  open: boolean;
  detail: UChatRagProgressDetail | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);
  const [cachedDetail, setCachedDetail] = useState<UChatRagProgressDetail | null>(
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
  }, [open, onClose]);

  const formattedJson = useMemo(() => {
    if (!cachedDetail) {
      return "";
    }

    return JSON.stringify(
      {
        nodeId: cachedDetail.nodeId,
        nodeType: cachedDetail.nodeType,
        label: cachedDetail.label,
        status: cachedDetail.status,
        ...(cachedDetail.summary ? { summary: cachedDetail.summary } : {}),
        ...(cachedDetail.details ? { details: cachedDetail.details } : {}),
        ...(cachedDetail.environment
          ? { environment: cachedDetail.environment }
          : {}),
      },
      null,
      2,
    );
  }, [cachedDetail]);

  if (!mounted || !cachedDetail) {
    return null;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedJson);
      message.success(t("chat.ragDrawer.copySuccess"));
    } catch {
      message.error(t("chat.ragDrawer.copyFailed"));
    }
  };

  return (
    <aside
      aria-hidden={!visible}
      className={`relative z-20 hidden h-full shrink-0 overflow-hidden transition-[width,opacity] duration-200 ease-out lg:block ${
        visible ? "w-1/3 opacity-100" : "w-0 opacity-0"
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

        <header className="relative border-b border-border px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex flex-1 items-center gap-2.5">
              <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-text-secondary">
                <Braces className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 truncate text-[13px] font-medium text-text-primary">
                {cachedDetail.label}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              <IconButton
                ariaLabel={t("chat.ragDrawer.copyJson")}
                onClick={handleCopy}
                className="h-8 w-8"
              >
                <Copy className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton
                ariaLabel={t("chat.ragDrawer.closeDetail")}
                onClick={onClose}
                className="h-8 w-8"
              >
                <X className="h-3.5 w-3.5" />
              </IconButton>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 px-2.5 py-2.5">
          <div
            className="h-full min-h-0 overflow-hidden rounded-xl border"
            style={{
              borderColor: "rgb(var(--color-border, 229 231 235))",
              backgroundColor:
                "rgb(var(--color-surface-secondary, 247 247 245))",
            }}
          >
            <pre
              className="stable-scrollbar h-full overflow-auto whitespace-pre-wrap break-all px-2.5 py-2.5 text-[12px] leading-5"
              style={{
                color: "rgb(var(--color-text-primary, 24 24 27))",
                background:
                  "linear-gradient(180deg, rgba(var(--color-surface-primary,255 255 255),0.82) 0%, rgba(var(--color-surface-secondary,247 247 245),0.98) 100%)",
              }}
            >
              <code className="whitespace-pre-wrap break-all font-mono">
                {formattedJson}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </aside>
  );
}
