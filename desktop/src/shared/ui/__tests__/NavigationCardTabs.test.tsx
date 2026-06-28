// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import NavigationCardTabs from "../NavigationCardTabs";

const tabs = [
  {
    value: "chat" as const,
    label: "对话工作台",
    icon: <span>🧭</span>,
  },
  {
    value: "settings" as const,
    label: "运行设置",
    icon: <span>⚙️</span>,
  },
] as const;

describe("NavigationCardTabs", () => {
  it("renders the tab rail", () => {
    render(<NavigationCardTabs tabs={tabs} value="chat" onChange={() => {}} />);

    expect(screen.getByRole("tablist", { name: "Navigation tabs" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "对话工作台" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "运行设置" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "对话工作台" })).toHaveAttribute("aria-selected", "true");
  });

  it("switches the active card when a tab is clicked", async () => {
    const handleChange = vi.fn();
    render(<NavigationCardTabs tabs={tabs} value="chat" onChange={handleChange} />);

    await userEvent.click(screen.getByRole("tab", { name: "运行设置" }));

    expect(handleChange).toHaveBeenCalledWith("settings");
  });
});
