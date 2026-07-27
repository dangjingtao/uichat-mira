import { Timer } from "lucide-react";
import type { CountdownData, DashboardWidget } from "../types/dashboard-types";
import { WidgetCard } from "../components/WidgetCard";
export function CountdownWidget({ widget }: { widget: DashboardWidget<CountdownData> }) { return <WidgetCard widget={widget}><div className="space-y-5">{widget.data.items.map((item) => <div key={item.name} className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><Timer className="h-4 w-4 shrink-0 text-primary" /><span className="truncate text-sm text-text-primary">{item.name}</span></div><span className="shrink-0 text-xl font-semibold text-text-primary">{item.daysLeft}<small className="ml-1 text-xs font-normal text-text-tertiary">天</small></span></div>)}</div></WidgetCard>; }
