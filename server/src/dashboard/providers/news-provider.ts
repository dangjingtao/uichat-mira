import type { DashboardProvider, NewsData } from "../dashboard-types.js";

export const newsProvider: DashboardProvider<NewsData> = {
  async getData(now) {
    const publishedAt = now.toISOString();
    return {
      demo: true,
      sourceLabel: "演示数据",
      items: [
        { title: "AI Agent 正从聊天走向可审计的工作流", summary: "围绕执行边界、证据和人工确认的产品设计持续受到关注。", category: "AI", publishedAt },
        { title: "本地优先应用重新审视数据与模型边界", summary: "更多桌面工具开始把数据主权、离线能力和运行时透明度放在首位。", category: "产品", publishedAt },
        { title: "开源社区持续完善代码理解与评测工具链", summary: "代码图谱、基准评测和自动化审查正在形成更紧密的组合。", category: "工程", publishedAt },
        { title: "结构化上下文成为智能助手可靠性的关键", summary: "清晰的数据契约正在帮助助手减少猜测并提高可验证性。", category: "趋势", publishedAt },
      ],
    };
  },
};
