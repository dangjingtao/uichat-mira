import { Newspaper } from "lucide-react";
import type { DashboardWidget, NewsData } from "../types/dashboard-types";
import { WidgetCard } from "../components/WidgetCard";
export function NewsWidget({ widget }: { widget: DashboardWidget<NewsData> }) { return <WidgetCard widget={widget}><div className="space-y-3">{widget.data.items.map((item) => <div key={item.title} className="flex gap-3 border-b border-border pb-3 last:border-0 last:pb-0"><Newspaper className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div className="min-w-0"><div className="text-sm font-medium text-text-primary">{item.title}</div><div className="mt-1 text-xs leading-5 text-text-secondary">{item.summary}</div><div className="mt-1 text-[11px] text-text-tertiary">{item.category}</div></div></div>)}</div></WidgetCard>; }
