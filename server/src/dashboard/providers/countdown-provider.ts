import type { CountdownData, DashboardProvider } from "../dashboard-types.js";

export const countdownProvider: DashboardProvider<CountdownData> = {
  async getData(now) {
    const events = [
      ["Mira 版本发布", 14],
      ["项目汇报演示", 6],
      ["年度目标评审", 42],
    ] as const;
    return {
      demo: true,
      sourceLabel: "演示数据",
      items: events.map(([name, days]) => ({
        name,
        targetAt: new Date(now.getTime() + days * 86_400_000).toISOString(),
        daysLeft: days,
      })),
    };
  },
};
