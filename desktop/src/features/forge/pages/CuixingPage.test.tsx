// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CuixingPage from "./CuixingPage";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock("../hooks/useForgeWorkspace", () => ({
  default: () => ({
    loading: false,
    error: "backend unavailable",
    snapshot: null,
    busy: false,
    refresh: mocks.refresh,
  }),
}));

vi.mock("../components/ForgeWorkspace", () => ({
  default: () => null,
}));

describe("CuixingPage", () => {
  it("keeps retry and back actions available after the initial load fails", () => {
    render(<CuixingPage />);

    expect(screen.getByText("淬行加载失败")).toBeInTheDocument();
    expect(screen.getByText("backend unavailable")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "返回聊天" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/chat");
  });
});
