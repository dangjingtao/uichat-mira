import type { ComponentType } from "react";
import { ClockWeatherWidget } from "../widgets/ClockWeatherWidget";
import { MailWidget } from "../widgets/MailWidget";
import { NewsWidget } from "../widgets/NewsWidget";
import type { DashboardWidget, DashboardWidgetType } from "../types/dashboard-types";

type WidgetRenderer = ComponentType<{ widget: DashboardWidget<any> }>;
export const dashboardWidgetRegistry: Record<DashboardWidgetType, WidgetRenderer> = {
  "clock-weather": ClockWeatherWidget,
  news: NewsWidget,
  mail: MailWidget,
};
