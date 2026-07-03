import React from "react";
import * as Tabs from "@radix-ui/react-tabs";

export interface NavigationCardTab<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

interface NavigationCardTabsProps<T extends string> {
  tabs: NavigationCardTab<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export default function NavigationCardTabs<T extends string>({
  tabs,
  value,
  onChange,
  className = "",
}: NavigationCardTabsProps<T>) {
  return (
    <Tabs.Root value={value} onValueChange={(nextValue) => onChange(nextValue as T)}>
      <Tabs.List
        aria-label="Navigation tabs"
        className={[
          className,
          "relative flex items-end gap-1 overflow-x-auto overflow-y-hidden after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:z-0 after:border-b after:border-border/80",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {tabs.map((tab) => (
          <Tabs.Trigger
            key={tab.value}
            value={tab.value}
            aria-label={typeof tab.label === "string" ? tab.label : undefined}
            className={[
              "group relative -mb-px flex shrink-0 items-center gap-2 rounded-t-ui-panel border px-3.5 py-2.5 text-sm text-text-secondary transition-all outline-none",
              "border-transparent bg-transparent hover:border-border/70 hover:bg-surface-secondary hover:text-text-primary",
              "focus-visible:z-20 focus-visible:border-primary/30 focus-visible:bg-surface-primary focus-visible:text-text-primary focus-visible:ring-2 focus-visible:ring-primary/20",
              "data-[state=active]:z-10 data-[state=active]:border-border data-[state=active]:border-b-transparent data-[state=active]:bg-surface-primary data-[state=active]:text-text-primary data-[state=active]:shadow-shadow-sm",
            ].join(" ")}
          >
            {tab.icon ? (
              <span
                aria-hidden="true"
                className={[
                  "flex h-4 w-4 items-center justify-center text-icon-secondary transition-colors",
                  "group-data-[state=active]:text-primary group-focus-visible:text-primary",
                ].join(" ")}
              >
                {tab.icon}
              </span>
            ) : null}
            <span className="max-w-[14rem] truncate font-medium">{tab.label}</span>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}
