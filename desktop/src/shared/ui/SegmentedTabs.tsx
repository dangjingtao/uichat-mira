import React from "react";
import Card from "./Card";

interface SegmentedTabItem<T extends string> {
  value: T;
  label: React.ReactNode;
}

interface SegmentedTabsProps<T extends string> {
  items: SegmentedTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
}

export default function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  className = "",
  size = "md",
}: SegmentedTabsProps<T>) {
  const itemClassName =
    size === "sm"
      ? "px-2.5 py-1 text-xs font-medium"
      : "px-3 py-1.5 text-sm font-medium";

  return (
    <Card
      variant="subtle"
      padding="none"
      className={`inline-flex items-center gap-1 p-1 ${className}`}
    >
      {items.map((item) => {
        const active = item.value === value;

        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={`rounded-ui-control transition-all ${itemClassName} ${
              active
                ? "bg-surface-primary text-text-primary shadow-shadow-sm"
                : "text-text-secondary"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </Card>
  );
}
