// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CodeGraphStudioPage from "../index";

const translations = {
  "settings.microApps.codeGraphStudio.page.title": "CodeGraph Studio",
  "settings.microApps.codeGraphStudio.page.description":
    "CodeGraph 用来理解代码仓结构、定位符号关系，并为后续代码检索和代码探索提供索引能力。这里可以查看它当前是否可用，并调试本地接入状态。",
  "settings.microApps.codeGraphStudio.overview.statusLabel": "当前状态：",
  "settings.microApps.codeGraphStudio.overview.description":
    "真实 CodeGraph 1.3.0 暂不支持可靠的外部索引目录，因此当前保持 blocked-safe，不会启动，也不会污染仓库。",
  "settings.microApps.codeGraphStudio.overview.nextStepsTitle": "下一步",
  "settings.microApps.codeGraphStudio.overview.nextSteps.step1.title":
    "填写 App Data Root",
  "settings.microApps.codeGraphStudio.overview.nextSteps.step1.description":
    "为日志与临时状态指定一个仓库外部目录。",
  "settings.microApps.codeGraphStudio.overview.nextSteps.step2.title":
    "保存参数并重新检测",
  "settings.microApps.codeGraphStudio.overview.nextSteps.step2.description":
    "保存后点击 detect，重新检测当前状态。",
  "settings.microApps.codeGraphStudio.overview.nextSteps.step3.title":
    "如需验证页面流程，可切换 Fake Provider",
  "settings.microApps.codeGraphStudio.overview.nextSteps.step3.description":
    "使用 Fake Provider 运行 Smoke，验证页面流程，不代表真实 CodeGraph 可用。",
  "settings.microApps.codeGraphStudio.overview.chips.agentCapability": "智能体能力：{{value}}",
  "settings.microApps.codeGraphStudio.overview.chips.telemetry": "Telemetry：{{value}}",
  "settings.microApps.codeGraphStudio.overview.chips.pollution": "仓库污染：{{value}}",
  "settings.microApps.codeGraphStudio.overview.chips.fakeProvider": "Fake Provider：{{value}}",
  "settings.microApps.codeGraphStudio.values.disabled": "关闭",
  "settings.microApps.codeGraphStudio.values.unavailable": "不可用",
  "settings.microApps.codeGraphStudio.values.notDetected": "未发现",
  "settings.microApps.codeGraphStudio.values.availableForValidation": "可用",
  "settings.microApps.codeGraphStudio.values.ready": "ready",
  "settings.microApps.codeGraphStudio.values.blocked": "blocked",
  "settings.microApps.codeGraphStudio.blockedCards.appDataRoot.title":
    "A. 缺少 App Data Root",
  "settings.microApps.codeGraphStudio.blockedCards.appDataRoot.description":
    "需要一个仓库外部目录来保存日志和临时状态。",
  "settings.microApps.codeGraphStudio.blockedCards.appDataRoot.badge": "可处理",
  "settings.microApps.codeGraphStudio.blockedCards.externalIndex.title":
    "B. CodeGraph 1.3.0 不支持外部 Index Root",
  "settings.microApps.codeGraphStudio.blockedCards.externalIndex.description":
    "真实 provider 仍会要求 repo-root `.codegraph`，因此当前不可启动。",
  "settings.microApps.codeGraphStudio.blockedCards.externalIndex.badge":
    "当前不可解除",
  "settings.microApps.codeGraphStudio.blockedCards.pollutionGuard.title":
    "C. 污染保护已启用",
  "settings.microApps.codeGraphStudio.blockedCards.pollutionGuard.description":
    "如果 repo root 出现 `.codegraph`，系统会阻断 ready，且不会删除用户文件。",
  "settings.microApps.codeGraphStudio.blockedCards.pollutionGuard.badge": "保护中",
  "settings.microApps.codeGraphStudio.cards.blockedReasons.title": "阻断原因",
  "settings.microApps.codeGraphStudio.cards.pollutionSummary.title": "污染保护摘要",
  "settings.microApps.codeGraphStudio.cards.pollutionSummary.behavior":
    "发现污染即阻断，不删除用户文件",
  "settings.microApps.codeGraphStudio.cards.pollutionSummary.noticeTitle":
    "这是保护机制，不是报错。",
  "settings.microApps.codeGraphStudio.cards.pollutionSummary.noticeBody":
    "repo-root `.codegraph` 一旦出现，系统只会阻断 ready，不会替你删除用户文件。",
  "settings.microApps.codeGraphStudio.cards.config.title": "基础配置",
  "settings.microApps.codeGraphStudio.cards.config.description":
    "这里只保留 owner 常用参数。Probe args、索引路径和日志路径统一收进高级配置。",
  "settings.microApps.codeGraphStudio.cards.config.appDataRootHelp":
    "用于保存日志与临时状态。必须位于仓库外部，建议选择长期可用的目录。",
  "settings.microApps.codeGraphStudio.cards.capability.microAppHint":
    "关闭后，CodeGraph 微应用本身不再参与受控 capability 注册。",
  "settings.microApps.codeGraphStudio.cards.capability.agentCapabilityHint":
    "允许智能体使用 CodeGraph。只有 runtime ready、telemetry verified_off、workspace 匹配、repo pollution guard safe 且 App Data Root 合法时才会真正生效。",
  "settings.microApps.codeGraphStudio.cards.capability.statusTitle":
    "当前 capability 状态：{{value}}",
  "settings.microApps.codeGraphStudio.cards.capability.registered":
    "Harness 已注册 `codebase_explore`，但仍只暴露受控 capability，不会把原生命令暴露给 Planner。",
  "settings.microApps.codeGraphStudio.cards.capability.unavailable":
    "当前还不能注册 `codebase_explore`，请先满足上面的 ready gate。",
  "settings.microApps.codeGraphStudio.cards.advanced.title": "高级配置（可选）",
  "settings.microApps.codeGraphStudio.cards.advanced.meta":
    "默认折叠。这里放 probe args、logRoot、indexRoot 等开发调试字段。",
  "settings.microApps.codeGraphStudio.cards.actions.title": "运行时动作",
  "settings.microApps.codeGraphStudio.cards.actions.description":
    "detect 和 health 可随时重新检查状态；start 和 stop 会按 blocked-safe 规则受限。",
  "settings.microApps.codeGraphStudio.cards.actions.startHintBlocked":
    "真实 provider 当前 blocked，禁止启动。",
  "settings.microApps.codeGraphStudio.cards.actions.startHintFake":
    "已切到 Fake Provider。保存参数后可继续 detect / start 验证页面流程。",
  "settings.microApps.codeGraphStudio.cards.smoke.title": "Smoke 验证",
  "settings.microApps.codeGraphStudio.cards.smoke.description":
    "真实 provider blocked 时，这里会明确显示 blocked，不会被解释成 empty result。",
  "settings.microApps.codeGraphStudio.cards.smoke.modes.real": "真实 Provider",
  "settings.microApps.codeGraphStudio.cards.smoke.modes.fake": "Fake Provider",
  "settings.microApps.codeGraphStudio.cards.smoke.realTitle": "真实 Provider",
  "settings.microApps.codeGraphStudio.cards.smoke.realBlocked":
    "当前 blocked，不能运行 smoke query。",
  "settings.microApps.codeGraphStudio.cards.smoke.realDisabledHint":
    "真实 provider 当前 blocked，smoke query 已禁用。",
  "settings.microApps.codeGraphStudio.cards.smoke.fakeTitle": "Fake Provider",
  "settings.microApps.codeGraphStudio.cards.smoke.fakeDescription":
    "Fake Provider 仅用于验证页面流程，不代表真实 CodeGraph 可用。",
  "settings.microApps.codeGraphStudio.cards.smoke.fakeToggleTitle":
    "切换到 Fake Provider 可验证页面流程",
  "settings.microApps.codeGraphStudio.cards.smoke.fakeToggleHint":
    "切换后会把 command 与 probe args 改成测试 provider。建议先保存参数，再执行 detect / start。",
  "settings.microApps.codeGraphStudio.cards.smoke.fakeDisabledHint":
    "切到 Fake Provider 后，先保存参数并执行 detect / start，再运行 Smoke。",
  "settings.microApps.codeGraphStudio.cards.smokeResult.title": "Smoke 结果",
  "settings.microApps.codeGraphStudio.cards.smokeResult.description":
    "如果真实 provider 仍 blocked，这里会明确显示 blocked，不会把它解释成空结果。",
  "settings.microApps.codeGraphStudio.cards.smokeResult.metrics.status": "状态",
  "settings.microApps.codeGraphStudio.cards.smokeResult.metrics.candidates":
    "候选数",
  "settings.microApps.codeGraphStudio.cards.smokeResult.metrics.content":
    "结果片段",
  "settings.microApps.codeGraphStudio.cards.debug.title": "原始调试报告",
  "settings.microApps.codeGraphStudio.cards.debug.meta": "供开发调试使用",
  "settings.microApps.codeGraphStudio.cards.debug.helperTitle": "这里保留原始字段",
  "settings.microApps.codeGraphStudio.cards.debug.helperBody":
    "原始 JSON 只放在折叠区，避免它抢走 owner 第一屏的阅读顺序。",
  "settings.microApps.codeGraphStudio.fields.guardStatus": "guardStatus",
  "settings.microApps.codeGraphStudio.fields.repoDataDirPath": "repoDataDirPath",
  "settings.microApps.codeGraphStudio.fields.exists": "exists",
  "settings.microApps.codeGraphStudio.fields.behavior": "行为",
  "settings.microApps.codeGraphStudio.fields.workspaceRootReadonly":
    "Workspace Root（只读）",
  "settings.microApps.codeGraphStudio.fields.microAppEnabled":
    "启用 CodeGraph 微应用",
  "settings.microApps.codeGraphStudio.fields.agentCapabilityEnabled":
    "允许智能体使用 CodeGraph",
  "settings.microApps.codeGraphStudio.fields.command": "Command",
  "settings.microApps.codeGraphStudio.fields.appDataRootRequired":
    "App Data Root（必填）",
  "settings.microApps.codeGraphStudio.fields.logRoot": "logRoot",
  "settings.microApps.codeGraphStudio.fields.indexRoot": "indexRoot",
  "settings.microApps.codeGraphStudio.fields.startArgs": "startArgs",
  "settings.microApps.codeGraphStudio.fields.versionProbeArgs":
    "versionProbeArgs",
  "settings.microApps.codeGraphStudio.fields.telemetryProbeArgs":
    "telemetryProbeArgs",
  "settings.microApps.codeGraphStudio.fields.timeoutMs": "Timeout (ms)",
  "settings.microApps.codeGraphStudio.fields.maxResults": "Max Results",
  "settings.microApps.codeGraphStudio.fields.queryLimit": "Query Limit",
  "settings.microApps.codeGraphStudio.fields.smokeQuery": "Smoke Query",
  "settings.microApps.codeGraphStudio.placeholders.appDataRoot":
    "请选择或输入一个仓库外部目录作为 App Data Root",
  "settings.microApps.codeGraphStudio.actions.refresh": "刷新",
  "settings.microApps.codeGraphStudio.actions.saveConfig": "保存参数",
  "settings.microApps.codeGraphStudio.actions.detect": "detect",
  "settings.microApps.codeGraphStudio.actions.start": "start",
  "settings.microApps.codeGraphStudio.actions.health": "health",
  "settings.microApps.codeGraphStudio.actions.stop": "stop",
  "settings.microApps.codeGraphStudio.actions.smokeStatus":
    "运行 Smoke Status",
  "settings.microApps.codeGraphStudio.actions.smokeQuery": "运行 Smoke",
  "settings.microApps.codeGraphStudio.actions.useRecommendedRoot":
    "使用推荐目录",
  "settings.microApps.codeGraphStudio.actions.copyDebug": "复制调试报告",
  "settings.microApps.codeGraphStudio.states.loading":
    "正在加载 CodeGraph Studio...",
  "settings.microApps.codeGraphStudio.states.emptySmokeTitle":
    "当前没有可用结果",
  "settings.microApps.codeGraphStudio.states.emptySmoke":
    "真实 provider blocked 时，这里会明确显示 blocked，不会被解释成空结果。",
  "settings.microApps.codeGraphStudio.messages.loadFailed":
    "加载 CodeGraph Studio 失败",
  "settings.microApps.codeGraphStudio.messages.configSaved":
    "CodeGraph Studio 参数已保存",
  "settings.microApps.codeGraphStudio.messages.configSaveFailed":
    "保存 CodeGraph Studio 参数失败",
  "settings.microApps.codeGraphStudio.messages.actionExecuted":
    "{{action}} 已执行",
  "settings.microApps.codeGraphStudio.messages.actionFailed":
    "CodeGraph 操作失败",
  "settings.microApps.codeGraphStudio.messages.debugCopied":
    "原始调试报告已复制",
  "settings.microApps.codeGraphStudio.messages.debugCopyFailed":
    "复制原始调试报告失败",
} as const;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const template = translations[key as keyof typeof translations] ?? key;
      if (!options) {
        return template;
      }
      return template.replace(/\{\{(\w+)\}\}/g, (_, token: string) =>
        String(options[token] ?? ""),
      );
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
      message: "raw app data root issue",
    },
    {
      code: "external_index_root_unsupported" as const,
      label: "External Index Root Unsupported",
      message: "raw external index issue",
    },
    {
      code: "repo_pollution_risk" as const,
      label: "Repo Pollution Risk",
      message: "raw repo pollution issue",
    },
  ],
  config: {
    workspaceRoot: "D:\\workspace\\rag-demo\\server",
    appDataRoot: "",
    appDataRootResolved: null,
    logRoot: null,
    indexRoot: null,
    microAppEnabled: true,
    agentCapabilityEnabled: false,
    command: "codegraph",
    startArgs: ["serve", "--mcp"],
    versionProbeArgs: ["--version"],
    telemetryProbeArgs: ["telemetry", "status"],
    timeoutMs: 2000,
    maxResults: 5,
    queryLimit: 5,
    capabilityRegistered: false,
  },
  capability: {
    available: false,
    registered: false,
    reasons: [
      {
        code: "agent_capability_disabled",
        message: "Owner has not allowed the agent to use CodeGraph.",
      },
    ],
    checks: {
      microAppEnabled: true,
      agentCapabilityEnabled: false,
      runtimeReady: false,
      telemetryVerifiedOff: false,
      workspaceMatched: true,
      repoPollutionSafe: false,
      appDataRootValid: false,
      capabilityRegistrationReady: false,
    },
  },
  pollutionGuard: {
    status: "blocked" as const,
    repoDataDirName: ".codegraph",
    repoDataDirPath: "D:\\workspace\\rag-demo\\server\\.codegraph",
    exists: false,
    blockedReason: "raw repo pollution issue",
  },
  runtime: {
    providerVersion: "1.3.0",
    telemetryStatus: "not_verified",
    handshakeStatus: "not_started",
    initializedNotificationSent: false,
    processAlive: false,
    startedAt: null,
    stoppedAt: null,
    durationMs: null,
    exitCode: null,
    lastStatus: null,
    lastError: "blocked",
    crashCount: 0,
    startDisposition: null,
  },
  debug: {
    workspaceHash: "workspace-hash",
    plannerStorage: {
      status: "blocked",
      source: "missing_app_data_root",
    },
    externalIndexSupport: {
      status: "blocked",
    },
    detectReasons: ["repo_pollution_risk"],
    rawManagerStatus: "blocked",
  },
};

