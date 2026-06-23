import React from "react";
import CodeBlock from "./CodeBlock";

interface TerminalPanelProps {
  title?: React.ReactNode;
  badge?: React.ReactNode;
  meta?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "plain";
  scrollRef?: React.Ref<HTMLDivElement>;
}

export default function TerminalPanel({
  title,
  badge,
  meta,
  footer,
  children,
  className = "",
  variant = "default",
  scrollRef,
}: TerminalPanelProps) {
  const shellClassName =
    variant === "plain"
      ? "rounded-none border-0 bg-transparent shadow-none"
      : "rounded-ui-overlay border border-border bg-surface-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_1px_2px_rgba(15,23,42,0.04)]";

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-hidden ${shellClassName} ${className}`}
    >
      {(title || badge) ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-secondary px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            <span className="text-xs font-medium tracking-[0.08em] text-text-secondary">
              {title}
            </span>
          </div>
          {badge}
        </div>
      ) : null}

      {meta ? (
        <div className="border-b border-border bg-surface-primary px-4 py-2 text-[11px] text-text-secondary">
          {meta}
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="stable-scrollbar min-h-0 flex-1 overflow-y-auto bg-surface-primary px-4 py-3 font-mono text-[12px] leading-[1.75] text-text-primary"
      >
        {children}
      </div>

      {footer ? (
        <div className="flex h-9 items-center border-t border-border bg-surface-secondary px-4">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
