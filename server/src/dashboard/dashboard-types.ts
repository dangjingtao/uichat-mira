export type DashboardWidgetType =
  | "clock-weather"
  | "news"
  | "mail"
  | "project-status"
  | "countdown"
  | "recent-artifacts";

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

export interface DashboardProvider<T> {
  getData(now: Date): Promise<T>;
}

export interface DemoData {
  demo: true;
  sourceLabel: "演示数据";
}

export interface ClockWeatherData {
  demo: false;
  sourceLabel: "IP 定位 + Open-Meteo";
  status: ClockWeatherStatus;
  localTime: string;
  dateLabel: string;
  locationLabel: string;
  weatherAvailable: boolean;
  weather: string;
  temperature: string;
  forecast: string;
}

export interface NewsData {
  demo: false;
  sourceLabel: "NewsHub";
  status: "loading" | "empty" | "ready" | "unavailable";
  items: Array<{ summary: string; category: string; sourceName: string; publishedAt: string; url: string }>;
}

export interface MailData extends DemoData {
  unreadCount: number;
  items: Array<{ sender: string; subject: string; preview: string; receivedAt: string }>;
}

export interface ProjectStatusData extends DemoData {
  items: Array<{ name: string; status: "进行中" | "需要处理" | "待验收" | "正常"; detail: string }>;
}

export interface CountdownData extends DemoData {
  items: Array<{ name: string; targetAt: string; daysLeft: number }>;
}

export interface RecentArtifactsData extends DemoData {
  items: Array<{ name: string; kind: string; deliveredAt: string; detail: string }>;
}
