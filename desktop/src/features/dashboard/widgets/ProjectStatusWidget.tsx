import { Circle } from "lucide-react";
import type { DashboardWidget, ProjectStatusData } from "../types/dashboard-types";
import { WidgetCard } from "../components/WidgetCard";
const tone: Record<string, string> = { "正常": "text-success", "进行中": "text-primary", "需要处理": "text-danger", "待验收": "text-warning" };
export function ProjectStatusWidget({ widget }: { widget: DashboardWidget<ProjectStatusData> }) { return <WidgetCard widget={widget}><div className="space-y-4">{widget.data.items.map((item) => <div key={item.name} className="flex items-start gap-3"><Circle className={`mt-1 h-3 w-3 shrink-0 fill-current ${tone[item.status] ?? "text-text-tertiary"}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2 text-sm"><span className="font-medium text-text-primary">{item.name}</span><span className="text-xs text-text-secondary">{item.status}</span></div><div className="mt-1 text-xs text-text-tertiary">{item.detail}</div></div></div>)}</div></WidgetCard>; }
