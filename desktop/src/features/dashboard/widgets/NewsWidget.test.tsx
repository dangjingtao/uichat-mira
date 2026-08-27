// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { DashboardWidget, NewsData } from "../types/dashboard-types";
import { NewsWidget } from "./NewsWidget";

const makeWidget = (data: NewsData): DashboardWidget<NewsData> => ({
  id: "news",
  type: "news",
  title: "News",
  size: "medium",
  data,
});

const ready: NewsData = {
  demo: false,
  sourceLabel: "NewsHub",
  status: "ready",
  items: [
    { summary: "Story one", category: "AI", sourceName: "Source A", publishedAt: "2026-08-04T01:00:00Z", url: "https://example.com/one" },
    { summary: "Story two", category: "", sourceName: "Source B", publishedAt: "2026-08-04T02:00:00Z", url: "https://example.com/two" },
    { summary: "Story three", category: "", sourceName: "Source C", publishedAt: "invalid", url: "" },
  ],
};

describe("NewsWidget", () => {
  it("shows a top story and rotates through current items", async () => {
    const user = userEvent.setup();
    render(<NewsWidget widget={makeWidget(ready)} />);
    expect(screen.getByText("Story one")).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button");
    await user.click(buttons.at(-1)!);
    expect(screen.getByText("Story two")).toBeInTheDocument();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("renders loading and unavailable states from current data", () => {
    const { rerender } = render(<NewsWidget widget={makeWidget({ ...ready, status: "loading", items: [] })} />);
    expect(document.querySelectorAll(".animate-pulse")).toHaveLength(16);
    rerender(<NewsWidget widget={makeWidget({ ...ready, status: "unavailable", items: [] })} />);
    expect(document.querySelector(".animate-pulse")).not.toBeInTheDocument();
    expect(screen.getByRole("article")).toHaveTextContent(/.+/);
  });

  it("disables navigation for a single story", () => {
    render(<NewsWidget widget={makeWidget({ ...ready, items: ready.items.slice(0, 1) })} />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getAllByRole("button").every((button) => button.hasAttribute("disabled"))).toBe(true);
  });
});
