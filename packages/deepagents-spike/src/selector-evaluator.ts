import type {
  MockCapability,
  SelectorDomain,
  SelectorFixture,
  SelectorFixtureGroup,
} from "./selector-fixtures.js";

export type DomainGateResult = {
  shouldUseTool: boolean;
  domain: SelectorFixture["expected"]["domain"];
  confidence: number;
  reason: string;
};

export type SelectorPrediction = {
  fixtureId: string;
  fixtureGroup: SelectorFixtureGroup;
  userMessage: string;
  expected: SelectorFixture["expected"];
  selectedToolIds: string[];
  selectedDomain: SelectorDomain;
  shouldUseTool: boolean;
  rawSelectorOutput?: unknown;
  notes?: string;
};

export type EvaluatedPrediction = SelectorPrediction & {
  domainCorrect: boolean;
  top1Correct: boolean;
  top3Correct: boolean;
  shouldUseToolCorrect: boolean;
  anyWrong: boolean;
  highRiskWrong: boolean;
};

export type SelectorMetrics = {
  total: number;
  highRiskFixtureCount: number;
  highRiskWrongToolCount: number;
  highRiskWrongRateOverall: number;
  highRiskWrongRateWithinHighRisk: number;
  noToolFalsePositiveRate: number;
  noToolFalseNegativeRate: number;
  domainAccuracy: number;
  top1ToolAccuracy: number;
  top3ToolRecall: number;
  falsePositiveByDomain: Record<string, number>;
  wrongToolByRiskLevel: Record<"low" | "medium" | "high", number>;
  abstainCount: number;
  abstainAccuracy: number;
};

export const round = (value: number) => Number(value.toFixed(4));

export const evaluatePrediction = (
  prediction: SelectorPrediction,
): EvaluatedPrediction => {
  const expectedTop1 = prediction.expected.expectedToolIds?.[0];
  const top3Expected = prediction.expected.expectedToolIds ?? [];
  const top3Correct =
    top3Expected.length === 0
      ? prediction.selectedToolIds.length === 0
      : prediction.selectedToolIds
          .slice(0, 3)
          .some((toolId) => top3Expected.includes(toolId));
  const shouldUseToolCorrect =
    prediction.expected.shouldUseTool === prediction.shouldUseTool;
  const domainCorrect = prediction.expected.domain === prediction.selectedDomain;
  const top1Correct = expectedTop1
    ? prediction.selectedToolIds[0] === expectedTop1
    : prediction.selectedToolIds.length === 0;
  const anyWrong =
    !shouldUseToolCorrect || !domainCorrect || !top1Correct || !top3Correct;
  const highRiskWrong =
    prediction.expected.severityIfWrong === "high" && anyWrong;

  return {
    ...prediction,
    shouldUseToolCorrect,
    domainCorrect,
    top1Correct,
    top3Correct,
    anyWrong,
    highRiskWrong,
  };
};

