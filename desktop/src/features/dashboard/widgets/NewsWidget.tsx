import { Newspaper } from "lucide-react";
import ExternalLink from "@/shared/ui/ExternalLink";
import Tooltip from "@/shared/ui/Tooltip";
import type { DashboardWidget, NewsData } from "../types/dashboard-types";
import { WidgetCard } from "../components/WidgetCard";

function NewsSkeleton() {
  return (
    <div className="space-y-3" aria-label="新闻加载中">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="flex items-center gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
          <div className="h-4 w-4 shrink-0 animate-pulse rounded-sm bg-surface-secondary" />
          <div className="h-4 w-20 shrink-0 animate-pulse rounded-sm bg-surface-secondary" />
          <div className="h-4 flex-1 animate-pulse rounded-sm bg-surface-secondary" />
          <div className="h-4 w-8 shrink-0 animate-pulse rounded-sm bg-surface-secondary" />
        </div>
      ))}
    </div>
  );
}

export function NewsWidget({ widget }: { widget: DashboardWidget<NewsData> }) {
  return (
    <WidgetCard widget={widget} className="md:col-span-2" showDemoLabel={false}>
      {widget.data.status === "loading" ? <NewsSkeleton /> : widget.data.items.length === 0 ? <div className="flex flex-1 items-center justify-center text-sm text-text-tertiary">{widget.data.status === "unavailable" ? "新闻摘要暂不可用" : "暂无新闻"}</div> : <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-1 gap-y-3">
          {widget.data.items.map((item, index) => (
            <div key={`${item.summary}-${index}`} className="flex min-w-0 items-center gap-2 border-b border-border pb-3 last:border-0 last:pb-0">
              <Newspaper className="h-4 w-4 shrink-0 text-primary" />
              <span className="shrink-0 text-[11px] text-text-tertiary">{item.sourceName}</span>
              <Tooltip text={item.summary} placement="top">
                <div className="min-w-0 flex-1 truncate whitespace-nowrap text-sm leading-6 text-text-primary">{item.summary}</div>
              </Tooltip>
              {item.url ? <ExternalLink href={item.url} className="shrink-0 text-[11px] text-primary hover:text-primary-hover">原文</ExternalLink> : null}
            </div>
          ))}
        </div>
      </div>}
    </WidgetCard>
  );
}
