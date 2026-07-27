import type { DashboardProvider, ProjectStatusData } from "../dashboard-types.js";

export const projectStatusProvider: DashboardProvider<ProjectStatusData> = {
  async getData() {
    return {
      demo: true,
      sourceLabel: "演示数据",
      items: [
        { name: "文枢接入 Agent", status: "进行中", detail: "正在完善接入与验证流程" },
        { name: "GitHub PR 审查", status: "需要处理", detail: "有待处理的审查事项" },
        { name: "GitHub Skill 冒烟", status: "待验收", detail: "等待验收测试结果" },
        { name: "每日 GitHub 审查", status: "正常", detail: "最近一次检查运行正常" },
      ],
    };
  },
};
