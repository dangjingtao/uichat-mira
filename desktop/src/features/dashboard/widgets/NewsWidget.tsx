import { useEffect, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import ExternalLink from "@/shared/ui/ExternalLink";
import type { DashboardWidget, NewsData } from "../types/dashboard-types";
import { WidgetCard } from "../components/WidgetCard";

const formatPublishedAt = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
};

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
  const [activeIndex, setActiveIndex] = useState(0);
  const { items } = widget.data;

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(items.length - 1, 0)));
  }, [items.length]);

  const topStory = items[activeIndex];
  const stories = items.filter((_, index) => index !== activeIndex).slice(0, 2);
  const canNavigate = items.length > 1;

  return (
    <WidgetCard
      widget={widget}
      className="md:col-start-2 md:row-start-1"
      showDemoLabel={false}
      showHeader={false}
      showFooter={false}
    >
      {widget.data.status === "loading" ? <NewsSkeleton /> : widget.data.items.length === 0 ? <div className="flex flex-1 items-center justify-center text-sm text-text-tertiary">{widget.data.status === "unavailable" ? "新闻摘要暂不可用" : "暂无新闻"}</div> : <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {topStory ? (
          <section className="pb-5" aria-label="头条新闻">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-tertiary">
              <span>{topStory.sourceName}</span>
              <span aria-hidden="true">·</span>
              <time>{formatPublishedAt(topStory.publishedAt)}</time>
              {topStory.category ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{topStory.category}</span> : null}
            </div>
            <h3 className="mt-3 font-serif text-xl font-bold leading-8 tracking-[-0.015em] text-text-primary">
              {topStory.summary}
              {topStory.url ? <ExternalLink href={topStory.url} className="ml-2 inline-flex translate-y-[-1px] items-center gap-1 font-sans text-xs font-medium tracking-normal text-primary hover:text-primary-hover">原文<ArrowUpRight className="h-3.5 w-3.5" /></ExternalLink> : null}
            </h3>
            <div className="mt-4 flex items-center justify-end gap-4">
              <div className="flex items-center gap-3 text-xs text-text-secondary">
                <button type="button" aria-label="上一条新闻" disabled={!canNavigate} className="rounded-full border border-border p-1.5 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => setActiveIndex((activeIndex - 1 + items.length) % items.length)}><ChevronLeft className="h-3.5 w-3.5" /></button>
                <span>{activeIndex + 1} / {items.length}</span>
                <button type="button" aria-label="下一条新闻" disabled={!canNavigate} className="rounded-full border border-border p-1.5 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => setActiveIndex((activeIndex + 1) % items.length)}><ChevronRight className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </section>
        ) : null}

        <div className="divide-y divide-border border-t border-border">
          {stories.map((item, index) => (
            <section key={`${item.summary}-${index}`} className="min-w-0 py-3">
              <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-tertiary">
                  <span>{item.sourceName}</span>
                  <span aria-hidden="true">·</span>
                  <time>{formatPublishedAt(item.publishedAt)}</time>
                </div>
                <div className="truncate text-sm text-text-primary">{item.summary}</div>
                {item.url ? <ExternalLink href={item.url} aria-label="打开新闻原文" className="text-text-secondary hover:text-primary"><ChevronRight className="h-4 w-4" /></ExternalLink> : null}
              </div>
            </section>
          ))}
        </div>
      </div>}
    </WidgetCard>
  );
}