describe("CodeGraphStudioPage", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
    apiMocks.getCodeGraphStudioReport.mockResolvedValue(baseReport);
    apiMocks.saveCodeGraphStudioConfig.mockResolvedValue(baseReport);
    apiMocks.detectCodeGraphStudio.mockResolvedValue({ report: baseReport });
    apiMocks.startCodeGraphStudio.mockResolvedValue({ report: baseReport });
    apiMocks.healthCodeGraphStudio.mockResolvedValue({ report: baseReport });
    apiMocks.stopCodeGraphStudio.mockResolvedValue({ report: baseReport });
    apiMocks.smokeStatusCodeGraphStudio.mockResolvedValue({
      kind: "status",
      ok: false,
      message: "blocked",
      payload: null,
      report: baseReport,
    });
    apiMocks.smokeQueryCodeGraphStudio.mockResolvedValue({
      kind: "query",
      ok: false,
      message: "CodeGraph is not ready for smoke query.",
      payload: null,
      report: baseReport,
    });
  });

  it("shows a readable blocked overview without leaking i18n keys", async () => {
    render(<CodeGraphStudioPage />);

    await waitFor(() => {
      expect(screen.getByText("Blocked")).toBeInTheDocument();
    });

    expect(screen.getByText("填写 App Data Root")).toBeInTheDocument();
    expect(
      screen.queryByText(/settings\.microApps\.codeGraphStudio\./),
    ).not.toBeInTheDocument();
  });

  it("deduplicates owner-facing blocked reasons into summary cards", async () => {
    render(<CodeGraphStudioPage />);

    await waitFor(() => {
      expect(screen.getByTestId("blocked-summary-app-data-root")).toBeInTheDocument();
    });

    expect(
      screen.getByText("A. 缺少 App Data Root"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("B. CodeGraph 1.3.0 不支持外部 Index Root"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("C. 污染保护已启用"),
    ).toBeInTheDocument();
    expect(screen.queryByText("raw external index issue")).not.toBeInTheDocument();
  });

  it("shows the recommended app data root action when appDataRoot is empty", async () => {
    render(<CodeGraphStudioPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "使用推荐目录" })).toBeInTheDocument();
    });

    expect(
      screen.getByPlaceholderText("请选择或输入一个仓库外部目录作为 App Data Root"),
    ).toBeInTheDocument();
  });

  it("shows the owner-facing capability switches", async () => {
    render(<CodeGraphStudioPage />);

    await waitFor(() => {
      expect(screen.getByText("启用 CodeGraph 微应用")).toBeInTheDocument();
    });

    expect(screen.getByText("允许智能体使用 CodeGraph")).toBeInTheDocument();
    expect(
      screen.getByText("Owner has not allowed the agent to use CodeGraph."),
    ).toBeInTheDocument();
  });

  it("keeps start disabled when the real provider is blocked", async () => {
    render(<CodeGraphStudioPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "start" })).toBeDisabled();
    });

    expect(
      screen.getByText("真实 provider 当前 blocked，禁止启动。"),
    ).toBeInTheDocument();
  });

  it("disables smoke actions in real-provider blocked mode", async () => {
    render(<CodeGraphStudioPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "运行 Smoke" })).toBeDisabled();
    });

    expect(screen.getByRole("button", { name: "运行 Smoke Status" })).toBeDisabled();
  });

  it("shows fake provider guidance for page-flow validation", async () => {
    render(<CodeGraphStudioPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Fake Provider" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Fake Provider" }));

    expect(
      screen.getByText("Fake Provider 仅用于验证页面流程，不代表真实 CodeGraph 可用。"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("切换到 Fake Provider 可验证页面流程"),
    ).toBeInTheDocument();
  });

  it("keeps the raw debug report folded by default", async () => {
    render(<CodeGraphStudioPage />);

    await screen.findByText("原始调试报告");
    expect(screen.queryByText(/"status":/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "复制调试报告" }),
    ).toBeInTheDocument();
  });

  it("shows the raw debug report after expanding the debug card", async () => {
    render(<CodeGraphStudioPage />);

    await screen.findByText("原始调试报告");
    fireEvent.click(screen.getByRole("button", { name: "原始调试报告" }));

    expect(screen.getByText(/"status":/)).toBeInTheDocument();
  });

  it("keeps blocked state out of the empty-result path", async () => {
    render(<CodeGraphStudioPage />);

    await waitFor(() => {
      expect(screen.getByTestId("codegraph-smoke-result-card")).toBeInTheDocument();
    });

    expect(screen.getByText("当前没有可用结果")).toBeInTheDocument();
    expect(
      screen.getByText(
        "真实 provider blocked 时，这里会明确显示 blocked，不会被解释成空结果。",
      ),
    ).toBeInTheDocument();
  });
});
