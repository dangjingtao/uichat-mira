import type { DashboardProvider, MailData } from "../dashboard-types.js";

export const mailProvider: DashboardProvider<MailData> = {
  async getData() {
    return {
      demo: true,
      sourceLabel: "演示数据",
      unreadCount: 3,
      items: [
        { sender: "MiraDocs", subject: "本周文档发布记录", preview: "已整理本周新增与修订的文档列表。", receivedAt: "今天 09:42" },
        { sender: "GitHub", subject: "Pull request review requested", preview: "有一个待处理的代码审查请求。", receivedAt: "昨天 18:20" },
        { sender: "团队协作", subject: "项目汇报演示安排", preview: "请确认下次项目演示的议程与材料。", receivedAt: "昨天 14:05" },
      ],
    };
  },
};
