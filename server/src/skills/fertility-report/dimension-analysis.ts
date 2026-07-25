import {
  providerProxyService,
  type NormalizedChatMessage,
} from "@/services/provider-proxy.service/index.js";
import type {
  FertilityAssessmentState,
  FertilityDimension,
} from "../fertility-assessment/runtime.js";
import type { FertilityAssessmentScope } from "../fertility-assessment/service-profile.js";
import {
  buildEmptyFertilityAssessmentDraft,
  scoreFertilityDimension,
  type FertilityDimensionAssessmentDraft,
  type FertilityEvidenceSignal,
} from "./scoring-engine.js";
import {
  FERTILITY_SCORING_VERSION,
  getFertilityScoreBand,
  getFertilityScoringRule,
  type FertilitySignalStatus,
} from "./scoring-rules.js";

export const FEMALE_DIMENSIONS = [
  ["female_endometrium", "子宫内膜与宫腔环境"],
  ["female_hormonal_balance", "激素平衡与排卵节律"],
  ["female_oocyte_context", "卵子潜力与年龄背景"],
  ["female_ovarian_reserve", "卵巢储备与促排反应"],
  ["female_metabolic_health", "代谢健康与体重管理"],
  ["female_immune_context", "免疫与凝血相关背景"],
  ["female_pelvic_environment", "输卵管与盆腔环境"],
  ["female_nutrition", "营养储备与关键微量营养"],
  ["female_lifestyle", "生活方式与环境暴露"],
  ["female_sleep_stress", "心理情绪、压力与睡眠"],
] as const;

export const MALE_DIMENSIONS = [
  ["male_dna_integrity", "精子 DNA 完整性与氧化应激"],
  ["male_morphology", "精子形态与结构质量"],
  ["male_motility", "精子活力与前向运动"],
  ["male_concentration", "精子浓度与总数"],
  ["male_semen_volume", "精液量与基础参数"],
  ["male_hormonal_balance", "男性激素与生精背景"],
  ["male_inflammation", "泌尿生殖炎症相关背景"],
  ["male_nutrition", "营养储备与抗氧化支持"],
  ["male_lifestyle", "生活方式与生殖环境暴露"],
  ["male_sleep_stress", "心理情绪、压力与睡眠"],
] as const;

export type FertilityDimensionPair = readonly [string, string];

export const getFertilityDimensionPairs = (
  scope: FertilityAssessmentScope,
): ReadonlyArray<FertilityDimensionPair> => {
  if (scope === "female") return FEMALE_DIMENSIONS;
  if (scope === "male") return MALE_DIMENSIONS;
  return [...FEMALE_DIMENSIONS, ...MALE_DIMENSIONS];
};

export type FertilityReportSummary = {
  strengths: string[];
  priorities: string[];
  visitPrep: string[];
  lifestyleFocus: string[];
};

export type FertilityReportContent = {
  dimensions: Record<string, FertilityDimension>;
  summary: FertilityReportSummary;
  closingMessage: string;
};

