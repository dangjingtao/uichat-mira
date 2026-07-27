import type { ClockWeatherData, DashboardProvider } from "../dashboard-types.js";

export const clockWeatherProvider: DashboardProvider<ClockWeatherData> = {
  async getData(now) {
    return {
      demo: true,
      sourceLabel: "演示数据",
      localTime: now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      dateLabel: now.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" }),
      weather: "晴",
      temperature: "22°C",
      forecast: "今日晴朗，适合专注工作",
    };
  },
};
