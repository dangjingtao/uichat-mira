import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { llmToolSelectorMiddleware } from "langchain";
import {
  buildMockTools,
  capabilityByToolId,
  mockCapabilities,
  selectorFixtures,
  type SelectorFixture,
} from "./selector-fixtures.js";
import {
  capabilitySummary,
  computeMetrics,
  countFixturesByDomain,
  countFixturesByGroup,
  deterministicDomainGate,
  formatMetricsTable,
  type SelectorMetrics,
  type SelectorPrediction,
} from "./selector-evaluator.js";
import {
  inspectDeepAgentsMiddleware,
  type MiddlewareInspectionRow,
} from "./middleware-inspection.js";

type StrategyName =
  | "middleware_wiring_fake_model"
  | "deterministic_domain_gate"
  | "domain_gate_plus_fake_model_wiring"
  | "real_model_selector_baseline"
  | "domain_gate_plus_real_model_selector";

type ExperimentStatus = "PASS" | "SKIPPED" | "BLOCKED";

type ExperimentPurpose =
  | "wiring_smoke_test"
  | "domain_gate_baseline"
  | "selector_quality_baseline"
  | "combined_baseline";

type SelectorRunResult = {
  strategy: StrategyName;
  purpose: ExperimentPurpose;
  status: ExperimentStatus;
  description: string;
  metrics?: SelectorMetrics;
  predictions: SelectorPrediction[];
  reason?: string;
};

type HighRiskCase = {
  strategy: StrategyName;
  fixtureId: string;
  fixtureGroup: string;
  userMessage: string;
  expectedDomain: string;
  selectedDomain: string;
  expectedToolIds: string[];
  selectedToolIds: string[];
};

type FakeStructuredSelectorResponse = {
  tools: string[];
};

type RealSelectorConfig = {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
};

type ReportStatus = {
  middlewareWiring: "PASS" | "FAIL";
  realSelectorBaseline: "PASS" | "SKIPPED" | "BLOCKED";
  selectorQuality: "PROVEN" | "NOT PROVEN";
  middlewareExtractability: "PASS" | "PARTIAL" | "FAIL";
  t03Recommendation: "GO" | "BLOCKED" | "CONTROLLED_SPIKE_ONLY";
};

class FakeSelectorModel {
  public lastResponse: FakeStructuredSelectorResponse | null = null;

  withStructuredOutput(schema: unknown) {
    const availableToolNames = extractToolNamesFromSchema(schema);
    return {
      invoke: async (messages: Array<{ content?: unknown } | HumanMessage>) => {
        const lastMessage = messages.at(-1);
        const userText =
          typeof lastMessage === "object" && lastMessage && "content" in lastMessage
            ? stringifyContent(lastMessage.content)
            : "";
        const tools = this.selectTools(userText, availableToolNames);
        this.lastResponse = { tools };
        return this.lastResponse;
      },
    };
  }

  private selectTools(userText: string, availableToolNames: string[]) {
    const text = userText.toLowerCase();
    const picks: string[] = [];

    const pushIfAvailable = (toolId: string) => {
      if (availableToolNames.includes(toolId) && !picks.includes(toolId)) {
        picks.push(toolId);
      }
    };

    if (/先别发|不要执行|不要跑|不要查|先判断|先别动代码/.test(text)) {
      return [];
    }

    if (/企微|企业微信|项目群|研发群|运维群|通知/.test(text)) {
      if (/通讯录|部门|联系人|组织架构/.test(text)) {
        pushIfAvailable("wecom.directory_lookup");
      } else {
        pushIfAvailable("wecom.notify");
      }
    }

    if (/飞书|bitable|多维表/.test(text)) {
      if (/bitable|多维表|表/.test(text)) {
        pushIfAvailable("feishu.bitable_query");
      } else {
        pushIfAvailable("feishu.doc_search");
      }
    }

    if (/上次|之前|回忆|记得/.test(text)) {
      pushIfAvailable("memory.lookup");
    }

    if (/知识库|文档库|索引资料|内部索引|rag/.test(text)) {
      pushIfAvailable("rag.query");
    }

    if (/最新|今天|最近|联网|官网|npm 版本|issue|搜索|公开资料|外部/.test(text)) {
      pushIfAvailable("web.search");
    }

    if (/pnpm|git status|powershell|shell|终端|curl |执行 |运行 |命令/.test(text)) {
      pushIfAvailable("terminal.session");
    }

    if (/目录|结构|有哪些文件夹|列出/.test(text)) {
      pushIfAvailable("workspace.read_list");
    } else if (/定位|哪儿|在哪里|搜一下|找一下|仓库里有没有提过/.test(text)) {
      pushIfAvailable("workspace.read_locate");
    } else if (
      /打开|读取|读一下|看一下|readme|package\.json|runtime\.config|agents\.md|文件|仓库|repo|代码/.test(
        text,
      )
    ) {
      pushIfAvailable("workspace.read_open");
    }

    if (/给客户发消息|删掉|删除|重建/.test(text)) {
      pushIfAvailable("wecom.notify");
      pushIfAvailable("terminal.session");
    }

    return picks.slice(0, 3);
  }
}

