export type DashboardWidgetType =
  | "clock-weather"
  | "news"
  | "mail";

export type DashboardWidgetSize = "small" | "medium" | "large";
export type ClockWeatherStatus = "loading" | "ready" | "unavailable";

export interface DashboardWidget<T = unknown> {
  id: string;
  type: DashboardWidgetType;
  title: string;
  size: DashboardWidgetSize;
  data: T;
  updatedAt?: string;
}

export interface DashboardOverview {
  generatedAt: string;
  widgets: DashboardWidget[];
}

export interface ClockWeatherData {
  demo: false;
  sourceLabel: "IP 定位 + Open-Meteo";
  status: ClockWeatherStatus;
  localTime: string;
  dateLabel: string;
  locationLabel: string;
  weatherAvailable: boolean;
  weatherCode: number | null;
  isDay: boolean | null;
  weather: string;
  temperature: string;
  forecast: string;
}

export interface NewsData { demo: false; sourceLabel: "NewsHub"; status: "loading" | "empty" | "ready" | "unavailable"; items: Array<{ summary: string; category: string; sourceName: string; publishedAt: string; url: string }>; }
export type MailPriority = "urgent" | "high" | "normal";
export interface MailAttentionItem { id: string; sender: string; subject: string; receivedAt: string; content: string; priority: MailPriority; attentionReason: string; suggestedNextStep: string; }
export interface MailData { demo: false; sourceLabel: "邮件中心"; status: "loading" | "empty" | "ready" | "unavailable"; totalToday: number; attentionCount: number; items: MailAttentionItem[]; }
export const dashboardWidgetTypes: DashboardWidgetType[] = [
  "clock-weather", "news", "mail",
];

export function isDashboardWidgetType(value: string): value is DashboardWidgetType {
  return dashboardWidgetTypes.includes(value as DashboardWidgetType);
}