const SIGNAL_STATUSES = new Set<FertilitySignalStatus>([
  "favorable",
  "neutral",
  "mild_concern",
  "moderate_concern",
  "high_concern",
  "unknown",
]);
const SIGNAL_SOURCES = new Set<FertilityEvidenceSignal["source"]>([
  "user_reported",
  "document",
  "clinical_record",
  "inferred",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const unwrapJsonFence = (value: string) => {
  const match = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/i.exec(value);
  return match?.[1] ?? value;
};

const parseJsonObject = (value: string): Record<string, unknown> => {
  const parsed = JSON.parse(unwrapJsonFence(value).trim()) as unknown;
  if (!isRecord(parsed)) throw new Error("Report model did not return a JSON object");
  return parsed;
};

const uniqueStrings = (values: unknown, limit = 12) =>
  Array.isArray(values)
    ? [
        ...new Set(
          values
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ].slice(0, limit)
    : [];

const normalizeActions = (value: unknown): FertilityDimension["actions"] => {
  const actions = isRecord(value) ? value : {};
  return {
    selfCare: uniqueStrings(actions.selfCare, 6),
    discussWithClinician: uniqueStrings(actions.discussWithClinician, 6),
    testsToConsider: uniqueStrings(actions.testsToConsider, 6),
  };
};

const normalizeSignals = (
  value: unknown,
  allowedCriterionIds: Set<string>,
): FertilityEvidenceSignal[] => {
  if (!Array.isArray(value)) return [];
  const signals: FertilityEvidenceSignal[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate)) continue;
    const criterionId =
      typeof candidate.criterionId === "string" ? candidate.criterionId.trim() : "";
    const status = String(candidate.status) as FertilitySignalStatus;
    const summary =
      typeof candidate.summary === "string" ? candidate.summary.trim() : "";
    const sourceRaw = String(candidate.source);
    if (
      !allowedCriterionIds.has(criterionId) ||
      !SIGNAL_STATUSES.has(status) ||
      !summary
    ) {
      continue;
    }
    const source = SIGNAL_SOURCES.has(sourceRaw as FertilityEvidenceSignal["source"])
      ? (sourceRaw as FertilityEvidenceSignal["source"])
      : "user_reported";
    signals.push({
      criterionId,
      status,
      summary,
      source,
      direct: candidate.direct === true,
    });
  }
  return signals.slice(0, 14);
};

const normalizeAssessmentDraft = (
  value: unknown,
  expectedId: string,
): FertilityDimensionAssessmentDraft => {
  const fallback = buildEmptyFertilityAssessmentDraft(expectedId);
  if (!isRecord(value)) return fallback;
  const rule = getFertilityScoringRule(expectedId);
  if (!rule) return fallback;
  const allowedCriterionIds = new Set(rule.criteria.map((criterion) => criterion.id));
  return {
    id: expectedId,
    signals: normalizeSignals(value.signals, allowedCriterionIds),
    strengths: uniqueStrings(value.strengths, 6),
    concerns: uniqueStrings(value.concerns, 6),
    missingEvidence: uniqueStrings(value.missingEvidence, 6),
    interpretation:
      typeof value.interpretation === "string" ? value.interpretation.trim() : "",
    actions: normalizeActions(value.actions),
  };
};

const normalizeSummary = (value: unknown): FertilityReportSummary => {
  const summary = isRecord(value) ? value : {};
  return {
    strengths: uniqueStrings(summary.strengths, 6),
    priorities: uniqueStrings(summary.priorities, 6),
    visitPrep: uniqueStrings(summary.visitPrep, 6),
    lifestyleFocus: uniqueStrings(summary.lifestyleFocus, 6),
  };
};

const mergeSummary = (items: FertilityReportSummary[]): FertilityReportSummary => ({
  strengths: uniqueStrings(items.flatMap((item) => item.strengths), 6),
  priorities: uniqueStrings(items.flatMap((item) => item.priorities), 6),
  visitPrep: uniqueStrings(items.flatMap((item) => item.visitPrep), 6),
  lifestyleFocus: uniqueStrings(items.flatMap((item) => item.lifestyleFocus), 6),
});

const fallbackSummary = (state: FertilityAssessmentState): FertilityReportSummary => ({
  strengths: [],
  priorities: state.missingCriticalFields.slice(0, 6),
  visitPrep: [
    "把现有检查结果、既往治疗时间线和当前用药或补充剂清单带给生殖专科医生核对",
  ],
  lifestyleFocus: [],
});

const fallbackClosing =
  "谢谢您愿意把这些经历和信息交给我们整理。生育评估不是给人生下结论，而是帮助您更清楚地看见当前的位置和下一步可以怎样走。愿接下来的每一次选择都更有依据，也愿您在这个过程中被认真理解、被温柔支持。";

const collectMainModelText = async (
  messages: NormalizedChatMessage[],
  options: { maxTokens: number; temperature?: number },
) => {
  let output = "";
  for await (const delta of providerProxyService.streamChatText(
    "default",
    messages,
    {
      maxTokens: options.maxTokens,
      temperature: options.temperature ?? 0.15,
    },
  )) {
    output += delta;
  }
  const trimmed = output.trim();
  if (!trimmed) throw new Error("Report model returned empty output");
  return trimmed;
};

const subjectLabel = (pairs: ReadonlyArray<FertilityDimensionPair>) =>
  pairs[0]?.[0].startsWith("male_") ? "男方" : "女方";

const reportPrompt = (pairs: ReadonlyArray<FertilityDimensionPair>) => {
  const rubrics = pairs.map(([id]) => getFertilityScoringRule(id));
  return `你是 Mira 生育健康评估服务团队的完整报告撰写模型。本次需要一次性完成${subjectLabel(pairs)}全部十个维度的证据归类和报告内容。最终分数由程序根据你归类的 signals 确定，你不能自行打分。

评分规则版本：${FERTILITY_SCORING_VERSION}
本次十维规则：
${JSON.stringify(rubrics, null, 2)}

硬规则：
1. 只返回 JSON，不要 Markdown、HTML 或解释。
2. 必须输出本次指定的全部十个维度，每个维度恰好一项；禁止输出 score、confidence、dataCompleteness。
3. caseRecord.evidenceLedger 是可追溯证据账本，answerLog 是原始访谈答复。两者和 facts 共同构成事实来源。任何一处已经出现的信息，都不得在其他维度写成“未提供”。
4. 同一事实可以支持多个相关维度，但用户可见文字不得机械重复。已有依据、当前关注、建议补充三栏之间要去重，各自承担不同作用。
5. signals 只能使用规则中已发布的 criterionId；status 只能是 favorable|neutral|mild_concern|moderate_concern|high_concern|unknown。
6. 只有明确叙述、检查值、病史或治疗结果才建立 signal。用户口述检查默认 source=user_reported；推断 direct=false。
7. 不把 AMH/AFC 当作卵子质量或自然受孕概率；不把单一精液参数当作男性不育诊断；无指征时未做免疫、凝血、DFI 等检查不扣分。
8. interpretation 写成专属服务团队的核心判断：说明方向、证据和限制。不得出现内部维度 id、TaskModel、JSON、Runtime 等内部术语。
9. 不诊断、不处方，不替用户选择具体促排、移植或供卵路径。可提示与医生讨论适用性、局限性和需要核对的资料，但不得像医嘱一样替代临床决策。
10. actions 必须与当前证据相关。用户未提供吸烟、运动、体重等资料时，不得假设问题存在，也不要批量塞入通用生活方式清单。
11. 没有证据的维度仍输出，但 interpretation 简短说明当前资料有限；missingEvidence 最多4项，actions 可以为空，不要为了凑页数重复“暂无足够信息”。
12. summary 每组最多6条，优先写真正影响当前决策的方向；低置信度维度优先表达为资料缺口，不下强结论。
13. closingMessage 是报告最后的祝福性总结，温和、克制、不许诺结果，承认过程的不易，并让用户感到被认真理解。长度80-180字。

输出结构：
{
  "dimensions": [
    {
      "id": "指定维度id",
      "signals": [{"criterionId":"...","status":"...","summary":"...","source":"user_reported|document|clinical_record|inferred","direct":true}],
      "strengths": [],
      "concerns": [],
      "missingEvidence": [],
      "interpretation": "",
      "actions": {"selfCare":[],"discussWithClinician":[],"testsToConsider":[]}
    }
  ],
  "summary": {"strengths":[],"priorities":[],"visitPrep":[],"lifestyleFocus":[]},
  "closingMessage": ""
}`;
};

const generateSubjectContent = async (
  state: FertilityAssessmentState,
  pairs: ReadonlyArray<FertilityDimensionPair>,
) => {
  const drafts = new Map(
    pairs.map(([id]) => [id, buildEmptyFertilityAssessmentDraft(id)]),
  );
  let summary = fallbackSummary(state);
  let closingMessage = fallbackClosing;

  try {
    const output = await collectMainModelText(
      [
        { role: "system", content: reportPrompt(pairs), parts: [] },
        {
          role: "user",
          content: JSON.stringify(
            {
              facts: state.facts,
              caseRecord: state.caseRecord,
              interviewDimensionDrafts: Object.fromEntries(
                pairs.map(([id]) => [id, state.dimensions[id] ?? null]),
              ),
            },
            null,
            2,
          ),
          parts: [],
        },
      ],
      { maxTokens: 12000, temperature: 0.15 },
    );
    const parsed = parseJsonObject(output);
    const candidates = Array.isArray(parsed.dimensions) ? parsed.dimensions : [];
    for (const [id] of pairs) {
      const candidate = candidates.find(
        (item) => isRecord(item) && item.id === id,
      );
      drafts.set(id, normalizeAssessmentDraft(candidate, id));
    }
    summary = normalizeSummary(parsed.summary);
    if (typeof parsed.closingMessage === "string" && parsed.closingMessage.trim()) {
      closingMessage = parsed.closingMessage.trim().slice(0, 500);
    }
  } catch {
    // A complete subject-level generation may fail. Deterministic scoring still
    // emits every requested dimension from empty drafts instead of losing the report.
  }

  const dimensions: Record<string, FertilityDimension> = {};
  for (const [id] of pairs) {
    dimensions[id] = scoreFertilityDimension(
      drafts.get(id) ?? buildEmptyFertilityAssessmentDraft(id),
    );
  }
  return { dimensions, summary, closingMessage };
};

const buildJointSummary = async (
  state: FertilityAssessmentState,
  dimensions: Record<string, FertilityDimension>,
  fallbacks: FertilityReportSummary[],
) => {
  try {
    const parsed = parseJsonObject(
      await collectMainModelText(
        [
          {
            role: "system",
            content:
              "你是 Mira 生育健康评估服务团队的夫妻联合摘要模型。只返回 JSON：{summary:{strengths:string[],priorities:string[],visitPrep:string[],lifestyleFocus:string[]},closingMessage:string}。每组最多6条。根据同一份夫妻病例和已由规则引擎计算的男女维度，写共同决策最重要的方向；不要重复男女详情，不诊断、不处方、不替代医生。closingMessage 要温和、克制、承认双方共同经历，不许诺结果。",
            parts: [],
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                facts: state.facts,
                caseRecord: state.caseRecord,
                dimensions: Object.fromEntries(
                  Object.entries(dimensions).map(([id, dimension]) => [
                    id,
                    {
                      ...dimension,
                      scoreBand: getFertilityScoreBand(dimension.score ?? 5),
                    },
                  ]),
                ),
              },
              null,
              2,
            ),
            parts: [],
          },
        ],
        { maxTokens: 2800, temperature: 0.15 },
      ),
    );
    return {
      summary: normalizeSummary(parsed.summary),
      closingMessage:
        typeof parsed.closingMessage === "string" && parsed.closingMessage.trim()
          ? parsed.closingMessage.trim().slice(0, 500)
          : fallbackClosing,
    };
  } catch {
    return {
      summary: mergeSummary(fallbacks),
      closingMessage: fallbackClosing,
    };
  }
};

