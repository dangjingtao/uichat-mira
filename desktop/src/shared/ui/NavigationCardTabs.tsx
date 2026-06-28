import React from "react";

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
    <div
      role="tablist"
      aria-label="Navigation tabs"
      className={[className, "flex items-end gap-1 overflow-x-auto border-b border-border/80"].filter(Boolean).join(" ")}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;

        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={typeof tab.label === "string" ? tab.label : undefined}
            onClick={() => onChange(tab.value)}
            className={[
              "group relative -mb-px flex shrink-0 items-center gap-2 rounded-t-ui-panel border px-3.5 py-2.5 text-sm transition-all",
              active
                ? "z-10 border-border bg-surface-primary text-text-primary shadow-shadow-sm before:absolute before:inset-x-0 before:top-0 before:h-px before:rounded-t-ui-panel before:bg-primary"
                : "border-transparent bg-transparent text-text-secondary hover:border-border/70 hover:bg-surface-secondary hover:text-text-primary",
            ].join(" ")}
          >
            {tab.icon ? (
              <span
                aria-hidden="true"
                className={[
                  "flex h-4 w-4 items-center justify-center text-icon-secondary",
                  active ? "text-primary" : "text-icon-secondary",
                ].join(" ")}
              >
                {tab.icon}
              </span>
            ) : null}
            <span className="max-w-[14rem] truncate font-medium">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
