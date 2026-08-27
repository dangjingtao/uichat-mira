// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { DashboardWidget, MailData } from "../types/dashboard-types";
import { MailWidget } from "./MailWidget";

const widget = (data: MailData): DashboardWidget<MailData> => ({
  id: "mail",
  type: "mail",
  title: "邮件",
  size: "small",
  updatedAt: "2026-07-30T02:00:00.000Z",
  data,
});

const readyData: MailData = {
  demo: false,
  sourceLabel: "邮件中心",
  status: "ready",
  totalToday: 3,
  attentionCount: 2,
  items: [
    { id: "one", sender: "客户 A", subject: "确认报价", receivedAt: "2026-07-30T01:00:00.000Z", content: "第一封内容", priority: "high", attentionReason: "今天截止", suggestedNextStep: "今天回复" },
    { id: "two", sender: "同事 B", subject: "评审请求", receivedAt: "2026-07-30T02:00:00.000Z", content: "第二封内容", priority: "normal", attentionReason: "需要评审", suggestedNextStep: "安排评审" },
  ],
};

describe("MailWidget", () => {
  it("shows attention mail in an accessible carousel", async () => {
    const user = userEvent.setup();
    render(<MailWidget widget={widget(readyData)} />);

    expect(screen.getByText("第一封内容")).toBeInTheDocument();
    expect(screen.getByText(/发现/)).toHaveTextContent("发现 2 封值得你关注的新邮件");
    await user.click(screen.getByRole("button", { name: "下一封邮件" }));
    expect(screen.getByText("第二封内容")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "第 2 封，共 2 封" })).toBeInTheDocument();
  });

  it("distinguishes no mail from analyzed mail with no attention items", () => {
    render(<MailWidget widget={widget({ ...readyData, status: "empty", totalToday: 4, attentionCount: 0, items: [] })} />);
    expect(screen.getByText("已分析今日 4 封邮件，暂无需要关注的内容")).toBeInTheDocument();
  });
});
