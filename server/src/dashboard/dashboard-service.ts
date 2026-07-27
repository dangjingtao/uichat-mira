import type { DashboardOverview, DashboardWidget } from "./dashboard-types.js";
import { clockWeatherProvider } from "./providers/clock-weather-provider.js";
import { countdownProvider } from "./providers/countdown-provider.js";
import { mailProvider } from "./providers/mail-provider.js";
import { newsProvider } from "./providers/news-provider.js";
import { projectStatusProvider } from "./providers/project-status-provider.js";
import { recentArtifactsProvider } from "./providers/recent-artifacts-provider.js";

export async function getDashboardOverview(now = new Date()): Promise<DashboardOverview> {
  const [clockWeather, news, mail, projectStatus, countdown, recentArtifacts] = await Promise.all([
    clockWeatherProvider.getData(now),
    newsProvider.getData(now),
    mailProvider.getData(now),
    projectStatusProvider.getData(now),
    countdownProvider.getData(now),
    recentArtifactsProvider.getData(now),
  ]);

  const widgets: DashboardWidget[] = [
    { id: "clock-weather", type: "clock-weather", title: "时间与天气", size: "small", data: clockWeather, updatedAt: now.toISOString() },
    { id: "news", type: "news", title: "新闻", size: "medium", data: news, updatedAt: now.toISOString() },
    { id: "mail", type: "mail", title: "邮件", size: "small", data: mail, updatedAt: now.toISOString() },
    { id: "project-status", type: "project-status", title: "Mira 开发状态", size: "medium", data: projectStatus, updatedAt: now.toISOString() },
    { id: "countdown", type: "countdown", title: "倒计时", size: "small", data: countdown, updatedAt: now.toISOString() },
    { id: "recent-artifacts", type: "recent-artifacts", title: "近期交付", size: "medium", data: recentArtifacts, updatedAt: now.toISOString() },
  ];

  return { generatedAt: now.toISOString(), widgets };
}
