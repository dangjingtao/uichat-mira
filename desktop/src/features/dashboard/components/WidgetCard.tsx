import type { ReactNode } from "react";
import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import type { DashboardWidget } from "../types/dashboard-types";

export type WidgetState = "ready" | "loading" | "empty" | "error";

export function WidgetCard({
  widget,
  state = "ready",
  children,
  error,
  showDemoLabel = true,
  tone = "default",
  showHeader = true,
  showFooter = true,
  className = "",
  contentClassName = "",
}: {
  widget: DashboardWidget;
  state?: WidgetState;
  children?: ReactNode;
  error?: string;
  showDemoLabel?: boolean;
  tone?: "default" | "inverse";
  showHeader?: boolean;
  showFooter?: boolean;
  className?: string;
  contentClassName?: string;
}) {
  const inverse = tone === "inverse";

  return (
    <article aria-label={widget.title} className={`flex h-full min-h-[160px] min-w-0 flex-col overflow-hidden rounded-ui-panel border ${inverse ? "border-text-primary bg-text-primary shadow-shadow-md" : "border-border bg-surface-primary shadow-shadow-sm"} ${className}`}>
      {showHeader ? <div className={`flex items-center justify-between gap-3 border-b px-5 py-4 ${inverse ? "border-white/10" : "border-border"}`}>
        <h2 className={`truncate text-sm font-semibold ${inverse ? "text-white" : "text-text-primary"}`}>{widget.title}</h2>
        {showDemoLabel ? <span className={`shrink-0 text-[11px] ${inverse ? "text-white/60" : "text-text-tertiary"}`}>演示数据</span> : null}
      </div> : null}
      <div className={`flex min-h-0 flex-1 flex-col p-5 ${contentClassName}`}>
        {state === "loading" ? <div className={`flex flex-1 items-center justify-center ${inverse ? "text-white/60" : "text-text-tertiary"}`}><LoaderCircle className="h-5 w-5 animate-spin" aria-label="加载中" /></div> : null}
        {state === "empty" ? <div className={`flex flex-1 flex-col items-center justify-center gap-2 text-sm ${inverse ? "text-white/60" : "text-text-tertiary"}`}><Inbox className="h-5 w-5" />暂无内容</div> : null}
        {state === "error" ? <div className={`flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm ${inverse ? "text-white/70" : "text-danger-text"}`}><AlertCircle className="h-5 w-5" />{error ?? "内容加载失败"}</div> : null}
        {state === "ready" ? children : null}
      </div>
      {showFooter ? <div className={`border-t px-5 py-2.5 text-[11px] ${inverse ? "border-white/10 text-white/50" : "border-border text-text-tertiary"}`}>更新于 {widget.updatedAt ? new Date(widget.updatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "刚刚"}</div> : null}
    </article>
  );
}
