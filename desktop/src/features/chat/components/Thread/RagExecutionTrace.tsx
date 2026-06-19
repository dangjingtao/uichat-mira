import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
} from "lucide-react";
import type { RagProgressDetail } from "./RagProgressDetailDrawer";
import type { RagNodeLike } from "./thread.types";
import {
  getDisplayRagStep,
  getRagProgressRow,
  summarizeRagProgress,
} from "./thread.parsers";

export function RagExecutionTrace({
  messageId,
  steps,
  onOpenDetail,
}: {
  messageId?: string;
  steps: RagNodeLike[];
  onOpenDetail: (detail: RagProgressDetail) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (steps.length === 0) {
    return null;
  }

  const summary = summarizeRagProgress(steps);
  const runningCount = steps.filter((step) => step.phase === "start").length;
  const errorCount = steps.filter((step) => step.phase === "error").length;
  const completedCount = steps.filter((step) => step.phase === "done").length;
  const overallTone =
    errorCount > 0
      ? "border-rose-200/70 bg-[rgba(190,24,93,0.04)] text-rose-700"
      : runningCount > 0
        ? "border-amber-200/70 bg-[rgba(180,83,9,0.05)] text-amber-700"
        : "border-[rgba(var(--color-primary),0.16)] bg-[rgba(var(--color-primary),0.05)] text-primary";
  const overallLabel =
    errorCount > 0
      ? t("chat.executionTrace.status.failed")
      : runningCount > 0
        ? t("chat.executionTrace.status.running")
        : t("chat.executionTrace.status.completed");

  return (
    <div className="mt-4 border-b border-border/60 pb-2 transition-[border-color] duration-200">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-2  text-left transition-colors duration-150 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
      >
        <div className="min-w-0 flex flex-1 items-center gap-2 overflow-hidden text-sm">
          <p className="min-w-0 truncate text-text-secondary">{summary}</p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="hidden text-[11px] text-text-tertiary sm:inline">
            {t("chat.executionTrace.stepCount", {
              completed: completedCount,
              total: steps.length,
            })}
          </span>
          {runningCount > 0 ? (
            <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin text-text-tertiary" />
          ) : null}
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-text-tertiary" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" />
          )}
        </div>
      </button>

      <div
        aria-hidden={!expanded}
        className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out ${
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0">
          <div className="mt-1 border-t border-border/50 pt-1.5">
            {steps.map((step, index) => {
              const row = getRagProgressRow(step);
              const display = getDisplayRagStep(step);
              const statusTone =
                step.phase === "error"
                  ? "bg-rose-500/10 text-rose-600"
                  : step.phase === "start"
                    ? "bg-amber-500/10 text-amber-600"
                    : "bg-[rgba(var(--color-primary),0.10)] text-primary";
              const StatusIcon =
                step.phase === "error"
                  ? AlertCircle
                  : step.phase === "start"
                    ? LoaderCircle
                    : CheckCircle2;

              return (
                <button
                  type="button"
                  key={step.nodeId}
                  disabled={!row.clickable || !messageId}
                  onClick={() => {
                    if (!row.clickable || !messageId) {
                      return;
                    }

                    onOpenDetail({
                      messageId,
                      nodeId: row.nodeId,
                      nodeType: row.nodeType,
                      label: row.label,
                      status: row.phase,
                      summary: row.summary,
                      details: row.details,
                      environment: row.environment,
                    });
                  }}
                  className={`flex w-full items-start gap-2.5 px-1 py-1.5 text-left transition-colors duration-150 ${
                    row.clickable
                      ? "cursor-pointer hover:bg-[rgba(var(--color-primary),0.03)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                      : "cursor-default"
                  }`}
                >
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${statusTone}`}
                  >
                    {step.phase === "start" ? (
                      <LoaderCircle className="h-3 w-3 animate-spin" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex flex-1 items-center gap-2 overflow-hidden">
                    <p className="shrink-0 text-[13px] font-medium text-text-primary">
                      {display.label}
                    </p>
                    {display.summary ? (
                      <>
                        <span className="shrink-0 text-text-tertiary">·</span>
                        <p className="min-w-0 truncate text-[12px] leading-5 text-text-secondary">
                          {display.summary}
                        </p>
                      </>
                    ) : null}
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-2 pt-0.5">
                    <StatusIcon
                      className={`h-3.5 w-3.5 ${
                        step.phase === "start"
                          ? "animate-spin text-text-tertiary"
                          : step.phase === "error"
                            ? "text-danger-text"
                            : "text-text-tertiary"
                      }`}
                    />
                    {row.clickable ? (
                      <ChevronRight className="h-3.5 w-3.5 text-text-tertiary" />
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RagExecutionTrace;
