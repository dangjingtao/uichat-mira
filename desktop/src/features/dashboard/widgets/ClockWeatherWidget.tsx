import { CloudOff, CloudSun, Clock3, LoaderCircle, MapPin } from "lucide-react";
import type { ClockWeatherData, DashboardWidget } from "../types/dashboard-types";
import { WidgetCard } from "../components/WidgetCard";
export function ClockWeatherWidget({ widget }: { widget: DashboardWidget<ClockWeatherData> }) {
  const d = widget.data;
  const WeatherIcon = d.status === "loading" ? LoaderCircle : d.weatherAvailable ? CloudSun : CloudOff;

  return (
    <WidgetCard widget={widget} showDemoLabel={false}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-4xl font-semibold text-text-primary">{d.localTime}</div>
          <div className="mt-1 text-xs text-text-secondary">{d.dateLabel}</div>
        </div>
        <Clock3 className="h-8 w-8 text-primary" />
      </div>
      <div className="mt-6 flex items-center gap-3">
        <WeatherIcon className={`h-6 w-6 ${d.status === "loading" ? "animate-spin text-text-tertiary" : d.weatherAvailable ? "text-warning" : "text-text-tertiary"}`} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-medium text-text-primary">
            <span>{d.weather} · {d.temperature}</span>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-2 whitespace-nowrap text-xs text-text-secondary">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="min-w-0 truncate">{d.locationLabel}</span>
            <span className="shrink-0">{d.forecast}</span>
          </div>
        </div>
      </div>
    </WidgetCard>
  );
}