class RecordingSelectorModel {
  public lastResponse: unknown;

  constructor(private readonly model: unknown) {}

  withStructuredOutput(schema: unknown) {
    const modelWithStructuredOutput = this.model as {
      withStructuredOutput?: (schema: unknown) => {
        invoke: (
          messages: Array<{ content?: unknown } | HumanMessage>,
          config?: unknown,
        ) => Promise<unknown>;
      };
    };
    const structuredModel = modelWithStructuredOutput.withStructuredOutput?.(schema);
    if (!structuredModel) {
      throw new Error("The provided model does not support withStructuredOutput.");
    }

    return {
      invoke: async (
        messages: Array<{ content?: unknown } | HumanMessage>,
        config?: unknown,
      ) => {
        const response = await structuredModel.invoke(messages, config);
        this.lastResponse = response;
        return response;
      },
    };
  }
}

const stringifyContent = (content: unknown) => {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map((item) => JSON.stringify(item)).join("\n");
  }

  return JSON.stringify(content);
};

const extractToolNamesFromSchema = (schema: unknown): string[] => {
  const shapeSource =
    typeof schema === "object" && schema && "shape" in schema
      ? (schema as { shape?: Record<string, unknown> }).shape
      : undefined;
  const shape =
    typeof shapeSource === "function"
      ? (shapeSource as () => Record<string, unknown>)()
      : shapeSource;
  const toolsField = shape?.tools as
    | {
        _def?: {
          type?: {
            _def?: {
              options?: Array<{ _def?: { value?: string } }>;
            };
          };
        };
      }
    | undefined;
  const options = toolsField?._def?.type?._def?.options ?? [];
  return options
    .map((option) => option?._def?.value)
    .filter((value): value is string => typeof value === "string");
};

const fixtureMessages = (fixture: SelectorFixture) => [
  ...(fixture.history ?? []).map((message) =>
    message.role === "user"
      ? new HumanMessage(message.content)
      : new AIMessage(message.content),
  ),
  new HumanMessage(fixture.userMessage),
];

const selectedDomainFromTools = (selectedToolIds: string[]) =>
  selectedToolIds.length === 0
    ? "none"
    : capabilityByToolId[selectedToolIds[0]]?.domain ?? "none";

const runSelectorForFixture = async (
  fixture: SelectorFixture,
  selectorModel: FakeSelectorModel | RecordingSelectorModel,
  tools = buildMockTools(),
): Promise<SelectorPrediction> => {
  const middleware = llmToolSelectorMiddleware({
    model: selectorModel as never,
    maxTools: 3,
  });

  const request = {
    model: { provider: "selector-main-model" },
    tools,
    messages: fixtureMessages(fixture),
    runtime: {
      context: {},
      configurable: {},
    },
    state: {},
  } as never;

  let selectedToolIds: string[] = tools.map((item) => item.name);
  await middleware.wrapModelCall?.(request, async (modifiedRequest) => {
    selectedToolIds = (modifiedRequest.tools ?? [])
      .filter(
        (item): item is { name: string } =>
          typeof item === "object" && item !== null && "name" in item,
      )
      .map((item) => item.name);
    return new AIMessage("selector baseline ok");
  });

  return {
    fixtureId: fixture.id,
    fixtureGroup: fixture.group,
    userMessage: fixture.userMessage,
    expected: fixture.expected,
    selectedToolIds,
    selectedDomain: selectedDomainFromTools(selectedToolIds),
    shouldUseTool: selectedToolIds.length > 0,
    rawSelectorOutput: selectorModel.lastResponse,
    notes: fixture.notes,
  };
};

