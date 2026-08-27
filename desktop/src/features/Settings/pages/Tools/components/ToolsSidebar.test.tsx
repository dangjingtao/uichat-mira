// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ToolsSidebar from "./ToolsSidebar";

describe("ToolsSidebar", () => {
  it("renders each group as a compact list navigation row", () => {
    const onSelectGroup = vi.fn();

    render(
      <ToolsSidebar
        activeGroupId="web_search"
        summaries={[
          {
            id: "web_search",
            label: "网络搜索",
            description: "公开实时搜索与本地新闻源检索。",
            count: 2,
            order: 30,
            icon: "globe",
          },
        ]}
        onSelectGroup={onSelectGroup}
      />,
    );

    expect(screen.getByRole("navigation", { name: "Tool groups" })).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent("网络搜索");
    expect(screen.getByRole("listitem")).toHaveTextContent("2");
    expect(screen.getByRole("button")).toHaveAttribute("aria-current", "page");

    fireEvent.click(screen.getByRole("button"));
    expect(onSelectGroup).toHaveBeenCalledWith("web_search");
  });
});
