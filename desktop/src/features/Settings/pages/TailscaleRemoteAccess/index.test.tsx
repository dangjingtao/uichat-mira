// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TailscaleRemoteAccessSettings from "./index";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  check: vi.fn(),
  update: vi.fn(),
  revoke: vi.fn(),
}));

const messageMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { resolvedLanguage: "zh-CN" },
    t: (key: string) => key,
  }),
}));

vi.mock("@/shared/api/generalSettings", () => ({
  getTailscaleRemoteAccess: apiMocks.get,
  checkTailscaleRemoteAccess: apiMocks.check,
  updateTailscaleRemoteAccess: apiMocks.update,
  revokeTailscaleRemoteDevice: apiMocks.revoke,
}));

vi.mock("@/shared/ui/Message", () => ({
  message: messageMocks,
}));

vi.mock("@/shared/platform/desktopRuntime", () => ({
  getApiBaseUrl: vi.fn(() => "http://localhost"),
  openExternalUrl: vi.fn(),
}));

const connectedSnapshot = {
  config: {
    enabled: false,
    servePort: 443,
    updatedAt: null,
  },
  runtime: {
    state: "connected" as const,
    installed: true,
    backendState: "Running",
    version: "1.90.0",
    deviceName: "studio-pc",
    dnsName: "studio-pc.real-tailnet.ts.net",
    tailnetName: "real-tailnet",
    tailnetDomain: "real-tailnet.ts.net",
    tailscaleIps: ["100.64.0.10"],
    serveConfigured: false,
    serveManagedByMira: false,
    accessUrl: "https://studio-pc.real-tailnet.ts.net",
    healthOk: null,
    checkedAt: "2026-08-01T00:00:00.000Z",
    error: null,
  },
  pairedDevices: [],
};

const readySnapshot = {
  ...connectedSnapshot,
  config: {
    ...connectedSnapshot.config,
    enabled: true,
    updatedAt: "2026-08-01T00:01:00.000Z",
  },
  runtime: {
    ...connectedSnapshot.runtime,
    state: "ready" as const,
    serveConfigured: true,
    serveManagedByMira: true,
    healthOk: true,
  },
};

beforeEach(() => {
  apiMocks.get.mockReset();
  apiMocks.check.mockReset();
  apiMocks.update.mockReset();
  apiMocks.revoke.mockReset();
  messageMocks.success.mockReset();
  messageMocks.error.mockReset();

  apiMocks.get.mockResolvedValue(connectedSnapshot);
  apiMocks.check.mockResolvedValue(connectedSnapshot);
  apiMocks.update.mockResolvedValue(readySnapshot);
});

describe("TailscaleRemoteAccessSettings", () => {
  it("keeps runtime-discovered device configuration inside diagnostics", async () => {
    render(<TailscaleRemoteAccessSettings />);

    expect(await screen.findAllByText("已连接")).toHaveLength(2);
    expect(screen.queryByDisplayValue("studio-pc")).not.toBeInTheDocument();
    expect(screen.queryByText("设备配置")).not.toBeInTheDocument();
    expect(screen.queryByText("访问边界")).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "诊断环境" }),
    );

    expect(await screen.findByDisplayValue("studio-pc")).toBeDisabled();
    expect(screen.getByDisplayValue("real-tailnet.ts.net")).toBeDisabled();
    expect(
      screen.getByText("https://studio-pc.real-tailnet.ts.net"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("https://mira-desktop.example.ts.net"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("还没有通过 mobile 配对协议登记的设备。"),
    ).toBeInTheDocument();
    expect(apiMocks.get).toHaveBeenCalledTimes(1);
  });

  it("checks the backend and saves an enabled Serve draft", async () => {
    render(<TailscaleRemoteAccessSettings />);

    expect(await screen.findAllByText("已连接")).toHaveLength(2);

    await userEvent.click(
      screen.getByRole("switch", { name: "启用远程连接" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "诊断环境" }),
    );
    await waitFor(() => expect(apiMocks.check).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(apiMocks.update).toHaveBeenCalledWith(true));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("诊断信息")).toBeInTheDocument();
    expect(screen.getByText("1.90.0")).toHaveClass("break-words");
    expect(screen.getByText("1.90.0")).not.toHaveClass("break-all");

    await waitFor(() => {
      expect(messageMocks.success).toHaveBeenCalledWith(
        "远程连接设置已保存",
      );
    });
    expect(await screen.findAllByText("可访问")).toHaveLength(2);
  });

  it("opens help with the explicit private-network and authentication boundary", async () => {
    render(<TailscaleRemoteAccessSettings />);
    await screen.findAllByText("已连接");

    await userEvent.click(
      screen.getByRole("button", { name: "帮助说明" }),
    );

    expect(
      screen.getByText(
        "Mira 只发布本机 Host 到私有 Tailnet，不启用 Funnel，也不会覆盖已有的其他 Serve 配置。",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("继续使用 Mira 认证")).toBeInTheDocument();
  });
});