const filterToolsByDomain = (
  domain: SelectorFixture["expected"]["domain"],
): ReturnType<typeof buildMockTools> => {
  if (domain === "none") {
    return [];
  }

  const allowedIds = new Set(
    mockCapabilities.filter((item) => item.domain === domain).map((item) => item.id),
  );
  return buildMockTools().filter((item) => allowedIds.has(item.name));
};

const runExperimentFakeWiring = async (): Promise<SelectorRunResult> => {
  const tools = buildMockTools();
  const predictions: SelectorPrediction[] = [];

  for (const fixture of selectorFixtures) {
    predictions.push(await runSelectorForFixture(fixture, new FakeSelectorModel(), tools));
  }

  return {
    strategy: "middleware_wiring_fake_model",
    purpose: "wiring_smoke_test",
    status: "PASS",
    description:
      "FakeSelectorModel only verifies llmToolSelectorMiddleware wiring, structured output parsing, and tool filtering. It is not a selector quality baseline.",
    metrics: computeMetrics(predictions),
    predictions,
  };
};

const runExperimentDomainGateOnly = (): SelectorRunResult => {
  const predictions: SelectorPrediction[] = selectorFixtures.map((fixture) => {
    const gate = deterministicDomainGate(fixture);
    return {
      fixtureId: fixture.id,
      fixtureGroup: fixture.group,
      userMessage: fixture.userMessage,
      expected: fixture.expected,
      selectedToolIds: [],
      selectedDomain: gate.domain,
      shouldUseTool: gate.shouldUseTool,
      rawSelectorOutput: gate,
      notes: gate.reason,
    };
  });

  return {
    strategy: "deterministic_domain_gate",
    purpose: "domain_gate_baseline",
    status: "PASS",
    description: "Deterministic domain gate baseline with no selector model involved.",
    metrics: computeMetrics(predictions),
    predictions,
  };
};

const runExperimentDomainGatePlusFakeWiring =
  async (): Promise<SelectorRunResult> => {
    const predictions: SelectorPrediction[] = [];

    for (const fixture of selectorFixtures) {
      const gate = deterministicDomainGate(fixture);
      if (!gate.shouldUseTool || gate.domain === "none") {
        predictions.push({
          fixtureId: fixture.id,
          fixtureGroup: fixture.group,
          userMessage: fixture.userMessage,
          expected: fixture.expected,
          selectedToolIds: [],
          selectedDomain: "none",
          shouldUseTool: false,
          rawSelectorOutput: { gate },
          notes: gate.reason,
        });
        continue;
      }

      const selectorModel = new FakeSelectorModel();
      const predicted = await runSelectorForFixture(
        fixture,
        selectorModel,
        filterToolsByDomain(gate.domain),
      );
      predictions.push({
        ...predicted,
        rawSelectorOutput: {
          gate,
          selector: predicted.rawSelectorOutput,
        },
      });
    }

    return {
      strategy: "domain_gate_plus_fake_model_wiring",
      purpose: "combined_baseline",
      status: "PASS",
      description:
        "Domain gate plus FakeSelectorModel wiring. This only verifies the combined pipeline shape and should not be used as real selector quality evidence.",
      metrics: computeMetrics(predictions),
      predictions,
    };
  };

const getRealSelectorConfig = (): RealSelectorConfig => ({
  baseUrl: process.env.DEEPAGENTS_SELECTOR_BASE_URL?.trim(),
  apiKey: process.env.DEEPAGENTS_SELECTOR_API_KEY?.trim() || "not-needed",
  model: process.env.DEEPAGENTS_SELECTOR_MODEL?.trim(),
});

const getRealSelectorSkipReason = (config: RealSelectorConfig) => {
  const missing: string[] = [];
  if (!config.baseUrl) {
    missing.push("DEEPAGENTS_SELECTOR_BASE_URL");
  }
  if (!config.model) {
    missing.push("DEEPAGENTS_SELECTOR_MODEL");
  }
  if (missing.length === 0) {
    return null;
  }
  return `Missing real selector configuration: ${missing.join(", ")}.`;
};

const asMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const createRealSelectorModel = (config: RealSelectorConfig) =>
  new RecordingSelectorModel(
    new ChatOpenAI({
      apiKey: config.apiKey,
      model: config.model ?? "unknown-model",
      temperature: 0,
      configuration: {
        baseURL: config.baseUrl,
      },
    }),
  );

const runExperimentRealSelectorOnly =
  async (): Promise<SelectorRunResult> => {
    const config = getRealSelectorConfig();
    const skipReason = getRealSelectorSkipReason(config);
    if (skipReason) {
      return {
        strategy: "real_model_selector_baseline",
        purpose: "selector_quality_baseline",
        status: "SKIPPED",
        description:
          "Real selector baseline using an OpenAI-compatible endpoint. Skipped when the environment is not configured.",
        predictions: [],
        reason: skipReason,
      };
    }

    try {
      const tools = buildMockTools();
      const predictions: SelectorPrediction[] = [];

      for (const fixture of selectorFixtures) {
        const selectorModel = createRealSelectorModel(config);
        predictions.push(await runSelectorForFixture(fixture, selectorModel, tools));
      }

      return {
        strategy: "real_model_selector_baseline",
        purpose: "selector_quality_baseline",
        status: "PASS",
        description:
          "Real selector baseline with a configured OpenAI-compatible endpoint. Tools remain mock-only and no tool execution occurs.",
        metrics: computeMetrics(predictions),
        predictions,
      };
    } catch (error) {
      return {
        strategy: "real_model_selector_baseline",
        purpose: "selector_quality_baseline",
        status: "BLOCKED",
        description:
          "Real selector baseline attempted with configured endpoint but failed before a stable dataset-wide baseline could be produced.",
        predictions: [],
        reason: asMessage(error),
      };
    }
  };

const runExperimentDomainGatePlusRealSelector =
  async (): Promise<SelectorRunResult> => {
    const config = getRealSelectorConfig();
    const skipReason = getRealSelectorSkipReason(config);
    if (skipReason) {
      return {
        strategy: "domain_gate_plus_real_model_selector",
        purpose: "combined_baseline",
        status: "SKIPPED",
        description:
          "Domain gate plus real selector baseline. Skipped because the real selector endpoint is not configured.",
        predictions: [],
        reason: skipReason,
      };
    }

    try {
      const predictions: SelectorPrediction[] = [];

      for (const fixture of selectorFixtures) {
        const gate = deterministicDomainGate(fixture);
        if (!gate.shouldUseTool || gate.domain === "none") {
          predictions.push({
            fixtureId: fixture.id,
            fixtureGroup: fixture.group,
            userMessage: fixture.userMessage,
            expected: fixture.expected,
            selectedToolIds: [],
            selectedDomain: "none",
            shouldUseTool: false,
            rawSelectorOutput: { gate },
            notes: gate.reason,
          });
          continue;
        }

        const selectorModel = createRealSelectorModel(config);
        const predicted = await runSelectorForFixture(
          fixture,
          selectorModel,
          filterToolsByDomain(gate.domain),
        );
        predictions.push({
          ...predicted,
          rawSelectorOutput: {
            gate,
            selector: predicted.rawSelectorOutput,
          },
        });
      }

      return {
        strategy: "domain_gate_plus_real_model_selector",
        purpose: "combined_baseline",
        status: "PASS",
        description:
          "Domain gate plus real selector baseline with mock tools only. This measures a controlled adapter-style combination, not mainline integration readiness.",
        metrics: computeMetrics(predictions),
        predictions,
      };
    } catch (error) {
      return {
        strategy: "domain_gate_plus_real_model_selector",
        purpose: "combined_baseline",
        status: "BLOCKED",
        description:
          "Domain gate plus real selector baseline attempted with configured endpoint but did not complete successfully.",
        predictions: [],
        reason: asMessage(error),
      };
    }
  };

