import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Result } from "@/shared/ui";
import { getDashboardOverview } from "./api/dashboard-api";
import { DashboardHeader } from "./components/DashboardHeader";
import { WidgetCard } from "./components/WidgetCard";
import { WidgetGrid } from "./components/WidgetGrid";
import { dashboardWidgetRegistry } from "./registry/dashboard-widget-registry";
import { isDashboardWidgetType, type DashboardOverview } from "./types/dashboard-types";

export default function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void getDashboardOverview().then(setOverview).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "工作台数据加载失败")); }, []);

  return <main className="stable-scrollbar min-h-0 flex-1 overflow-y-auto bg-surface-secondary px-5 py-7 sm:px-7 lg:px-9"><div className="mx-auto max-w-[1440px]"><DashboardHeader />{error ? <div className="rounded-ui-panel border border-danger-border bg-danger-soft"><Result title="工作台暂时无法加载" description={error} variant="danger" size="sm" icon={<AlertCircle className="h-5 w-5" />} /></div> : overview ? <WidgetGrid>{overview.widgets.map((widget) => { const Renderer = isDashboardWidgetType(widget.type) ? dashboardWidgetRegistry[widget.type] : null; return Renderer ? <Renderer key={widget.id} widget={widget} /> : <WidgetCard key={widget.id} widget={widget} state="error" error="暂不支持此 Widget 类型" />; })}</WidgetGrid> : <WidgetGrid>{Array.from({ length: 6 }, (_, index) => <WidgetCard key={index} widget={{ id: `loading-${index}`, type: "clock-weather", title: "正在加载", size: "small", data: {} }} state="loading" />)}</WidgetGrid>}</div></main>;
}
