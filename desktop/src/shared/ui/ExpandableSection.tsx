import React, { useId, useState } from "react";

interface ExpandableSectionProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  children: React.ReactNode;
  collapsedLabel?: React.ReactNode;
  expandedLabel?: React.ReactNode;
  defaultExpanded?: boolean;
  contentClassName?: string;
  triggerClassName?: string;
}

export default function ExpandableSection({
  children,
  collapsedLabel = "More",
  expandedLabel = "Collapse",
  defaultExpanded = false,
  className = "",
  contentClassName = "",
  triggerClassName = "",
  ...divProps
}: ExpandableSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const contentId = useId();

  return (
    <div {...divProps} className={className}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((value) => !value)}
        className={`inline-flex items-center text-sm leading-5 text-primary transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${triggerClassName}`}
      >
        {expanded ? expandedLabel : collapsedLabel}
      </button>

      <div
        id={contentId}
        aria-hidden={!expanded}
        className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out ${
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