const listHighRiskWrongCases = (runs: SelectorRunResult[]): HighRiskCase[] =>
  runs.flatMap((run) =>
    run.predictions
      .filter((item) => item.expected.severityIfWrong === "high")
      .filter((item) => {
        const expectedTop1 = item.expected.expectedToolIds?.[0];
        const top1Correct = expectedTop1
          ? item.selectedToolIds[0] === expectedTop1
          : item.selectedToolIds.length === 0;
        return (
          item.expected.shouldUseTool !== item.shouldUseTool ||
          item.expected.domain !== item.selectedDomain ||
          !top1Correct
        );
      })
      .map((item) => ({
        strategy: run.strategy,
        fixtureId: item.fixtureId,
        fixtureGroup: item.fixtureGroup,
        userMessage: item.userMessage,
        expectedDomain: item.expected.domain,
        selectedDomain: item.selectedDomain,
        expectedToolIds: item.expected.expectedToolIds ?? [],
        selectedToolIds: item.selectedToolIds,
      })),
  );

const renderRunSection = (title: string, run: SelectorRunResult) => {
  if (run.status !== "PASS") {
    return `## ${title}

- status: ${run.status}
- description: ${run.description}
- reason: ${run.reason ?? "n/a"}
`;
  }

  return `## ${title}

- status: ${run.status}
- description: ${run.description}

${formatMetricsTable(run.metrics!)}
`;
};

const renderMapList = (counts: Record<string, number>) =>
  Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");

const renderMiddlewareTable = (rows: MiddlewareInspectionRow[]) =>
  [
    "| Capability | Kind | Exported At Runtime | Can Instantiate Or Smoke Test | Can Use Without createDeepAgent | Safety Risk | Recommendation |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${row.capability} | ${row.kind} | ${row.exportedAtRuntime ? "yes" : "no"} | ${row.canInstantiateOrSmokeTest ? "yes" : "no"} | ${row.canUseWithoutCreateDeepAgent} | ${row.safetyRisk} | ${row.recommendation} |`,
    ),
  ].join("\n");

const renderMiddlewareEvidence = (rows: MiddlewareInspectionRow[]) =>
  rows
    .map(
      (row) =>
        `### ${row.capability}\n\n${row.evidence
          .map((item) => `- ${item}`)
          .join("\n")}`,
    )
    .join("\n\n");

const renderHighRiskCases = (cases: HighRiskCase[]) =>
  cases.length === 0
    ? "- none"
    : cases
        .slice(0, 20)
        .map(
          (item) =>
            `- [${item.strategy}] ${item.fixtureId} (${item.fixtureGroup}): expected domain=${item.expectedDomain}, selected domain=${item.selectedDomain}, expected tools=${item.expectedToolIds.join(", ") || "none"}, selected tools=${item.selectedToolIds.join(", ") || "none"}; message=${item.userMessage}`,
        )
        .join("\n");

const buildReportStatus = (
  fakeWiring: SelectorRunResult,
  realSelector: SelectorRunResult,
  realCombined: SelectorRunResult,
  middlewareRows: MiddlewareInspectionRow[],
): ReportStatus => {
  const middlewareWiring = fakeWiring.status === "PASS" ? "PASS" : "FAIL";
  const realSelectorBaseline = realSelector.status;
  const selectorQuality = realSelector.status === "PASS" ? "PROVEN" : "NOT PROVEN";
  const middlewareExtractability =
    middlewareRows.every(
      (row) => row.exportedAtRuntime && row.canInstantiateOrSmokeTest,
    )
      ? "PASS"
      : middlewareRows.some(
            (row) => row.exportedAtRuntime || row.canInstantiateOrSmokeTest,
          )
        ? "PARTIAL"
        : "FAIL";

  let t03Recommendation: ReportStatus["t03Recommendation"] = "BLOCKED";
  if (realSelector.status === "PASS" && realCombined.status === "PASS") {
    const realCombinedHighRisk = realCombined.metrics?.highRiskWrongToolCount ?? Infinity;
    t03Recommendation =
      realCombinedHighRisk === 0 ? "CONTROLLED_SPIKE_ONLY" : "BLOCKED";
  }

  return {
    middlewareWiring,
    realSelectorBaseline,
    selectorQuality,
    middlewareExtractability,
    t03Recommendation,
  };
};

const renderStatusSummary = (status: ReportStatus) =>
  [
    `- middleware wiring: ${status.middlewareWiring}`,
    `- real selector baseline: ${status.realSelectorBaseline}`,
    `- selector quality: ${status.selectorQuality}`,
    `- middleware extractability: ${status.middlewareExtractability}`,
    `- T-03 recommendation: ${status.t03Recommendation}`,
  ].join("\n");

