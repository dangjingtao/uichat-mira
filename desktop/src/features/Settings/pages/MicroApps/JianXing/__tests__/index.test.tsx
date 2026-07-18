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
  installNativeMessagingHost: vi.fn(),
  uninstallNativeMessagingHost: vi.fn(),
}));

describe("JianXingPage", () => {
  it("keeps connection controls above the JianXing and clipper tabs", () => {
    render(<JianXingPage />);

    expect(screen.getByText("浏览器连接方式")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "见行" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "剪藏" })).toBeInTheDocument();
    expect(screen.getByText("看 · 参数")).toBeInTheDocument();
    expect(screen.getByText("页面结果")).toBeInTheDocument();
  });

  it("shows active clipping content without exposing JianXing tools", async () => {
    render(<JianXingPage />);

    await userEvent.click(screen.getByRole("tab", { name: "剪藏" }));

    expect(screen.getByText("浏览器主动剪藏")).toBeInTheDocument();
    expect(screen.getByText(/剪藏由你在 Chrome 中主动发起/)).toBeInTheDocument();
    expect(screen.queryByText("看 · 参数")).not.toBeInTheDocument();
    expect(screen.queryByText("页面结果")).not.toBeInTheDocument();
  });
});
