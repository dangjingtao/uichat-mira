import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  LoaderCircle,
  Wrench,
} from "lucide-react";
import type { ChatToolTraceEntry } from "../core";

const statusClassNameMap: Record<ChatToolTraceEntry["status"], string> = {
  requested: "border-border/70 bg-surface-primary/92 text-text-secondary",
  running: "border-primary/20 bg-primary/10 text-primary",
  succeeded: "border-success-border bg-success-soft text-success-text",
  failed: "border-warning-border bg-warning-soft text-warning-text",
};

const statusIconMap: Record<ChatToolTraceEntry["status"], React.ReactNode> = {
  requested: <Clock3 className="h-3.5 w-3.5" />,
  running: <LoaderCircle className="h-3.5 w-3.5 animate-spin" />,
  succeeded: <CheckCircle2 className="h-3.5 w-3.5" />,
  failed: <AlertCircle className="h-3.5 w-3.5" />,
};

const stringifyValue = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const getOutputSummary = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    results?: unknown[];
    provider?: string;
  };

  if (Array.isArray(candidate.results)) {
    if (typeof candidate.provider === "string") {
      return `${candidate.provider} · ${candidate.results.length}`;
    }
    return `${candidate.results.length}`;
  }

  return null;
};

export function UChatToolTrace({
  entries,
}: {
  entries: ChatToolTraceEntry[];
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const latestEntry = entries.at(-1) ?? null;
  const summary = useMemo(() => {
    if (!latestEntry) {
      return "";
    }

    if (latestEntry.status === "failed") {
      return latestEntry.errorMessage ?? t("chat.thread.tools.failed");
    }

    if (latestEntry.status === "succeeded") {
      const outputSummary = getOutputSummary(latestEntry.output);
      if (outputSummary) {
        return t("chat.thread.tools.succeededSummary", {
          toolName: latestEntry.toolName,
          outputSummary,
        });
      }
      return t("chat.thread.tools.succeeded");
    }

    if (latestEntry.status === "running") {
      return t("chat.thread.tools.runningSummary", {
        toolName: latestEntry.toolName,
      });
    }

    return t("chat.thread.tools.requestedSummary", {
      toolName: latestEntry.toolName,
    });
  }, [latestEntry, t]);

  if (!latestEntry) {
    return null;
  }

  return (
    <div className="mt-3 rounded-2xl border border-border/70 bg-surface-primary/68 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
            <Wrench className="h-3.5 w-3.5" />
            <span>{t("chat.thread.tools.title")}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                statusClassNameMap[latestEntry.status]
              }`}
            >
              {statusIconMap[latestEntry.status]}
              <span>{t(`chat.thread.tools.status.${latestEntry.status}`)}</span>
            </span>
            <span className="truncate text-sm font-medium text-text-primary">
              {latestEntry.toolName}
            </span>
          </div>
          {summary ? (
            <div className="mt-2 break-words text-xs text-text-secondary">
              {summary}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 rounded-[10px] border border-border/70 bg-surface-primary/92 px-2.5 text-xs text-text-secondary transition-colors hover:border-border hover:bg-surface-primary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          onClick={() => setExpanded((current) => !current)}
        >
          <span>
            {expanded
              ? t("chat.thread.tools.hideDetails")
              : t("chat.thread.tools.showDetails")}
          </span>
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {expanded ? (
        <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
          {entries.map((entry, index) => (
            <div
              key={`${entry.toolCallId ?? entry.toolName}-${index}`}
              className="rounded-[14px] border border-border/60 bg-surface-secondary/70 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-text-primary">
                  {entry.toolName}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                    statusClassNameMap[entry.status]
                  }`}
                >
                  {statusIconMap[entry.status]}
                  <span>{t(`chat.thread.tools.status.${entry.status}`)}</span>
                </span>
              </div>

              {entry.toolCallId ? (
                <div className="mt-2 text-[11px] text-text-tertiary">
                  {t("chat.thread.tools.callId", {
                    value: entry.toolCallId,
                  })}
                </div>
              ) : null}

              {entry.input ? (
                <div className="mt-3">
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
                    {t("chat.thread.tools.input")}
                  </div>
                  <pre className="overflow-x-auto rounded-[12px] bg-surface-primary/90 px-3 py-2 text-[11px] leading-5 text-text-secondary">
                    {stringifyValue(entry.input)}
                  </pre>
                </div>
              ) : null}

              {Object.prototype.hasOwnProperty.call(entry, "output") ? (
                <div className="mt-3">
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
                    {t("chat.thread.tools.output")}
                  </div>
                  <pre className="overflow-x-auto rounded-[12px] bg-surface-primary/90 px-3 py-2 text-[11px] leading-5 text-text-secondary">
                    {stringifyValue(entry.output)}
                  </pre>
                </div>
              ) : null}

              {entry.errorMessage ? (
                <div className="mt-3">
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-warning-text/90">
                    {t("chat.thread.tools.error")}
                  </div>
                  <div className="rounded-[12px] border border-warning-border bg-warning-soft px-3 py-2 text-[11px] leading-5 text-warning-text">
                    {entry.errorMessage}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
