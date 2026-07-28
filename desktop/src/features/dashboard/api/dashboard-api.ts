import { get } from "@/shared/lib/request";
import type { ClockWeatherData, DashboardOverview, NewsData } from "../types/dashboard-types";

export function getDashboardOverview() {
  return get<DashboardOverview>("/dashboard/overview");
}

export function getDashboardWeather() {
  return get<ClockWeatherData>("/dashboard/weather");
}

export function getDashboardNews(language?: string) {
  const suffix = language ? `?language=${encodeURIComponent(language)}` : "";
  return get<NewsData>(`/dashboard/news${suffix}`);
}
