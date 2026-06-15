import React, { useState } from "react";
import { ChevronDown, ChevronRight, Clock3, LoaderCircle } from "lucide-react";
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
  const [expanded, setExpanded] = useState(false);

  if (steps.length === 0) {
    return null;
  }

  const summary = summarizeRagProgress(steps);

  return (
    <div className="mt-2 overflow-hidden rounded-2xl border border-border/70 bg-surface-primary/70 transition-[border-color,background-color] duration-200">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors duration-150 hover:bg-surface-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-surface-secondary text-text-secondary">
          <Clock3 className="h-3.5 w-3.5" />
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <span className="shrink-0 font-medium text-text-primary">
            执行过程
          </span>
          <span className="shrink-0 text-text-tertiary">·</span>
          <p className="min-w-0 truncate text-text-secondary">{summary}</p>
          <span className="shrink-0 rounded-full bg-surface-secondary px-1.5 py-0.5 text-[10px] font-medium text-text-tertiary">
            {steps.length}
          </span>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-text-tertiary" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" />
        )}
      </button>

      <div
        aria-hidden={!expanded}
        className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out ${
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0">
          <div className="border-t border-border/70 px-3 py-2">
            {steps.map((step, index) => {
              const row = getRagProgressRow(step);
              const display = getDisplayRagStep(step);
              const statusTone =
                step.phase === "error"
                  ? "bg-rose-500/10 text-rose-600"
                  : step.phase === "start"
                    ? "bg-amber-500/10 text-amber-600"
                    : "bg-emerald-500/10 text-emerald-600";

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
                  className={`flex w-full items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left transition-colors duration-150 ${
                    row.clickable
                      ? "cursor-pointer hover:bg-surface-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
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
                  <p className="min-w-0 shrink text-sm text-text-primary">
                    <span className="font-medium">{display.label}</span>
                    {display.summary ? (
                      <span className="truncate text-text-secondary">
                        {" · "}
                        {display.summary}
                      </span>
                    ) : null}
                  </p>
                  <div className="ml-auto flex shrink-0 items-center gap-2">
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