export const buildFertilityReportContent = async (
  state: FertilityAssessmentState,
  pairs: ReadonlyArray<FertilityDimensionPair>,
): Promise<FertilityReportContent> => {
  const femalePairs = pairs.filter(([id]) => id.startsWith("female_"));
  const malePairs = pairs.filter(([id]) => id.startsWith("male_"));
  const groups = [femalePairs, malePairs].filter((group) => group.length > 0);
  const generated = [];
  for (const group of groups) {
    generated.push(await generateSubjectContent(state, group));
  }

  const dimensions = Object.assign({}, ...generated.map((item) => item.dimensions));
  if (generated.length === 1) {
    return {
      dimensions,
      summary: generated[0]?.summary ?? fallbackSummary(state),
      closingMessage: generated[0]?.closingMessage ?? fallbackClosing,
    };
  }

  const joint = await buildJointSummary(
    state,
    dimensions,
    generated.map((item) => item.summary),
  );
  return {
    dimensions,
    summary: joint.summary,
    closingMessage: joint.closingMessage,
  };
};

export const completeFertilityDimensions = async (
  state: FertilityAssessmentState,
  pairs: ReadonlyArray<FertilityDimensionPair>,
) => (await buildFertilityReportContent(state, pairs)).dimensions;

export const buildFertilitySummary = async (state: FertilityAssessmentState) =>
  state.summary ?? fallbackSummary(state);
