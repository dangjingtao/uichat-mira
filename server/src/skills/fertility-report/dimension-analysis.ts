import { collectTaskModelText } from "@/services/task-model.service.js";
import {
  normalizeFertilityDimension,
  type FertilityAssessmentState,
  type FertilityDimension,
} from "../fertility-assessment/runtime.js";
import type { FertilityAssessmentScope } from "../fertility-assessment/service-profile.js";

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

const dimensionPrompt = (dimensionPairs: ReadonlyArray<FertilityDimensionPair>) =>
  `你是 Mira 备孕全景报告的维度分析 TaskModel。只分析指定的 1~2 个维度，只返回 JSON 数组。

指定维度：${dimensionPairs.map(([id, label]) => `${id}=${label}`).join("；")}

规则：
- 仅根据提供的 facts，不补造检查结果。
- score 是 0~10 的启发式状态分，不是怀孕概率；本轮仍沿用现有评分策略，证据不足时 score 可以为 null。
- 必须给 confidence 和 dataCompleteness。
- 区分 evidence / concerns / missingEvidence。
- 不诊断、不处方、不输出个体化药物或补充剂剂量。
- testsToConsider 必须写成“与生殖科/男科医生讨论是否需要”，不能写成人人必查。
- AMH/AFC 主要反映卵巢储备背景，不能单独等同自然受孕概率。
- 卵子质量不能被 AMH 直接测量；年龄、胚胎学和既往 ART 结果只能作为背景证据。

每项结构：{id,score,confidence,dataCompleteness,evidence,strengths,concerns,missingEvidence,interpretation,actions:{selfCare,discussWithClinician,testsToConsider}}`;

export const completeFertilityDimensions = async (
  state: FertilityAssessmentState,
  pairs: ReadonlyArray<FertilityDimensionPair>,
) => {
  const dimensions: Record<string, FertilityDimension> = {};

  for (const [id] of pairs) {
    if (state.dimensions[id]) dimensions[id] = state.dimensions[id];
  }

  for (let index = 0; index < pairs.length; index += 2) {
    const batch = pairs.slice(index, index + 2);
    try {
      const output = await collectTaskModelText(
        [
          { role: "system", content: dimensionPrompt(batch), parts: [] },
          {
            role: "user",
            content: JSON.stringify({ facts: state.facts }, null, 2),
            parts: [],
          },
        ],
        {
          maxTokens: 1200,
          temperature: 0,
          purpose: `fertility-report-dimensions:${batch.map(([id]) => id).join(",")}`,
        },
      );
      const parsed = JSON.parse(unwrapJsonFence(output).trim()) as unknown;
      if (!Array.isArray(parsed)) continue;
      for (const candidate of parsed) {
        const normalized = normalizeFertilityDimension(candidate);
        if (
          normalized &&
          batch.some(([dimensionId]) => dimensionId === normalized.id)
        ) {
          dimensions[normalized.id] = normalized;
        }
      }
    } catch {
      // One bounded subcall must not lose the whole report.
    }
  }

  for (const [id] of pairs) {
    if (dimensions[id]) continue;
    dimensions[id] = {
      id,
      score: null,
      confidence: "low",
      dataCompleteness: 0,
      evidence: [],
      strengths: [],
      concerns: [],
      missingEvidence: ["当前对话信息不足，无法形成可靠维度判断"],
      interpretation: "信息有限，当前仅保留低置信度方向性判断，建议后续补充资料后更新。",
      actions: {
        selfCare: [],
        discussWithClinician: [],
        testsToConsider: [],
      },
    };
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
              "你是 Mira 生育健康评估服务团队的报告汇总 TaskModel。只返回 JSON：{strengths:string[],priorities:string[],visitPrep:string[],lifestyleFocus:string[]}。每组最多6条。只根据给定 facts 和 dimensions；不诊断、不处方、不写个体化药物或补充剂剂量。语言应像专属服务团队交付，清晰、克制、有行动方向。把需要医疗决策的内容写成与生殖科/男科医生讨论的问题。",
            parts: [],
          },
          {
            role: "user",
            content: JSON.stringify(
              { facts: state.facts, dimensions: state.dimensions },
              null,
              2,
            ),
            parts: [],
          },
        ],
        { maxTokens: 700, temperature: 0, purpose: "fertility-report-summary" },
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
