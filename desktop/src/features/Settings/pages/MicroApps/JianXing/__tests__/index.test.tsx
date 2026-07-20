// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import JianXingPage from "../index";

vi.mock("@/shared/api/webbridge", () => ({
  WebBridgeRequestError: class WebBridgeRequestError extends Error {},
  WebBridgeClient: class WebBridgeClient {
    onStatus() {
      return () => {};
    }

    close() {}
  },
}));

vi.mock("@/shared/platform/desktopRuntime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/platform/desktopRuntime")>()),
  downloadBrowserExtension: vi.fn(),
  getNativeMessagingHostStatus: vi.fn().mockResolvedValue({ status: "installed", installed: true }),
  installNativeMessagingHost: vi.fn(),
  uninstallNativeMessagingHost: vi.fn(),
}));

describe("JianXingPage", () => {
  it("keeps connection controls above the JianXing and clipper tabs", async () => {
    render(<JianXingPage />);

    expect(screen.getByRole("heading", { name: "触界" })).toBeInTheDocument();
    expect(screen.getByText("Chrome 连接")).toBeInTheDocument();
    expect(await screen.findByText("Native 已安装")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "见行" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "剪藏" })).toBeInTheDocument();
    expect(screen.getByText("看 · 参数")).toBeInTheDocument();
    expect(screen.getByText("页面结果")).toBeInTheDocument();
  });

  it("shows active clipping content without exposing JianXing tools", async () => {
    render(<JianXingPage />);

    await userEvent.click(screen.getByRole("tab", { name: "剪藏" }));

    expect(screen.getByText("网站规则")).toBeInTheDocument();
    expect(screen.getByLabelText("网站规则说明")).toBeInTheDocument();
    expect(screen.queryByText(/只对已配置的网站生效/)).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "同步规则" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新增规则" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "新增规则" }));

    expect(screen.getByText("新增网站规则")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "选择正文区域" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加排除区域" })).toBeInTheDocument();
    expect(screen.getByLabelText("URL 匹配规则（可选）")).toBeInTheDocument();
    expect(screen.getByText(/留空匹配该网站全部页面/)).toBeInTheDocument();
    expect(screen.queryByText("看 · 参数")).not.toBeInTheDocument();
    expect(screen.queryByText("页面结果")).not.toBeInTheDocument();
  });
});
