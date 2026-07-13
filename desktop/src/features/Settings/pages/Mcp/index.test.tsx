// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import McpSettings from "./index";
import { resolveGithubMirrorUrl } from "@/shared/github";

const getMcpMarketplaceServersMock = vi.fn();
const getExternalMcpServersMock = vi.fn();
const createExternalMcpServerMock = vi.fn();
const connectExternalMcpServerMock = vi.fn();
const discoverExternalMcpServerMock = vi.fn();
const deleteExternalMcpServerMock = vi.fn();
const getExternalMcpServerConfigSchemaMock = vi.fn();
const getExternalMcpServerConfigMock = vi.fn();
const updateExternalMcpServerConfigMock = vi.fn();
const updateExternalMcpAccessMock = vi.fn();
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
  updateExternalMcpAccess: (...args: unknown[]) => updateExternalMcpAccessMock(...args),
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
    updateExternalMcpAccessMock.mockReset();
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
          websiteUrl: "https://docs.example.dev/mcp",
          repositoryUrl: "https://github.com/example/remote-docs",
          transports: [
            {
              kind: "streamable-http",
              packageType: "remote",
              installable: true,
              label: "Remote HTTP",
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
    updateExternalMcpAccessMock.mockResolvedValue({
      id: "remote-docs",
      agentEnabled: true,
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

    await waitFor(() => {
      expect(createExternalMcpServerMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "remote-docs",
          documentationUrl: "https://docs.example.dev/mcp",
          repositoryUrl: "https://github.com/example/remote-docs",
          disclaimerAccepted: true,
          transport: {
            kind: "streamable-http",
            url: "https://remote.example/mcp",
          },
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
        documentationUrl: "https://docs.example.dev/mcp",
        repositoryUrl: "https://github.com/example/remote-docs",
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
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute(
      "href",
      "https://docs.example.dev/mcp",
    );
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      resolveGithubMirrorUrl("https://github.com/example/remote-docs"),
    );

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

  it("renders and toggles Agent Access, then reports update failures", async () => {
    const user = userEvent.setup();
    const server = {
      id: "remote-docs",
      source: "registry" as const,
      displayName: "Remote Docs",
      transport: {
        kind: "streamable-http" as const,
        url: "https://remote.example/mcp",
      },
      status: "connected" as const,
      enabled: true,
      agentEnabled: false,
      createdAt: "2026-06-25T00:00:00.000Z",
      updatedAt: "2026-06-25T00:00:00.000Z",
      discoveredTools: [],
    };
    getExternalMcpServersMock.mockResolvedValueOnce([server]);
    getExternalMcpServersMock.mockResolvedValueOnce([{ ...server, agentEnabled: true }]);
    updateExternalMcpAccessMock.mockResolvedValueOnce({ ...server, agentEnabled: true });

    render(<McpSettings />);
    await user.click(
      await screen.findByRole("button", {
        name: /settings\.mcp\.tabs\.installed/i,
      }),
    );

    const accessSwitch = await screen.findByRole("switch");
    expect(accessSwitch).toHaveAttribute("aria-checked", "false");
    await user.click(accessSwitch);

    await waitFor(() => {
      expect(updateExternalMcpAccessMock).toHaveBeenCalledWith("remote-docs", true);
    });
    expect(await screen.findByRole("switch")).toHaveAttribute("aria-checked", "true");

    updateExternalMcpAccessMock.mockRejectedValueOnce(new Error("access update failed"));
    await user.click(screen.getByRole("switch"));
    await waitFor(() => {
      expect(messageErrorMock).toHaveBeenCalledWith("access update failed");
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

  it("renders discovered MCP tools inside a collapsible panel", async () => {
    const user = userEvent.setup();

    getExternalMcpServersMock.mockResolvedValueOnce([
      {
        id: "slideshot",
        source: "registry",
        displayName: "Slideshot",
        description: "PowerPoint MCP",
        transport: {
          kind: "stdio",
          command: "npx",
          args: ["-y", "slideshot-mcp"],
        },
        status: "connected",
        enabled: true,
        createdAt: "2026-06-25T00:00:00.000Z",
        updatedAt: "2026-06-25T00:00:00.000Z",
        discoveredTools: [
          {
            name: "discover_themes",
            title: "discover_themes",
            description: "",
            inputSchema: { type: "object" },
            projectedCapabilityId: "mcp:io.github.06ketan-slideshot:tool:discover_themes",
          },
          {
            name: "create_slides",
            title: "create_slides",
            description: "",
            inputSchema: { type: "object" },
            projectedCapabilityId: "mcp:io.github.06ketan-slideshot:tool:create_slides",
          },
        ],
      },
    ]);

    render(<McpSettings />);

    await user.click(
      await screen.findByRole("button", {
        name: /settings\.mcp\.tabs\.installed/i,
      }),
    );

    expect(
      screen.getByRole("button", {
        name: /已发现 2 settings\.mcp\.installed\.tools/i,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Projected ID:/i)).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /已发现 2 settings\.mcp\.installed\.tools/i,
      }),
    );

    expect(screen.getByText("discover_themes")).toBeInTheDocument();
    expect(
      screen.getByText(/mcp:io\.github\.06ketan-slideshot:tool:discover_themes/i),
    ).toBeInTheDocument();
  });

  it("renders stdio config fields for installed stdio servers", async () => {
    const user = userEvent.setup();

    getExternalMcpServersMock.mockResolvedValueOnce([
      {
        id: "local-docs",
        source: "manual",
        displayName: "Local Docs",
        description: "stdio server",
        transport: {
          kind: "stdio",
          command: "npx",
          args: ["-y", "@demo/local-docs-mcp"],
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
        id: "local-docs",
        source: "manual",
        displayName: "Local Docs",
        description: "stdio server",
        transport: {
          kind: "stdio",
          command: "npx",
          args: ["-y", "@demo/local-docs-mcp"],
        },
        status: "configured",
        enabled: true,
        createdAt: "2026-06-25T00:00:00.000Z",
        updatedAt: "2026-06-25T00:00:00.000Z",
        discoveredTools: [],
      },
    ]);
    getExternalMcpServerConfigSchemaMock.mockResolvedValueOnce({
      fields: [
        { key: "command", label: "Command", type: "text", required: true },
        { key: "argsText", label: "Args JSON", type: "json", required: false },
        { key: "cwd", label: "Working Directory", type: "text", required: false },
        { key: "envJson", label: "Env JSON", type: "json", required: false },
        { key: "timeoutMs", label: "Timeout (ms)", type: "number", required: true },
      ],
      completeness: "known-partial",
      sources: ["manual"],
      notes: [],
    });
    getExternalMcpServerConfigMock.mockResolvedValueOnce({
      command: "npx",
      argsText: '[\n  "-y",\n  "@demo/local-docs-mcp"\n]',
      packageName: "@demo/local-docs-mcp",
      cwd: "D:\\workspace\\rag-demo",
      envJson: '{\n  "HTTP_PROXY": "http://127.0.0.1:7890"\n}',
      authType: "none",
      timeoutMs: 30000,
      customHeadersJson: "",
      hasBearerToken: false,
    });
    updateExternalMcpServerConfigMock.mockResolvedValueOnce({
      command: "uvx",
      argsText: '["mcparmory-github"]',
      cwd: "D:\\workspace\\rag-demo",
      envJson: '{\n  "HTTP_PROXY": "http://127.0.0.1:7890"\n}',
      authType: "none",
      timeoutMs: 30000,
      customHeadersJson: "",
      hasBearerToken: false,
    });

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

    await user.click(
      screen.getByRole("button", {
        name: "settings.mcp.installed.configure",
      }),
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Command")).toBeInTheDocument();
      expect(screen.getByLabelText("Args JSON")).toBeInTheDocument();
      expect(screen.getByLabelText("Working Directory")).toBeInTheDocument();
      expect(screen.getByLabelText("Env JSON")).toBeInTheDocument();
      expect(screen.queryByLabelText("Endpoint URL")).not.toBeInTheDocument();
      expect(screen.getByText("@demo/local-docs-mcp")).toBeInTheDocument();
    });

    await user.clear(screen.getByLabelText("Command"));
    await user.type(screen.getByLabelText("Command"), "uvx");
    await user.clear(screen.getByLabelText("Args JSON"));
    fireEvent.change(screen.getByLabelText("Args JSON"), {
      target: {
        value: '["mcparmory-github"]',
      },
    });
    fireEvent.change(screen.getByLabelText("Working Directory"), {
      target: {
        value: "D:\\workspace\\rag-demo",
      },
    });
    fireEvent.change(screen.getByLabelText("Env JSON"), {
      target: {
        value: '{\n  "HTTP_PROXY": "http://127.0.0.1:7890"\n}',
      },
    });

    await user.click(screen.getByRole("button", { name: "settings.mcp.config.save" }));

    await waitFor(() => {
      expect(updateExternalMcpServerConfigMock).toHaveBeenCalledWith("local-docs", {
        command: "uvx",
        argsText: '["mcparmory-github"]',
        cwd: "D:\\workspace\\rag-demo",
        envJson: '{\n  "HTTP_PROXY": "http://127.0.0.1:7890"\n}',
        authType: "none",
        timeoutMs: 30000,
        customHeadersJson: "",
        bearerToken: null,
      });
    });
  });

  it("shows unsupported package transports without allowing install", async () => {
    getMcpMarketplaceServersMock.mockResolvedValueOnce({
      servers: [
        {
          id: "oci-only",
          name: "oci-only",
          title: "OCI Only",
          description: "Container image MCP",
          version: "1.0.0",
          status: "active",
          isLatest: true,
          publishedAt: null,
          updatedAt: null,
          websiteUrl: null,
          repositoryUrl: null,
          transports: [
            {
              kind: "package",
              packageType: "oci",
              installable: false,
              label: "OCI image",
              packageIdentifier: "ghcr.io/example/oci-only:1.0.0",
            },
          ],
        },
      ],
      metadata: {
        count: 1,
        nextCursor: null,
        sourceUrl: "https://registry.modelcontextprotocol.io/v0/servers",
        cache: {
          hit: false,
          stale: false,
          cachedAt: null,
        },
      },
    });

    render(<McpSettings />);

    await screen.findByText("OCI Only");
    expect(screen.getByRole("button", { name: "暂不支持" })).toBeDisabled();
    expect(createExternalMcpServerMock).not.toHaveBeenCalled();
  });

  it("shows a cached marketplace hint when stale cached results are returned", async () => {
    getMcpMarketplaceServersMock.mockResolvedValueOnce({
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
          websiteUrl: "https://docs.example.dev/mcp",
          repositoryUrl: "https://github.com/example/remote-docs",
          transports: [
            {
              kind: "streamable-http",
              packageType: "remote",
              installable: true,
              label: "Remote HTTP",
              url: "https://remote.example/mcp",
            },
          ],
        },
      ],
      metadata: {
        count: 1,
        nextCursor: null,
        sourceUrl: "https://registry.modelcontextprotocol.io/v0/servers",
        cache: {
          hit: true,
          stale: true,
          cachedAt: "2026-06-27T01:05:00.000Z",
        },
      },
    });

    render(<McpSettings />);

    await screen.findByText("Remote Docs");
    expect(
      screen.getByText(/官方 MCP 市场暂时不可用，当前显示最近一次成功结果/i),
    ).toBeInTheDocument();
  });

  it("deduplicates marketplace servers with the same id before rendering", async () => {
    getMcpMarketplaceServersMock.mockResolvedValueOnce({
      servers: [
        {
          id: "ac.tandem/docs-mcp",
          name: "docs-mcp",
          title: "Docs MCP",
          description: "First entry",
          version: "1.0.0",
          status: "active",
          isLatest: true,
          publishedAt: null,
          updatedAt: null,
          websiteUrl: null,
          repositoryUrl: null,
          transports: [
            {
              kind: "streamable-http",
              packageType: "remote",
              installable: true,
              label: "Remote HTTP",
              url: "https://example.com/mcp",
            },
          ],
        },
        {
          id: "ac.tandem/docs-mcp",
          name: "docs-mcp",
          title: "Docs MCP Duplicate",
          description: "Duplicate entry",
          version: "1.0.1",
          status: "active",
          isLatest: true,
          publishedAt: null,
          updatedAt: null,
          websiteUrl: null,
          repositoryUrl: null,
          transports: [
            {
              kind: "streamable-http",
              packageType: "remote",
              installable: true,
              label: "Remote HTTP",
              url: "https://example.com/mcp-2",
            },
          ],
        },
      ],
      metadata: {
        count: 2,
        nextCursor: null,
        sourceUrl: "https://registry.modelcontextprotocol.io/v0/servers",
        cache: {
          hit: false,
          stale: false,
          cachedAt: null,
        },
      },
    });

    render(<McpSettings />);

    await screen.findByText("Docs MCP");
    expect(screen.queryByText("Docs MCP Duplicate")).not.toBeInTheDocument();
    expect(screen.getAllByText("ac.tandem/docs-mcp")).toHaveLength(1);
  });
});
