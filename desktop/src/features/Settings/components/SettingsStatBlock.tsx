import React from "react";
import Card from "@/shared/ui/Card";

interface SettingsStatBlockProps {
  label: React.ReactNode;
  value: React.ReactNode;
  description?: React.ReactNode;
  size?: "sm" | "md";
  truncateValue?: boolean;
  className?: string;
}

const sizeClassNames = {
  sm: "px-3 py-2",
  md: "px-3 py-2.5",
} as const;

export default function SettingsStatBlock({
  label,
  value,
  description,
  size = "md",
  truncateValue = false,
  className = "",
}: SettingsStatBlockProps) {
  return (
    <Card variant="subtle" className={`${sizeClassNames[size]} ${className}`}>
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-tertiary">
        {label}
      </div>
      <div
        className={`mt-1 text-sm font-medium text-text-primary ${
          truncateValue ? "truncate" : ""
        }`}
      >
        {value}
      </div>
      {description ? (
        <div className="mt-1 text-xs text-text-secondary">{description}</div>
      ) : null}
    </Card>
  );
}
