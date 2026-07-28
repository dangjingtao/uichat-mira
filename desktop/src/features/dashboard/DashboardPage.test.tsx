// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DashboardPage from "./DashboardPage";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { language: "zh-CN" } }),
}));

vi.mock("./api/dashboard-api", () => ({
  getDashboardOverview: vi.fn(() => new Promise(() => undefined)),
  getDashboardWeather: vi.fn(() => new Promise(() => undefined)),
  getDashboardNews: vi.fn(() => new Promise(() => undefined)),
}));

describe("DashboardPage", () => {
  it("uses the shared settings page layout for the Mira workspace", () => {
    const { container } = render(<DashboardPage />);

    expect(screen.getByText("Mira")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mira 工作台" })).toBeInTheDocument();
    expect(screen.getByText("你的智能助手，随时为你掌握全局")).toBeInTheDocument();
    expect(container.querySelector(".stable-scrollbar")).toBeInTheDocument();
    expect(container.querySelector(".max-w-\\[1180px\\]")).toBeInTheDocument();
    expect(container.querySelector(".grid.items-stretch")).toBeInTheDocument();
    expect(container.querySelector(".md\\:grid-cols-3")).toBeInTheDocument();
    expect(container.querySelector(".md\\:grid-rows-\\[320px_auto\\]")).toBeInTheDocument();
    expect(screen.getAllByLabelText("工作台加载中")).toHaveLength(4);
  });
});
