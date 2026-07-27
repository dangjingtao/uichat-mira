import type { ReactNode } from "react";
import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import type { DashboardWidget } from "../types/dashboard-types";

export type WidgetState = "ready" | "loading" | "empty" | "error";

export function WidgetCard({ widget, state = "ready", children, error }: { widget: DashboardWidget; state?: WidgetState; children?: ReactNode; error?: string }) {
  return (
    <article className="flex min-h-[220px] min-w-0 flex-col rounded-ui-panel border border-border bg-surface-primary shadow-shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="truncate text-sm font-semibold text-text-primary">{widget.title}</h2>
        <span className="shrink-0 text-[11px] text-text-tertiary">演示数据</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-4">
        {state === "loading" ? <div className="flex flex-1 items-center justify-center text-text-tertiary"><LoaderCircle className="h-5 w-5 animate-spin" aria-label="加载中" /></div> : null}
        {state === "empty" ? <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-text-tertiary"><Inbox className="h-5 w-5" />暂无内容</div> : null}
        {state === "error" ? <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-danger-text"><AlertCircle className="h-5 w-5" />{error ?? "内容加载失败"}</div> : null}
        {state === "ready" ? children : null}
      </div>
      <div className="border-t border-border px-4 py-2 text-[11px] text-text-tertiary">更新于 {widget.updatedAt ? new Date(widget.updatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "刚刚"}</div>
    </article>
  );
}
