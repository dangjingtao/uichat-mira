import type { ComponentType } from "react";

interface RoleSectionTitleProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
}

export default function RoleSectionTitle({
  icon: Icon,
  title,
  hint,
}: RoleSectionTitleProps) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
        <Icon className="h-4 w-4 shrink-0 text-icon-secondary" />
        <span className="truncate">{title}</span>
      </div>
      {hint ? (
        <div className="text-xs leading-5 text-text-secondary">{hint}</div>
      ) : null}
    </div>
  );
}
