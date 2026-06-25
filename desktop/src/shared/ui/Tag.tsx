import React from "react";
import { X } from "lucide-react";

interface TagProps {
  label: string;
  onRemove?: () => void;
  disabled?: boolean;
  className?: string;
}

export default function Tag({
  label,
  onRemove,
  disabled = false,
  className = "",
}: TagProps) {
  return (
    <span
      className={`inline-flex max-w-[140px] items-center gap-0.5 rounded-md border border-border bg-surface-secondary px-1.5 py-0.5 text-xs text-text-primary ${className}`}
      title={label}
    >
      <span className="truncate">{label}</span>
      {onRemove && !disabled ? (
        <button
          type="button"
          aria-label={`Remove tag ${label}`}
          onClick={onRemove}
          className="shrink-0 rounded p-0.5 text-text-tertiary hover:bg-surface-primary hover:text-text-primary"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  );
}
