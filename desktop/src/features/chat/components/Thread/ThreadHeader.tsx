import React from "react";
import Tooltip from "@/shared/ui/Tooltip";

type ThreadHeaderBadge = {
  key: string;
  name: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

type ThreadHeaderProps = {
  title: string;
  badges: ThreadHeaderBadge[];
};

// ThreadHeader isolates the sticky top bar so title rendering and model badge
// presentation can evolve without touching the message viewport.
export default function ThreadHeader({
  title,
  badges,
}: ThreadHeaderProps) {
  return (
    <div className="absolute inset-x-0 top-0 z-20 border-b border-border/70 bg-[#FAFBF7]">
      <div className="flex min-h-10 w-full items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8 xl:px-10">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-text-primary">
            {title}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden pl-3">
          {badges.map((item) => {
            const Icon = item.icon;

            return (
              <Tooltip
                key={item.key}
                text={item.name}
                placement="bottom"
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/80 bg-surface-primary/90 text-text-secondary">
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </div>
  );
}
