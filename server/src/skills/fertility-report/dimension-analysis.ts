import { collectTaskModelText } from "@/services/task-model.service.js";
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
  if (!isRecord(parsed)) throw new Error("TaskModel did not return a JSON object");
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
    selfCare: uniqueStrings(actions.selfCare, 8),
    discussWithClinician: uniqueStrings(actions.discussWithClinician, 8),
    testsToConsider: uniqueStrings(actions.testsToConsider, 8),
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
  return signals.slice(0, 12);
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
    strengths: uniqueStrings(value.strengths, 8),
    concerns: uniqueStrings(value.concerns, 8),
    missingEvidence: uniqueStrings(value.missingEvidence, 8),
    interpretation:
      typeof value.interpretation === "string" ? value.interpretation.trim() : "",
    actions: normalizeActions(value.actions),
  };
};

const dimensionPrompt = (dimensionPairs: ReadonlyArray<FertilityDimensionPair>) => {
  const rubrics = dimensionPairs.map(([id]) => getFertilityScoringRule(id));
  return `你是 Mira 生育健康评估中的“证据归类 TaskModel”。你不负责打分；最终分数由确定性评分引擎根据你归类的证据计算。只返回 JSON 对象，不要 Markdown。

评分规则版本：${FERTILITY_SCORING_VERSION}
本批规则：
${JSON.stringify(rubrics, null, 2)}

硬规则：
1. 只分析本批指定维度；每个维度输出一项。
2. 禁止输出 score、confidence 或 dataCompleteness。
3. signals 只能使用规则中已经发布的 criterionId；status 只能是 favorable|neutral|mild_concern|moderate_concern|high_concern|unknown。
4. 只有用户明确叙述、检查值、病史或原始资料支持时才建立 signal。不要为了填满规则编造证据。
5. direct=true 仅用于明确数值、明确诊断/手术史、明确生活方式事实或可核对的治疗结果；推断必须 direct=false。
6. 用户口述检查结果默认 source=user_reported；只有明确来自上传文档或原始记录时才用 document/clinical_record。
7. 不把 AMH/AFC 当作卵子质量或自然受孕概率；不把单一精液参数当作男性不育诊断。
8. 不因未做非普查项目而扣分：无指征时，免疫/凝血、DFI、广泛感染筛查等缺失应保持 unknown，不列为强制建议。
9. TSH 使用实验室参考与临床情境；备孕阶段 2.5–4.0 mIU/L 不得自动归为风险。
10. 不诊断、不处方、不输出个体化药物或补充剂剂量。testsToConsider 必须写成“与医生讨论是否需要”。
11. interpretation 要像专属服务团队写给客户的核心判断，说明结果方向和证据限制，但不得自行给分。
12. 即使资料很少也输出维度项；signals 可为空，由评分引擎产生低置信度中性参考分。

输出结构：
{
  "dimensions": [
    {
      "id": "指定维度 id",
      "signals": [
        {
          "criterionId": "已发布 criterionId",
          "status": "favorable|neutral|mild_concern|moderate_concern|high_concern|unknown",
          "summary": "对应的明确事实及其方向",
          "source": "user_reported|document|clinical_record|inferred",
          "direct": true
        }
      ],
      "strengths": [],
      "concerns": [],
      "missingEvidence": [],
      "interpretation": "",
      "actions": {
        "selfCare": [],
        "discussWithClinician": [],
        "testsToConsider": []
      }
    }
  ]
}`;
};

export const completeFertilityDimensions = async (
  state: FertilityAssessmentState,
  pairs: ReadonlyArray<FertilityDimensionPair>,
) => {
  const dimensions: Record<string, FertilityDimension> = {};

  for (let index = 0; index < pairs.length; index += 2) {
    const batch = pairs.slice(index, index + 2);
    const batchById = new Map(
      batch.map(([id]) => [id, buildEmptyFertilityAssessmentDraft(id)]),
    );
    try {
      const output = await collectTaskModelText(
        [
          { role: "system", content: dimensionPrompt(batch), parts: [] },
          {
            role: "user",
            content: JSON.stringify(
              {
                facts: state.facts,
                interviewDimensionDrafts: Object.fromEntries(
                  batch.map(([id]) => [id, state.dimensions[id] ?? null]),
                ),
              },
              null,
              2,
            ),
            parts: [],
          },
        ],
        {
          maxTokens: 1800,
          temperature: 0,
          purpose: `fertility-report-evidence:${batch.map(([id]) => id).join(",")}`,
        },
      );
      const parsed = parseJsonObject(output);
      const candidates = Array.isArray(parsed.dimensions) ? parsed.dimensions : [];
      for (const [id] of batch) {
        const candidate = candidates.find(
          (item) => isRecord(item) && item.id === id,
        );
        batchById.set(id, normalizeAssessmentDraft(candidate, id));
      }
    } catch {
      // A bounded evidence-extraction call may fail; every dimension still receives
      // a deterministic low-confidence reference score instead of disappearing.
    }

    for (const [id] of batch) {
      dimensions[id] = scoreFertilityDimension(
        batchById.get(id) ?? buildEmptyFertilityAssessmentDraft(id),
      );
    }
  }

  return dimensions;
};

export const buildFertilitySummary = async (state: FertilityAssessmentState) => {
  try {
    const parsed = parseJsonObject(
      await collectTaskModelText(
        [
          {
            role: "system",
            content:
              "你是 Mira 生育健康评估服务团队的报告汇总 TaskModel。只返回 JSON：{strengths:string[],priorities:string[],visitPrep:string[],lifestyleFocus:string[]}。每组最多6条。只根据给定 facts 和已由规则引擎计算的 dimensions；分数越低、置信度越高的维度优先级越高，低置信度低分应优先表达为补充资料而非下结论。不诊断、不处方、不写个体化药物或补充剂剂量。语言清晰、克制、有行动方向。",
            parts: [],
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                facts: state.facts,
                dimensions: Object.fromEntries(
                  Object.entries(state.dimensions).map(([id, dimension]) => [
                    id,
                    {
                      ...dimension,
                      scoreBand:
                        typeof dimension.score === "number"
                          ? getFertilityScoreBand(dimension.score)
                          : null,
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
        { maxTokens: 800, temperature: 0, purpose: "fertility-report-summary" },
      ),
    );
    return {
      strengths: uniqueStrings(parsed.strengths, 6),
      priorities: uniqueStrings(parsed.priorities, 6),
      visitPrep: uniqueStrings(parsed.visitPrep, 6),
      lifestyleFocus: uniqueStrings(parsed.lifestyleFocus, 6),
    };
  } catch {
    return {
      strengths: [],
      priorities: state.missingCriticalFields.slice(0, 6),
      visitPrep: [
        "把关键检查结果、既往治疗时间线和当前用药/补充剂清单带给生殖专科医生核对",
      ],
      lifestyleFocus: [],
    };
  }
};
