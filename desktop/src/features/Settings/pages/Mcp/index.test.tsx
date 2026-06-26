// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import McpSettings from "./index";

const getMcpMarketplaceServersMock = vi.fn();
const getExternalMcpServersMock = vi.fn();
const createExternalMcpServerMock = vi.fn();
const connectExternalMcpServerMock = vi.fn();
const discoverExternalMcpServerMock = vi.fn();
const deleteExternalMcpServerMock = vi.fn();
const getExternalMcpServerConfigSchemaMock = vi.fn();
const getExternalMcpServerConfigMock = vi.fn();
const updateExternalMcpServerConfigMock = vi.fn();
const modalConfirmMock = vi.fn();
const modalShowMock = vi.fn();
const modalCloseMock = vi.fn();
const messageSuccessMock = vi.fn();
const messageErrorMock = vi.fn();
const tMock = (key: string) => key;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: tMock,
  }),
}));

vi.mock("@/shared/api/tools", () => ({
  getMcpMarketplaceServers: (...args: unknown[]) => getMcpMarketplaceServersMock(...args),
  getExternalMcpServers: (...args: unknown[]) => getExternalMcpServersMock(...args),
  createExternalMcpServer: (...args: unknown[]) => createExternalMcpServerMock(...args),
  connectExternalMcpServer: (...args: unknown[]) => connectExternalMcpServerMock(...args),
  discoverExternalMcpServer: (...args: unknown[]) => discoverExternalMcpServerMock(...args),
  deleteExternalMcpServer: (...args: unknown[]) => deleteExternalMcpServerMock(...args),
  getExternalMcpServerConfigSchema: (...args: unknown[]) => getExternalMcpServerConfigSchemaMock(...args),
  getExternalMcpServerConfig: (...args: unknown[]) => getExternalMcpServerConfigMock(...args),
  updateExternalMcpServerConfig: (...args: unknown[]) => updateExternalMcpServerConfigMock(...args),
}));

vi.mock("@/shared/ui/Modal", () => ({
  Modal: {
    confirm: (...args: unknown[]) => modalConfirmMock(...args),
    show: (...args: unknown[]) => modalShowMock(...args),
    close: (...args: unknown[]) => modalCloseMock(...args),
  },
}));

vi.mock("@/shared/ui/Message", () => ({
  message: {
    success: (...args: unknown[]) => messageSuccessMock(...args),
    error: (...args: unknown[]) => messageErrorMock(...args),
  },
}));

