import React, { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

type CollapsiblePanelProps = {
  title: React.ReactNode;
  meta?: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
};

export default function CollapsiblePanel({
  title,
  meta,
  children,
  defaultExpanded = false,
  className = "",
  headerClassName = "",
  contentClassName = "",
}: CollapsiblePanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const contentId = useId();

  return (
    <div className={`rounded-ui-panel border border-border bg-surface-secondary ${className}`}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((value) => !value)}
        className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${headerClassName}`}
      >
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-text-primary">{title}</div>
          {meta ? <div className="mt-1 text-xs text-text-tertiary">{meta}</div> : null}
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-text-tertiary transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        id={contentId}
        aria-hidden={!expanded}
        className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out ${
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0">
          <div className={contentClassName}>{children}</div>
        </div>
      </div>
    </div>
  );
}
