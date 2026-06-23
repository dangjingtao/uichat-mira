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
}

export default function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  className = "",
}: SegmentedTabsProps<T>) {
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
            className={`rounded-ui-control px-3 py-1.5 text-sm font-medium transition-all ${
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
