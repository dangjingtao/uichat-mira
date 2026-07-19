// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CodeGraphStudioPage from "../index";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === "settings.microApps.codeGraphStudio.page.title") return "CodeGraph";
      if (key === "settings.microApps.codeGraphStudio.page.description") {
        return "CodeGraph runtime debugger";
      }
      return key;
    },
  }),
}));

const apiMocks = vi.hoisted(() => ({
  getCodeGraphStudioReport: vi.fn(),
  saveCodeGraphStudioConfig: vi.fn(),
  detectCodeGraphStudio: vi.fn(),
  startCodeGraphStudio: vi.fn(),
  healthCodeGraphStudio: vi.fn(),
  stopCodeGraphStudio: vi.fn(),
  smokeStatusCodeGraphStudio: vi.fn(),
  smokeQueryCodeGraphStudio: vi.fn(),
}));

vi.mock("@/shared/api/codegraphStudio", () => ({
  getCodeGraphStudioReport: apiMocks.getCodeGraphStudioReport,
  saveCodeGraphStudioConfig: apiMocks.saveCodeGraphStudioConfig,
  detectCodeGraphStudio: apiMocks.detectCodeGraphStudio,
  startCodeGraphStudio: apiMocks.startCodeGraphStudio,
  healthCodeGraphStudio: apiMocks.healthCodeGraphStudio,
  stopCodeGraphStudio: apiMocks.stopCodeGraphStudio,
  smokeStatusCodeGraphStudio: apiMocks.smokeStatusCodeGraphStudio,
  smokeQueryCodeGraphStudio: apiMocks.smokeQueryCodeGraphStudio,
}));

const baseReport = {
  status: "blocked" as const,
  blockedReasons: [
    {
      code: "app_data_root_unavailable" as const,
      label: "App Data Root Unavailable",
      message: "Studio default runtime is blocked",
    },
  ],
  config: {
    workspaceRoot: "D:\\workspace\\studio-default",
    appDataRoot: "D:\\codegraph-appdata",
    appDataRootResolved: "D:\\codegraph-appdata",
    logRoot: "D:\\codegraph-appdata\\logs",
    indexRoot: "D:\\codegraph-appdata\\index",
    microAppEnabled: true,
    agentCapabilityEnabled: true,
    command: "codegraph",
    startArgs: ["serve", "--mcp"],
    versionProbeArgs: ["--version"],
    telemetryProbeArgs: ["telemetry", "status"],
    timeoutMs: 2000,
    maxResults: 5,
    queryLimit: 5,
    capabilityRegistered: true,
  },
  capability: {
    available: true,
    registered: true,
    reasons: [],
    checks: {
      microAppEnabled: true,
      agentCapabilityEnabled: true,
      runtimeReady: false,
      telemetryVerifiedOff: true,
      workspaceMatched: true,
      repoPollutionSafe: true,
      appDataRootValid: true,
      capabilityRegistrationReady: true,
    },
  },
  pollutionGuard: {
    status: "ready" as const,
    repoDataDirName: ".codegraph",
    repoDataDirPath: "D:\\workspace\\studio-default\\.codegraph",
    exists: false,
    blockedReason: null,
  },
  runtime: {
    providerVersion: "1.3.0",
    telemetryStatus: "verified_off",
    handshakeStatus: "not_started",
    initializedNotificationSent: false,
    processAlive: false,
    startedAt: null,
    stoppedAt: null,
    durationMs: null,
    exitCode: null,
    lastStatus: null,
    lastError: null,
    crashCount: 0,
    startDisposition: null,
  },
  debug: {
    workspaceHash: "studio-workspace-hash",
    plannerStorage: {},
    externalIndexSupport: {},
    detectReasons: [],
    rawManagerStatus: "blocked",
  },
};

describe("CodeGraphStudioPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getCodeGraphStudioReport.mockResolvedValue(baseReport);
    apiMocks.saveCodeGraphStudioConfig.mockResolvedValue(baseReport);
    apiMocks.detectCodeGraphStudio.mockResolvedValue({ report: baseReport });
    apiMocks.startCodeGraphStudio.mockResolvedValue({ report: baseReport });
    apiMocks.healthCodeGraphStudio.mockResolvedValue({ report: baseReport });
    apiMocks.stopCodeGraphStudio.mockResolvedValue({ report: baseReport });
    apiMocks.smokeStatusCodeGraphStudio.mockResolvedValue({
      kind: "status",
      ok: true,
      message: "ready",
      payload: { workspaceRoot: "D:\\workspace\\uichat-mira" },
      report: baseReport,
    });
    apiMocks.smokeQueryCodeGraphStudio.mockResolvedValue({
      kind: "query",
      ok: true,
      message: "verified",
      payload: {
        workspaceRoot: "D:\\workspace\\uichat-mira",
        verifiedCount: 3,
      },
      report: baseReport,
    });
  });

  it("uses the Studio workspace only as the initial debug path", async () => {
    render(<CodeGraphStudioPage />);

    await waitFor(() => {
      expect(
        screen.getByDisplayValue("D:\\workspace\\studio-default"),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Agent 实际运行按线程绑定当前 workspace/),
    ).toBeInTheDocument();
  });

  it("keeps path smoke available even when the Studio default runtime is blocked", async () => {
    render(<CodeGraphStudioPage />);

    const smokeButton = await screen.findByRole("button", { name: "运行 Smoke" });
    const statusButton = screen.getByRole("button", { name: "运行 Smoke Status" });

    expect(smokeButton).toBeEnabled();
    expect(statusButton).toBeEnabled();
  });

  it("passes the explicitly configured debug workspace path to smoke query", async () => {
    render(<CodeGraphStudioPage />);

    const pathInput = await screen.findByDisplayValue("D:\\workspace\\studio-default");
    fireEvent.change(pathInput, {
      target: { value: "D:\\workspace\\uichat-mira" },
    });

    fireEvent.click(screen.getByRole("button", { name: "运行 Smoke" }));

    await waitFor(() => {
      expect(apiMocks.smokeQueryCodeGraphStudio).toHaveBeenCalledWith(
        "Planner -> Normalize -> Policy -> ToolNode -> Evidence",
        "D:\\workspace\\uichat-mira",
      );
    });
  });

  it("passes the explicitly configured debug workspace path to smoke status", async () => {
    render(<CodeGraphStudioPage />);

    const pathInput = await screen.findByDisplayValue("D:\\workspace\\studio-default");
    fireEvent.change(pathInput, {
      target: { value: "D:\\workspace\\uichat-mira" },
    });

    fireEvent.click(screen.getByRole("button", { name: "运行 Smoke Status" }));

    await waitFor(() => {
      expect(apiMocks.smokeStatusCodeGraphStudio).toHaveBeenCalledWith(
        "D:\\workspace\\uichat-mira",
      );
    });
  });

  it("keeps one product switch for microapp and agent capability", async () => {
    render(<CodeGraphStudioPage />);

    const productSwitch = await screen.findByRole("switch", {
      name: "启用 CodeGraph 微应用",
    });
    fireEvent.click(productSwitch);

    await waitFor(() => {
      expect(apiMocks.saveCodeGraphStudioConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          microAppEnabled: false,
          agentCapabilityEnabled: false,
        }),
      );
    });
  });
});
