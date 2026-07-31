import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Mail } from "lucide-react";
import { Badge } from "@/shared/ui";
import type { DashboardWidget, MailData, MailPriority } from "../types/dashboard-types";
import { WidgetCard } from "../components/WidgetCard";

const priorityPresentation: Record<MailPriority, { label: string; variant: "danger" | "warning" | "neutral" }> = {
  urgent: { label: "紧急", variant: "danger" },
  high: { label: "高", variant: "warning" },
  normal: { label: "普通", variant: "neutral" },
};

const formatReceivedAt = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
};

function MailSkeleton() {
  return (
    <div className="space-y-4" aria-label="邮件分析中">
      <div className="h-5 w-4/5 animate-pulse rounded-sm bg-surface-secondary" />
      <div className="h-4 w-full animate-pulse rounded-sm bg-surface-secondary" />
      <div className="h-4 w-5/6 animate-pulse rounded-sm bg-surface-secondary" />
      <div className="h-4 w-3/4 animate-pulse rounded-sm bg-surface-secondary" />
    </div>
  );
}

export function MailWidget({ widget }: { widget: DashboardWidget<MailData> }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const { data } = widget;

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(data.items.length - 1, 0)));
  }, [data.items.length]);

  if (data.status === "loading") {
    return <WidgetCard widget={widget} className="order-4 md:col-start-2 md:row-start-2" showDemoLabel={false} showHeader={false} showFooter={false}><MailSkeleton /></WidgetCard>;
  }

  if (data.status === "unavailable") {
    return <WidgetCard widget={widget} className="order-4 md:col-start-2 md:row-start-2" showDemoLabel={false} showHeader={false} showFooter={false}><div className="flex flex-1 items-center justify-center text-center text-sm text-text-tertiary">当日邮件同步或分析暂不可用</div></WidgetCard>;
  }

  if (data.items.length === 0) {
    return <WidgetCard widget={widget} className="order-4 md:col-start-2 md:row-start-2" showDemoLabel={false} showHeader={false} showFooter={false}><div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-text-tertiary"><Mail className="h-5 w-5" /><span>{data.totalToday > 0 ? `已分析今日 ${data.totalToday} 封邮件，暂无需要关注的内容` : "今天暂无新邮件"}</span></div></WidgetCard>;
  }

  const item = data.items[activeIndex]!;
  const priority = priorityPresentation[item.priority];
  const canNavigate = data.items.length > 1;

  return (
    <WidgetCard widget={widget} className="order-4 md:col-start-2 md:row-start-2" showDemoLabel={false} showHeader={false} showFooter={false} contentClassName="!p-0">
      <section className="relative flex min-h-0 flex-1 flex-col" aria-label="值得关注的新邮件" aria-roledescription="轮播图">
        <p className="sr-only">已分析 {data.totalToday} 封，发现 {data.attentionCount} 封值得你关注的新邮件</p>
        <div className="min-h-0 flex-1 overflow-y-auto" role="group" aria-roledescription="幻灯片" aria-label={`第 ${activeIndex + 1} 封，共 ${data.items.length} 封`}>
          <dl className="divide-y divide-border text-xs leading-5">
            <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-4 px-5 py-2"><dt className="font-medium text-text-primary">内容</dt><dd className="flex min-w-0 gap-1 text-text-secondary"><span className="shrink-0">{item.subject} ·</span><span className="truncate">{item.content}</span></dd></div>
            <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-4 px-5 py-2"><dt className="font-medium text-text-primary">优先级</dt><dd><Badge variant={priority.variant}>{priority.label}</Badge></dd></div>
            <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-4 px-5 py-2"><dt className="font-medium text-text-primary">发件人</dt><dd className="truncate text-text-secondary">{item.sender} · {formatReceivedAt(item.receivedAt)}</dd></div>
            <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-4 px-5 py-2"><dt className="font-medium text-text-primary">需要关注的原因</dt><dd className="truncate text-text-secondary">{item.attentionReason}</dd></div>
          </dl>
        </div>

        <div className="absolute bottom-2 right-3 flex items-center gap-2 bg-surface-primary/90 pl-2">
          <button type="button" className="rounded-ui-control p-1 text-text-secondary hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="上一封邮件" disabled={!canNavigate} onClick={() => setActiveIndex((activeIndex - 1 + data.items.length) % data.items.length)}><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-[11px] text-text-tertiary">{activeIndex + 1}/{data.items.length}</span>
          <button type="button" className="rounded-ui-control p-1 text-text-secondary hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="下一封邮件" disabled={!canNavigate} onClick={() => setActiveIndex((activeIndex + 1) % data.items.length)}><ChevronRight className="h-4 w-4" /></button>
        </div>
      </section>
    </WidgetCard>
  );
}