const renderRealSelectorConfig = (config: RealSelectorConfig) =>
  [
    `- DEEPAGENTS_SELECTOR_BASE_URL configured: ${Boolean(config.baseUrl)}`,
    `- DEEPAGENTS_SELECTOR_MODEL configured: ${Boolean(config.model)}`,
    `- DEEPAGENTS_SELECTOR_API_KEY configured: ${Boolean(process.env.DEEPAGENTS_SELECTOR_API_KEY?.trim())}`,
  ].join("\n");

const buildRecommendationText = (status: ReportStatus) => {
  if (status.realSelectorBaseline !== "PASS") {
    return "Real selector quality is not proven in this environment, so T-DeepAgents-03 should stay blocked until a real selector baseline is available.";
  }

  if (status.t03Recommendation === "CONTROLLED_SPIKE_ONLY") {
    return "A controlled T-DeepAgents-03 adapter spike is allowed, but only with domain gate, trace adapter, and deny-by-default safety adapters. This is still not approval for mainline integration.";
  }

  return "Do not advance to T-DeepAgents-03 yet. Real selector baseline exists, but the current quality and risk profile are not strong enough for the next controlled adapter spike.";
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(packageRoot, "..", "..");
const artifactRoot = path.join(repoRoot, ".test-artifact", "deepagents-spike");
const reportPath = path.join(
  packageRoot,
  "deepagents-selector-baseline-report.md",
);
const jsonPath = path.join(artifactRoot, "selector-baseline.json");

await mkdir(artifactRoot, { recursive: true });

const fakeWiring = await runExperimentFakeWiring();
const domainGateOnly = runExperimentDomainGateOnly();
const domainGatePlusFakeWiring = await runExperimentDomainGatePlusFakeWiring();
const realSelector = await runExperimentRealSelectorOnly();
const domainGatePlusRealSelector = await runExperimentDomainGatePlusRealSelector();
const middlewareRows = await inspectDeepAgentsMiddleware();
const reportStatus = buildReportStatus(
  fakeWiring,
  realSelector,
  domainGatePlusRealSelector,
  middlewareRows,
);
const fakeHighRiskCases = listHighRiskWrongCases([
  fakeWiring,
  domainGatePlusFakeWiring,
]);
const realHighRiskCases = listHighRiskWrongCases([
  realSelector,
  domainGatePlusRealSelector,
]);
const recommendation = buildRecommendationText(reportStatus);
const realSelectorConfig = getRealSelectorConfig();

const report = `# DeepAgents Selector / Middleware Baseline Report

## Final Status

${renderStatusSummary(reportStatus)}

## Summary

- This task remains an isolated spike inside \`packages/deepagents-spike\`.
- It does not connect DeepAgents to the current AgentGraph or Harness mainline.
- FakeSelectorModel is used only as a middleware wiring smoke test.
- FakeSelectorModel results are not a real selector quality baseline.
- Real selector quality is only considered proven when a configured real-model baseline runs successfully.
- It does not allow direct exposure of DeepAgents filesystem, subagent, or MCP surfaces to the main model.
- It does not allow raw LangGraph events to be sent directly into the current trace UI.

## Environment

- OS: Windows
- Node: ${process.version}
- Dataset size: ${selectorFixtures.length}
- Candidate capability count: ${mockCapabilities.length}

## Real Selector Configuration

${renderRealSelectorConfig(realSelectorConfig)}

## What Was Tested

- A. \`middleware_wiring_fake_model\`
- B. \`deterministic_domain_gate\`
- C. \`domain_gate_plus_fake_model_wiring\`
- D. \`real_model_selector_baseline\`
- E. \`domain_gate_plus_real_model_selector\`

## Fixture Dataset By Domain

${renderMapList(countFixturesByDomain(selectorFixtures))}

## Fixture Dataset By Group

${renderMapList(countFixturesByGroup(selectorFixtures))}

${renderRunSection("A. middleware_wiring_fake_model", fakeWiring)}

${renderRunSection("B. deterministic_domain_gate", domainGateOnly)}

${renderRunSection("C. domain_gate_plus_fake_model_wiring", domainGatePlusFakeWiring)}

${renderRunSection("D. real_model_selector_baseline", realSelector)}

${renderRunSection("E. domain_gate_plus_real_model_selector", domainGatePlusRealSelector)}

## Middleware Extractability

${renderStatusSummary({
  ...reportStatus,
  middlewareWiring: "PASS",
  realSelectorBaseline: reportStatus.realSelectorBaseline,
  selectorQuality: reportStatus.selectorQuality,
  middlewareExtractability: reportStatus.middlewareExtractability,
  t03Recommendation: reportStatus.t03Recommendation,
})}

${renderMiddlewareTable(middlewareRows)}

## Middleware Extractability Evidence

${renderMiddlewareEvidence(middlewareRows)}

## Fake Wiring High-Risk Wrong Cases

These cases come from fake-model wiring experiments only. They are useful for showing pipeline behavior, not real selector quality.

${renderHighRiskCases(fakeHighRiskCases)}

## Real Selector High-Risk Wrong Cases

These cases are the only ones that count toward real selector quality, and only when experiment D or E is \`PASS\`.

${renderHighRiskCases(realHighRiskCases)}

## Can Reuse

- LangChain \`llmToolSelectorMiddleware\` is a real exported primitive in the current dependency set, so middleware wiring can be exercised without modifying Harness.
- DeepAgents runtime exports prove that \`createFilesystemMiddleware\`, \`createSubAgentMiddleware\`, \`createSummarizationMiddleware\`, \`createPatchToolCallsMiddleware\`, and \`FilesystemBackend\` are not hypothetical names.
- A deterministic domain gate is easy to isolate and measure against the same fixture set.

## Cannot Reuse

- FakeSelectorModel metrics do not measure real selector quality.
- Todo extractability is not runtime-proven as a standalone middleware. The current evidence is only that \`write_todos\` exists conceptually in DeepAgents docs and types.
- Stream events are available on the created runtime, but still require an adapter layer before any trace integration.

## Harness Integration Risks

- Selector quality alone is not enough. High-risk no-tool mistakes remain unacceptable even when tool ranking looks reasonable elsewhere.
- Filesystem permissions only constrain file access; they do not remove the capability surface.
- Subagent and MCP surfaces widen execution and observability boundaries and cannot be exposed directly to the main model.
- Raw LangGraph event streams still need an adapter layer before any trace UI integration.

## Recommendation

${recommendation}
`;

const artifact = {
  generatedAt: new Date().toISOString(),
  status: reportStatus,
  environment: {
    node: process.version,
    candidateCapabilities: capabilitySummary(mockCapabilities),
    fixtureCount: selectorFixtures.length,
    fixtureCountsByDomain: countFixturesByDomain(selectorFixtures),
    fixtureCountsByGroup: countFixturesByGroup(selectorFixtures),
    realSelectorConfig: {
      baseUrlConfigured: Boolean(realSelectorConfig.baseUrl),
      modelConfigured: Boolean(realSelectorConfig.model),
      apiKeyConfigured: Boolean(process.env.DEEPAGENTS_SELECTOR_API_KEY?.trim()),
    },
  },
  experiments: {
    middleware_wiring_fake_model: fakeWiring,
    deterministic_domain_gate: domainGateOnly,
    domain_gate_plus_fake_model_wiring: domainGatePlusFakeWiring,
    real_model_selector_baseline: realSelector,
    domain_gate_plus_real_model_selector: domainGatePlusRealSelector,
  },
  middlewareInspection: middlewareRows,
  fakeHighRiskWrongCases: fakeHighRiskCases,
  realHighRiskWrongCases: realHighRiskCases,
  recommendation,
};

await writeFile(reportPath, report, "utf8");
await writeFile(jsonPath, JSON.stringify(artifact, null, 2), "utf8");

console.log(
  JSON.stringify(
    {
      reportPath,
      jsonPath,
      status: reportStatus,
      fakeWiringMetrics: fakeWiring.metrics,
      domainGateMetrics: domainGateOnly.metrics,
      domainGatePlusFakeMetrics: domainGatePlusFakeWiring.metrics,
      realSelectorStatus: realSelector.status,
      realSelectorReason: realSelector.reason,
      realCombinedStatus: domainGatePlusRealSelector.status,
      realCombinedReason: domainGatePlusRealSelector.reason,
      middlewareInspectionCount: middlewareRows.length,
      fakeHighRiskWrongCaseCount: fakeHighRiskCases.length,
      realHighRiskWrongCaseCount: realHighRiskCases.length,
    },
    null,
    2,
  ),
);