describe("McpSettings", () => {
  beforeEach(() => {
    getMcpMarketplaceServersMock.mockReset();
    getExternalMcpServersMock.mockReset();
    createExternalMcpServerMock.mockReset();
    connectExternalMcpServerMock.mockReset();
    discoverExternalMcpServerMock.mockReset();
    deleteExternalMcpServerMock.mockReset();
    getExternalMcpServerConfigSchemaMock.mockReset();
    getExternalMcpServerConfigMock.mockReset();
    updateExternalMcpServerConfigMock.mockReset();
    modalConfirmMock.mockReset();
    modalShowMock.mockReset();
    modalCloseMock.mockReset();
    messageSuccessMock.mockReset();
    messageErrorMock.mockReset();

    getMcpMarketplaceServersMock.mockResolvedValue({
      servers: [
        {
          id: "remote-docs",
          name: "remote-docs",
          title: "Remote Docs",
          description: "Third-party docs MCP",
          version: "1.0.0",
          status: "active",
          isLatest: true,
          publishedAt: null,
          updatedAt: null,
          transports: [
            {
              kind: "streamable-http",
              url: "https://remote.example/mcp",
            },
          ],
        },
      ],
      metadata: {
        count: 1,
        nextCursor: null,
        sourceUrl: "https://registry.modelcontextprotocol.io/v0/servers",
      },
    });
    getExternalMcpServersMock.mockResolvedValue([]);
    createExternalMcpServerMock.mockResolvedValue({
      id: "remote-docs",
      source: "registry",
      displayName: "Remote Docs",
      transport: {
        kind: "streamable-http",
        url: "https://remote.example/mcp",
      },
      status: "configured",
      enabled: true,
      createdAt: "2026-06-25T00:00:00.000Z",
      updatedAt: "2026-06-25T00:00:00.000Z",
      discoveredTools: [],
    });
    modalConfirmMock.mockImplementation(async (options: { onConfirm: () => Promise<void> | void }) => {
      await options.onConfirm();
    });
    modalShowMock.mockReturnValue("modal_1");
    getExternalMcpServerConfigSchemaMock.mockResolvedValue({
      fields: [
        { key: "endpointUrl", label: "Endpoint URL", type: "url", required: true },
        { key: "bearerToken", label: "Bearer Token", type: "password", required: false, secret: true },
        { key: "customHeadersJson", label: "Custom Headers JSON", type: "json", required: false },
        { key: "timeoutMs", label: "Timeout (ms)", type: "number", required: true },
      ],
      completeness: "known-partial",
      sources: ["manual"],
      notes: [],
    });
    getExternalMcpServerConfigMock.mockResolvedValue({
      endpointUrl: "https://remote.example/mcp",
      authType: "none",
      timeoutMs: 30000,
      customHeadersJson: "",
      hasBearerToken: false,
    });
    updateExternalMcpServerConfigMock.mockResolvedValue({
      endpointUrl: "https://remote.example/mcp",
      authType: "bearer",
      timeoutMs: 45000,
      customHeadersJson: '{\n  "X-Org-Id": "demo"\n}',
      hasBearerToken: true,
    });
  });

  it("installs a marketplace server and switches to installed tab", async () => {
    const user = userEvent.setup();

    render(<McpSettings />);

    await screen.findByText("Remote Docs");

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: "settings.mcp.marketplace.install",
        }),
      ).toBeEnabled();
    });

    const installButton = screen.getByRole("button", {
      name: "settings.mcp.marketplace.install",
    });

    await user.click(installButton);

    expect(modalConfirmMock).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(createExternalMcpServerMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "remote-docs",
          disclaimerAccepted: true,
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("settings.mcp.installed.emptyTitle")).toBeInTheDocument();
    });
  });

  it("deletes an installed MCP server from the installed tab", async () => {
    const user = userEvent.setup();

    getExternalMcpServersMock.mockResolvedValueOnce([
      {
        id: "remote-docs",
        source: "registry",
        displayName: "Remote Docs",
        description: "Third-party docs MCP",
        transport: {
          kind: "streamable-http",
          url: "https://remote.example/mcp",
        },
        status: "configured",
        enabled: true,
        createdAt: "2026-06-25T00:00:00.000Z",
        updatedAt: "2026-06-25T00:00:00.000Z",
        discoveredTools: [],
      },
    ]);
    getExternalMcpServersMock.mockResolvedValueOnce([]);
    deleteExternalMcpServerMock.mockResolvedValue({
      id: "remote-docs",
    });

    render(<McpSettings />);

    await user.click(
      await screen.findByRole("button", {
        name: /settings\.mcp\.tabs\.installed/i,
      }),
    );

    await screen.findByText("Remote Docs");

    await user.click(
      screen.getByRole("button", {
        name: "settings.mcp.installed.remove",
      }),
    );

    expect(modalConfirmMock).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(deleteExternalMcpServerMock).toHaveBeenCalledWith("remote-docs");
    });

    await waitFor(() => {
      expect(screen.getByText("settings.mcp.installed.emptyTitle")).toBeInTheDocument();
    });
  });

  it("opens config modal and saves MCP server config", async () => {
    const user = userEvent.setup();

    getExternalMcpServersMock.mockResolvedValueOnce([
      {
        id: "remote-docs",
        source: "registry",
        displayName: "Remote Docs",
        description: "Third-party docs MCP",
        transport: {
          kind: "streamable-http",
          url: "https://remote.example/mcp",
        },
        status: "configured",
        enabled: true,
        createdAt: "2026-06-25T00:00:00.000Z",
        updatedAt: "2026-06-25T00:00:00.000Z",
        discoveredTools: [],
      },
    ]);
    getExternalMcpServersMock.mockResolvedValueOnce([
      {
        id: "remote-docs",
        source: "registry",
        displayName: "Remote Docs",
        description: "Third-party docs MCP",
        transport: {
          kind: "streamable-http",
          url: "https://remote.example/mcp",
        },
        status: "configured",
        enabled: true,
        createdAt: "2026-06-25T00:00:00.000Z",
        updatedAt: "2026-06-25T00:00:00.000Z",
        discoveredTools: [],
      },
    ]);

    modalShowMock.mockImplementation((options: { content: JSX.Element }) => {
      render(options.content);
      return "modal_1";
    });

    render(<McpSettings />);

    await user.click(
      await screen.findByRole("button", {
        name: /settings\.mcp\.tabs\.installed/i,
      }),
    );

    await screen.findByText("Remote Docs");

    await user.click(
      screen.getByRole("button", {
        name: "settings.mcp.installed.configure",
      }),
    );

    await waitFor(() => {
      expect(getExternalMcpServerConfigSchemaMock).toHaveBeenCalledWith("remote-docs");
      expect(getExternalMcpServerConfigMock).toHaveBeenCalledWith("remote-docs");
    });

    await user.click(
      screen.getByRole("button", {
        name: "settings.mcp.config.authTypeBearer",
      }),
    );
    await user.type(screen.getByLabelText("settings.mcp.config.bearerToken"), "secret-token");
    await user.clear(screen.getByLabelText("settings.mcp.config.timeoutMs"));
    await user.type(screen.getByLabelText("settings.mcp.config.timeoutMs"), "45000");
    fireEvent.change(screen.getByLabelText("settings.mcp.config.customHeadersJson"), {
      target: {
        value: '{\n  "X-Org-Id": "demo"\n}',
      },
    });

    await user.click(
      screen.getByRole("button", {
        name: "settings.mcp.config.save",
      }),
    );

    await waitFor(() => {
      expect(updateExternalMcpServerConfigMock).toHaveBeenCalledWith("remote-docs", {
        endpointUrl: "https://remote.example/mcp",
        authType: "bearer",
        timeoutMs: 45000,
        customHeadersJson: '{\n  "X-Org-Id": "demo"\n}',
        bearerToken: "secret-token",
      });
    });
    expect(modalCloseMock).toHaveBeenCalledWith("modal_1");
  });
});
