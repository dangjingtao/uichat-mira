import type { MailData } from "../dashboard-types.js";

export const getDashboardMailLoadingData = (): MailData => ({
  demo: false,
  sourceLabel: "邮件中心",
  status: "loading",
  totalToday: 0,
  attentionCount: 0,
  items: [],
});
