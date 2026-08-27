import { useEffect, useState } from "react";
import { LoaderCircle, MapPin } from "lucide-react";
import type { ClockWeatherData, DashboardWidget } from "../types/dashboard-types";
import { WeatherIcon } from "../components/WeatherIcon";
import { WidgetCard } from "../components/WidgetCard";
export function ClockWeatherWidget({ widget }: { widget: DashboardWidget<ClockWeatherData> }) {
  const d = widget.data;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const nextNow = new Date();
      setNow(nextNow);
      timer = setTimeout(tick, 1000 - nextNow.getMilliseconds());
    };

    tick();
    return () => clearTimeout(timer);
  }, []);

  const localTime = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
  const dateLabel = now.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <WidgetCard
      widget={widget}
      showDemoLabel={false}
      showHeader={false}
      showFooter={false}
      className="md:col-start-1 md:row-start-1"
    >
      <div className="flex flex-1 flex-col">
        <div>
          <time className="block font-serif text-[clamp(2.8rem,5vw,4.5rem)] font-medium leading-none tabular-nums tracking-[-0.035em] text-text-primary" dateTime={now.toISOString()}>{localTime}</time>
          <div className="mt-3 text-sm font-medium text-text-primary">{dateLabel}</div>
          <div className="mt-3 flex items-center gap-2 text-xs text-text-tertiary">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{d.locationLabel}</span>
          </div>
        </div>
        <div className="mt-auto border-t border-border pt-5">
          <div className="flex items-center gap-4">
            {d.status === "loading" ? <LoaderCircle className="h-10 w-10 shrink-0 animate-spin text-text-tertiary" aria-label="天气加载中" /> : <WeatherIcon weatherCode={d.weatherCode} isDay={d.isDay} />}
            <div className="min-w-0">
              <div className="text-sm text-text-secondary">{d.weather}</div>
              <div className="mt-1 font-serif text-3xl font-bold leading-none text-text-primary">{d.temperature}</div>
            </div>
          </div>
          {d.forecast ? <div className="mt-4 text-xs leading-5 text-text-tertiary">{d.forecast}</div> : null}
        </div>
      </div>
    </WidgetCard>
  );
}
