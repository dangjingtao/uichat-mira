import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { llmToolSelectorMiddleware } from "langchain";
import { buildMockTools, capabilityByToolId, mockCapabilities, selectorFixtures, type MockCapability, type SelectorFixture } from "./selector-fixtures.js";
import {
  capabilitySummary,
  computeMetrics,
  countFixturesByDomain,
  deterministicDomainGate,
  formatMetricsTable,
  type DomainGateResult,
  type SelectorPrediction,
} from "./selector-evaluator.js";
import { inspectDeepAgentsMiddleware } from "./middleware-inspection.js";

type StrategyName =
  | "selector_only"
  | "domain_gate_only"
  | "domain_gate_plus_selector";

type SelectorRunResult = {
  strategy: StrategyName;
  metrics: ReturnType<typeof computeMetrics>;
  predictions: SelectorPrediction[];
};

type HighRiskCase = {
  strategy: StrategyName;
  fixtureId: string;
  userMessage: string;
  expectedDomain: string;
  selectedDomain: string;
  expectedToolIds: string[];
  selectedToolIds: string[];
};

type FakeStructuredSelectorResponse = {
  tools: string[];
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

    if (/企微|企业微信|项目群|研发群|通知/.test(text)) {
      if (/通讯录|部门|联系人|组织架构/.test(text)) {
        pushIfAvailable("wecom.directory_lookup");
      } else {
        pushIfAvailable("wecom.notify");
      }
    }

    if (/飞书|bitable|多维表/.test(text)) {
      if (/bitable|多维表/.test(text)) {
        pushIfAvailable("feishu.bitable_query");
      } else {
        pushIfAvailable("feishu.doc_search");
      }
    }

    if (/上次|之前|回忆|记得/.test(text)) {
      pushIfAvailable("memory.lookup");
    }

    if (/知识库|文档库|索引资料|rag/.test(text)) {
      pushIfAvailable("rag.query");
    }

    if (/最新|今天|最近|联网|官网|npm 版本|issue|搜索/.test(text)) {
      pushIfAvailable("web.search");
    }

    if (/pnpm|git status|powershell|shell|终端|curl |执行 |运行 /.test(text)) {
      pushIfAvailable("terminal.session");
    }

    if (/目录|结构|有哪些文件夹|列出/.test(text)) {
      pushIfAvailable("workspace.read_list");
    } else if (/定位|哪儿|在哪里|搜一下|找一下/.test(text)) {
      pushIfAvailable("workspace.read_locate");
    } else if (/打开|读取|读一下|看一下|readme|package\.json|runtime\.config|agents\.md|文件|仓库|repo|代码/.test(text)) {
      pushIfAvailable("workspace.read_open");
    }

    if (/给客户发消息|删掉|删除|重建/.test(text)) {
      pushIfAvailable("wecom.notify");
      pushIfAvailable("terminal.session");
    }

    return picks.slice(0, 3);
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
  tools = buildMockTools(),
): Promise<SelectorPrediction> => {
  const selectorModel = new FakeSelectorModel();
  const middleware = llmToolSelectorMiddleware({
    model: selectorModel as never,
    maxTools: 3,
  });

  const request = {
    model: { provider: "fake-main-model" },
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
      .filter((item): item is { name: string } => typeof item === "object" && item !== null && "name" in item)
      .map((item) => item.name);
    return new AIMessage("selector baseline ok");
  });

  return {
    fixtureId: fixture.id,
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

const runExperimentSelectorOnly = async (): Promise<SelectorRunResult> => {
  const tools = buildMockTools();
  const predictions: SelectorPrediction[] = [];
  for (const fixture of selectorFixtures) {
    predictions.push(await runSelectorForFixture(fixture, tools));
  }

  return {
    strategy: "selector_only",
    metrics: computeMetrics(predictions),
    predictions,
  };
};

const runExperimentDomainGateOnly = (): SelectorRunResult => {
  const predictions: SelectorPrediction[] = selectorFixtures.map((fixture) => {
    const gate = deterministicDomainGate(fixture);
    return {
      fixtureId: fixture.id,
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
    strategy: "domain_gate_only",
    metrics: computeMetrics(predictions),
    predictions,
  };
};

const runExperimentDomainGatePlusSelector =
  async (): Promise<SelectorRunResult> => {
    const predictions: SelectorPrediction[] = [];

    for (const fixture of selectorFixtures) {
      const gate = deterministicDomainGate(fixture);
      if (!gate.shouldUseTool || gate.domain === "none") {
        predictions.push({
          fixtureId: fixture.id,
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

      const predicted = await runSelectorForFixture(
        fixture,
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
      strategy: "domain_gate_plus_selector",
      metrics: computeMetrics(predictions),
      predictions,
    };
  };

const listHighRiskWrongCases = (
  runs: SelectorRunResult[],
): HighRiskCase[] =>
  runs.flatMap((run) =>
    run.predictions
      .filter((item) => {
        const expectedTop1 = item.expected.expectedToolIds?.[0];
        const top1Correct = expectedTop1
          ? item.selectedToolIds[0] === expectedTop1
          : item.selectedToolIds.length === 0;
        const wrong =
          item.expected.shouldUseTool !== item.shouldUseTool ||
          item.expected.domain !== item.selectedDomain ||
          !top1Correct;
        return item.expected.severityIfWrong === "high" && wrong;
      })
      .map((item) => ({
        strategy: run.strategy,
        fixtureId: item.fixtureId,
        userMessage: item.userMessage,
        expectedDomain: item.expected.domain,
        selectedDomain: item.selectedDomain,
        expectedToolIds: item.expected.expectedToolIds ?? [],
        selectedToolIds: item.selectedToolIds,
      })),
  );

const renderRunSection = (
  title: string,
  run: SelectorRunResult,
) => `## ${title}

${formatMetricsTable(run.metrics)}
`;

const renderFixtureBreakdown = () => {
  const counts = countFixturesByDomain(selectorFixtures);
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([domain, count]) => `- ${domain}: ${count}`)
    .join("\n");
};

const renderMiddlewareTable = async () => {
  const rows = await inspectDeepAgentsMiddleware();
  return [
    "| Capability | Kind | Can Import Directly | Can Use Without createDeepAgent | Needs Safety Adapter Risk | Recommendation |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${row.capability} | ${row.kind} | ${row.canImportDirectly ? "yes" : "no"} | ${row.canUseWithoutCreateDeepAgent ? "yes" : "no"} | ${row.needsSafetyAdapterRisk} | ${row.recommendation} |`,
    ),
  ].join("\n");
};

const buildRecommendation = (
  selectorOnly: SelectorRunResult,
  combined: SelectorRunResult,
) => {
  const gateImprovesNoTool =
    combined.metrics.noToolFalsePositiveRate <
    selectorOnly.metrics.noToolFalsePositiveRate;
  const gateImprovesHighRisk =
    combined.metrics.highRiskWrongToolRate <
    selectorOnly.metrics.highRiskWrongToolRate;

  if (gateImprovesNoTool && gateImprovesHighRisk) {
    return "建议进入 T-DeepAgents-03，但前提是只把 selector 当候选组件，通过 domain gate 先行收窄，再单独接 trace adapter 和 safety adapter。";
  }

  return "不建议直接进入主线接入。若继续 T-DeepAgents-03，也只能做受控适配验证，不能宣称 selector 已解决工具误判。";
};

const buildT03Proposal = (
  selectorOnly: SelectorRunResult,
  combined: SelectorRunResult,
) => [
  "- 只验证 `domain gate + selector + trace adapter` 的受控组合，不改现有 AgentGraph / Harness 主链。",
  "- 默认 deny `filesystem / subagent / MCP`，只允许 mock capability surface。",
  `- selector_only high-risk wrong-tool rate: ${selectorOnly.metrics.highRiskWrongToolRate}`,
  `- domain_gate_plus_selector high-risk wrong-tool rate: ${combined.metrics.highRiskWrongToolRate}`,
  "- 先做事件适配层，不把 LangGraph 原始事件直接塞进现有 trace UI。",
].join("\n");

const renderHighRiskCases = (cases: HighRiskCase[]) =>
  cases.length === 0
    ? "- none"
    : cases
        .slice(0, 20)
        .map(
          (item) =>
            `- [${item.strategy}] ${item.fixtureId}: expected domain=${item.expectedDomain}, selected domain=${item.selectedDomain}, expected tools=${item.expectedToolIds.join(", ") || "none"}, selected tools=${item.selectedToolIds.join(", ") || "none"}; message=${item.userMessage}`,
        )
        .join("\n");

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

const selectorOnly = await runExperimentSelectorOnly();
const gateOnly = runExperimentDomainGateOnly();
const combined = await runExperimentDomainGatePlusSelector();
const middlewareRows = await inspectDeepAgentsMiddleware();
const highRiskCases = listHighRiskWrongCases([selectorOnly, combined]);
const recommendation = buildRecommendation(selectorOnly, combined);
const middlewareTable = await renderMiddlewareTable();

const report = `# DeepAgents Selector / Middleware Baseline Report

## Summary

- This task is an isolated spike inside \`packages/deepagents-spike\`.
- It does not connect DeepAgents to the current AgentGraph or Harness mainline.
- It does not prove DeepAgents has solved tool mis-selection.
- It does not allow direct exposure of DeepAgents filesystem, subagent, or MCP surfaces to the main model.
- It does not allow raw LangGraph events to be sent directly into the current trace UI.

## Environment

- OS: Windows
- Node: ${process.version}
- Dataset size: ${selectorFixtures.length}
- Candidate capability count: ${mockCapabilities.length}

## What Was Tested

- Experiment A: LangChain \`llmToolSelectorMiddleware\` baseline with a stable mock capability set
- Experiment B: deterministic domain gate baseline
- Experiment C: domain gate + selector combined baseline
- Experiment D: DeepAgents middleware extractability inspection

## Fixture Dataset

${renderFixtureBreakdown()}

## Experiment A: LangChain / DeepAgents Selector Baseline

${formatMetricsTable(selectorOnly.metrics)}

## Experiment B: Deterministic Domain Gate Baseline

${formatMetricsTable(gateOnly.metrics)}

## Experiment C: Domain Gate + Selector

${formatMetricsTable(combined.metrics)}

## Experiment D: Middleware Extractability

${middlewareTable}

## Metrics

### selector_only

${formatMetricsTable(selectorOnly.metrics)}

### domain_gate_only

${formatMetricsTable(gateOnly.metrics)}

### domain_gate_plus_selector

${formatMetricsTable(combined.metrics)}

## High-Risk Wrong Tool Cases

${renderHighRiskCases(highRiskCases)}

## Can Reuse

- LangChain \`llmToolSelectorMiddleware\` is a real exported primitive in the current dependency set, so it can be evaluated without modifying Harness.
- DeepAgents exports \`createFilesystemMiddleware\`, \`createSubAgentMiddleware\`, \`createSummarizationMiddleware\`, and \`createPatchToolCallsMiddleware\`, so extractability is not hypothetical.
- A deterministic domain gate in front of selector logic is easy to isolate inside a spike and is measurable against the same fixtures.

## Cannot Reuse

- This baseline is not evidence that DeepAgents has solved tool mis-selection in production.
- The built-in todo behavior is not exposed as a standalone DeepAgents middleware factory, so it is not a clean drop-in reuse point.
- DeepAgents default runtime still bundles filesystem, task/subagent, and summarization behavior that does not match current Harness ownership or approval contracts.

## Harness Integration Risks

- Selector quality alone is not enough. Even a decent selector can still choose high-risk wrong tools without a front gate.
- Filesystem permissions only constrain file access; they do not remove the capability surface. That is not sufficient for current Harness policy.
- Subagent and MCP surfaces widen execution and observability boundaries and cannot be exposed directly to the main model.
- Raw LangGraph event streams still need an adapter layer before any trace UI integration.

## Recommendation

${recommendation}

## T-DeepAgents-03 Proposal

${buildT03Proposal(selectorOnly, combined)}
`;

const artifact = {
  generatedAt: new Date().toISOString(),
  environment: {
    node: process.version,
    candidateCapabilities: capabilitySummary(mockCapabilities),
    fixtureCount: selectorFixtures.length,
  },
  experiments: {
    selector_only: selectorOnly,
    domain_gate_only: gateOnly,
    domain_gate_plus_selector: combined,
  },
  middlewareInspection: middlewareRows,
  highRiskWrongCases: highRiskCases,
  recommendation,
};

await writeFile(reportPath, report, "utf8");
await writeFile(jsonPath, JSON.stringify(artifact, null, 2), "utf8");

console.log(
  JSON.stringify(
    {
      reportPath,
      jsonPath,
      selectorOnly: selectorOnly.metrics,
      gateOnly: gateOnly.metrics,
      combined: combined.metrics,
      middlewareInspectionCount: middlewareRows.length,
      highRiskWrongCaseCount: highRiskCases.length,
    },
    null,
    2,
  ),
);