export const computeMetrics = (
  predictions: SelectorPrediction[],
): SelectorMetrics => {
  const evaluated = predictions.map(evaluatePrediction);
  const total = evaluated.length;
  const expectedNoTool = evaluated.filter((item) => !item.expected.shouldUseTool);
  const expectedUseTool = evaluated.filter((item) => item.expected.shouldUseTool);
  const falsePositives = expectedNoTool.filter((item) => item.shouldUseTool);
  const falseNegatives = expectedUseTool.filter((item) => !item.shouldUseTool);
  const highRiskFixtures = evaluated.filter(
    (item) => item.expected.severityIfWrong === "high",
  );
  const highRiskWrong = evaluated.filter((item) => item.highRiskWrong);
  const abstain = evaluated.filter((item) => !item.shouldUseTool);
  const abstainCorrect = abstain.filter((item) => !item.expected.shouldUseTool);
  const wrongToolByRiskLevel: Record<"low" | "medium" | "high", number> = {
    low: 0,
    medium: 0,
    high: 0,
  };

  for (const item of evaluated) {
    if (item.anyWrong) {
      wrongToolByRiskLevel[item.expected.severityIfWrong] += 1;
    }
  }

  const falsePositiveByDomain = falsePositives.reduce<Record<string, number>>(
    (acc, item) => {
      acc[item.selectedDomain] = (acc[item.selectedDomain] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const top3HitCount = evaluated.filter((item) => item.top3Correct).length;

  return {
    total,
    highRiskFixtureCount: highRiskFixtures.length,
    highRiskWrongToolCount: highRiskWrong.length,
    highRiskWrongRateOverall: round(
      total === 0 ? 0 : highRiskWrong.length / total,
    ),
    highRiskWrongRateWithinHighRisk: round(
      highRiskFixtures.length === 0
        ? 0
        : highRiskWrong.length / highRiskFixtures.length,
    ),
    noToolFalsePositiveRate: round(
      expectedNoTool.length === 0 ? 0 : falsePositives.length / expectedNoTool.length,
    ),
    noToolFalseNegativeRate: round(
      expectedUseTool.length === 0
        ? 0
        : falseNegatives.length / expectedUseTool.length,
    ),
    domainAccuracy: round(
      total === 0
        ? 0
        : evaluated.filter((item) => item.domainCorrect).length / total,
    ),
    top1ToolAccuracy: round(
      total === 0 ? 0 : evaluated.filter((item) => item.top1Correct).length / total,
    ),
    top3ToolRecall: round(total === 0 ? 0 : top3HitCount / total),
    falsePositiveByDomain,
    wrongToolByRiskLevel,
    abstainCount: abstain.length,
    abstainAccuracy: round(
      abstain.length === 0 ? 0 : abstainCorrect.length / abstain.length,
    ),
  };
};

export const countFixturesByDomain = (fixtures: SelectorFixture[]) =>
  fixtures.reduce<Record<string, number>>((acc, fixture) => {
    const key = fixture.expected.domain;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

export const countFixturesByGroup = (fixtures: SelectorFixture[]) =>
  fixtures.reduce<Record<string, number>>((acc, fixture) => {
    acc[fixture.group] = (acc[fixture.group] ?? 0) + 1;
    return acc;
  }, {});

export const deterministicDomainGate = (
  fixture: SelectorFixture,
): DomainGateResult => {
  const text = fixture.userMessage.toLowerCase();

  const hasAny = (...patterns: RegExp[]) =>
    patterns.some((pattern) => pattern.test(text));

  const explicitAbstain = hasAny(
    /不要跑终端/,
    /不要查网/,
    /不要调用任何能力/,
    /不要直接动工具/,
    /不要真的跑/,
    /不要直接执行/,
    /先别发/,
    /先别动代码/,
    /先判断/,
    /先说要查什么/,
    /不要直接搜/,
    /不要直接动/,
  );
  if (explicitAbstain) {
    return {
      shouldUseTool: false,
      domain: "none",
      confidence: 0.96,
      reason: "The user explicitly asks for judgment, drafting, or planning before any tool use.",
    };
  }

  const riskyBlock = hasAny(
    /直接给.+发消息/,
    /删掉/,
    /删除/,
    /重建/,
    /帮我处理一下这个问题/,
  );
  if (riskyBlock) {
    return {
      shouldUseTool: false,
      domain: "none",
      confidence: 0.94,
      reason: "The request is high-risk or underspecified and should abstain before any execution path.",
    };
  }

  if (hasAny(/上次/, /之前/, /回忆/, /记得/, /你之前说过/)) {
    return {
      shouldUseTool: true,
      domain: "memory",
      confidence: 0.86,
      reason: "Prior-conversation recall terms point to memory lookup.",
    };
  }

  if (
    hasAny(
      /知识库/,
      /文档库/,
      /索引资料/,
      /内部索引/,
      /rag/,
      /先用知识库/,
    )
  ) {
    return {
      shouldUseTool: true,
      domain: "rag",
      confidence: 0.9,
      reason: "Indexed knowledge-base phrasing points to RAG.",
    };
  }

  if (hasAny(/飞书/, /bitable/, /多维表/)) {
    return {
      shouldUseTool: true,
      domain: "feishu",
      confidence: 0.88,
      reason: "Feishu-specific document or bitable request.",
    };
  }

  if (hasAny(/企微/, /企业微信/, /通讯录/, /项目群/, /研发群/, /运维群/)) {
    return {
      shouldUseTool: true,
      domain: "wecom",
      confidence: 0.88,
      reason: "WeCom notification or directory lookup request.",
    };
  }

  if (
    hasAny(
      /pnpm/,
      /git status/,
      /powershell/,
      /shell/,
      /终端/,
      /curl /,
      /执行 /,
      /运行 /,
      /直接执行/,
    )
  ) {
    return {
      shouldUseTool: true,
      domain: "terminal",
      confidence: 0.9,
      reason: "Explicit command execution language points to terminal.",
    };
  }

  if (
    hasAny(
      /最新/,
      /今天/,
      /最近/,
      /联网/,
      /npm 版本/,
      /搜索/,
      /官网文档/,
      /issue/,
      /公开资料/,
      /外部最近资料/,
    )
  ) {
    return {
      shouldUseTool: true,
      domain: "web",
      confidence: 0.84,
      reason: "Time-sensitive or external-information request points to web search.",
    };
  }

  if (
    hasAny(
      /readme/,
      /package\.json/,
      /runtime\.config/,
      /ag?ents\.md/,
      /仓库/,
      /repo/,
      /文件/,
      /代码/,
      /定位/,
      /打开/,
      /读取/,
      /目录/,
      /结构/,
      /本仓库/,
    )
  ) {
    return {
      shouldUseTool: true,
      domain: "workspace",
      confidence: 0.87,
      reason: "Repository, file, or symbol lookup language points to workspace read tools.",
    };
  }

  return {
    shouldUseTool: false,
    domain: "none",
    confidence: 0.74,
    reason: "No stable domain trigger found; abstain.",
  };
};

export const formatMetricsTable = (metrics: SelectorMetrics) =>
  [
    `- total: ${metrics.total}`,
    `- highRiskFixtureCount: ${metrics.highRiskFixtureCount}`,
    `- highRiskWrongToolCount: ${metrics.highRiskWrongToolCount}`,
    `- highRiskWrongRateOverall: ${metrics.highRiskWrongRateOverall}`,
    `- highRiskWrongRateWithinHighRisk: ${metrics.highRiskWrongRateWithinHighRisk}`,
    `- noToolFalsePositiveRate: ${metrics.noToolFalsePositiveRate}`,
    `- noToolFalseNegativeRate: ${metrics.noToolFalseNegativeRate}`,
    `- domainAccuracy: ${metrics.domainAccuracy}`,
    `- top1ToolAccuracy: ${metrics.top1ToolAccuracy}`,
    `- top3ToolRecall: ${metrics.top3ToolRecall}`,
    `- falsePositiveByDomain: ${JSON.stringify(metrics.falsePositiveByDomain)}`,
    `- wrongToolByRiskLevel: ${JSON.stringify(metrics.wrongToolByRiskLevel)}`,
    `- abstainCount: ${metrics.abstainCount}`,
    `- abstainAccuracy: ${metrics.abstainAccuracy}`,
  ].join("\n");

export const capabilitySummary = (capabilities: MockCapability[]) =>
  capabilities.map((item) => ({
    id: item.id,
    domain: item.domain,
    riskLevel: item.riskLevel,
    toolCount: item.tools.length,
  }));
