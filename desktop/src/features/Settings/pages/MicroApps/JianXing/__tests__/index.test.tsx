// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import JianXingPage from "../index";

vi.mock("@/shared/api/webbridge", () => ({
  WebBridgeRequestError: class WebBridgeRequestError extends Error {},
  WebBridgeClient: class WebBridgeClient {
    onStatus(listener: (status: unknown) => void) {
      listener({ status: "connected", extensionConnected: true });
      return () => {};
    }

    close() {}

    requestClipRules() {
      return Promise.resolve({
        "wildcard:https://javbus.com/*": {
          alias: "JavBus 影片库",
          urlPattern: "https://javbus.com/*",
          urlPatternMode: "wildcard",
          enabled: true,
          includeSelector: "article",
          excludeSelectors: [],
          imagePolicy: { minWidth: 100, minHeight: 100, maxCount: 20 },
        },
      });
    }
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

  it("opens and closes the usage guide from the page header", async () => {
    render(<JianXingPage />);

    await userEvent.click(screen.getByRole("button", { name: "使用指南" }));
    expect(screen.getByRole("heading", { name: "触界使用指南" })).toBeInTheDocument();
    expect(screen.getByText("注册 Native Messaging")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "关闭", exact: true }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "触界使用指南" })).not.toBeInTheDocument());
  });

  it("shows active clipping content without exposing JianXing tools", async () => {
    render(<JianXingPage />);

    await userEvent.click(screen.getByRole("tab", { name: "剪藏" }));

    expect(screen.getByText("URL 剪藏规则")).toBeInTheDocument();
    expect(screen.getByLabelText("URL 剪藏规则说明")).toBeInTheDocument();
    expect(screen.queryByText(/只对已配置的网站生效/)).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "别名" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "网址匹配" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "正文" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "图片" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "刷新规则" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新增规则" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "新增规则" }));

    expect(screen.getByText("新增 URL 剪藏规则")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "选择正文区域" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加排除区域" })).toBeInTheDocument();
    expect(screen.getByLabelText("URL 匹配规则")).toBeInTheDocument();
    expect(screen.getByText(/多个规则命中同一页面时/)).toBeInTheDocument();
    expect(screen.queryByText("看 · 参数")).not.toBeInTheDocument();
    expect(screen.queryByText("页面结果")).not.toBeInTheDocument();
  });

  it("edits a configured site from the explicit list action and keeps its alias visible", async () => {
    render(<JianXingPage />);

    await userEvent.click(screen.getByRole("tab", { name: "剪藏" }));
    expect(await screen.findByText("JavBus 影片库")).toBeInTheDocument();
    expect(screen.getByText("https://javbus.com/*")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "编辑 JavBus 影片库 规则" }));
    expect(screen.getByText("编辑 URL 剪藏规则")).toBeInTheDocument();
    expect(screen.getByLabelText("网站别名（可选）")).toHaveValue("JavBus 影片库");
  });
});
