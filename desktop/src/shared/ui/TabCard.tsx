import React from "react";
import Card from "./Card";
import SegmentedTabs from "./SegmentedTabs";

interface TabCardItem<T extends string> {
  value: T;
  label: React.ReactNode;
}

interface TabCardProps<T extends string> {
  items: TabCardItem<T>[];
  value: T;
  onChange: (value: T) => void;
  headerAside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export default function TabCard<T extends string>({
  items,
  value,
  onChange,
  headerAside,
  children,
  className = "",
  bodyClassName = "",
}: TabCardProps<T>) {
  return (
    <Card
      className={`flex flex-col overflow-hidden p-0 ${className}`}
      padding="none"
    >
      <div className="border-b border-border bg-surface-secondary/60 px-3.5 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedTabs value={value} onChange={onChange} items={items} />
          {headerAside ? (
            <div className="max-w-full text-xs text-text-secondary sm:text-right">
              {headerAside}
            </div>
          ) : null}
        </div>
      </div>
      <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${bodyClassName}`}>
        {children}
      </div>
    </Card>
  );
}
