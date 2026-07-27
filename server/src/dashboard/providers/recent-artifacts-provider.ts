import type { DashboardProvider, RecentArtifactsData } from "../dashboard-types.js";

export const recentArtifactsProvider: DashboardProvider<RecentArtifactsData> = {
  async getData() {
    return {
      demo: true,
      sourceLabel: "演示数据",
      items: [
        { name: "GitHub 微应用接入报告", kind: "报告", deliveredAt: "今天", detail: "接入范围、验证结果与后续计划" },
        { name: "MiraDocs 发布记录", kind: "文档", deliveredAt: "昨天", detail: "近期文档站发布与变更摘要" },
        { name: "CodeGraph Benchmark", kind: "评测", deliveredAt: "2026-07-24", detail: "代码理解能力基准测试结果" },
      ],
    };
  },
};
