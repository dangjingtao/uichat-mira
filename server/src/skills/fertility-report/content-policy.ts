import type {
  FertilityAssessmentState,
  FertilityDimension,
} from "../fertility-assessment/runtime.js";
import type { FertilityReportSummary } from "./dimension-analysis.js";

const CLINICAL_DECISION_TERMS = [
  "PGT",
  "促排",
  "移植",
  "微刺激",
  "自然周期",
  "双刺激",
  "生长激素",
  "DHEA",
  "辅酶Q10",
  "药物",
  "用药",
  "剂量",
  "手术",
  "内膜容受性",
  "芯片",
  "供卵",
  "治疗方案",
  "补充剂",
] as const;

const RECOMMENDATION_PREFIXES = [
  "建议",
  "可考虑",
  "可以考虑",
  "在医生指导下",
  "与医生讨论",
  "与生殖医生讨论",
  "与生殖专科医生讨论",
  "探讨",
  "评估",
  "确认",
] as const;

const CLINICAL_ACTION_VERBS = [
  "建议",
  "考虑",
  "讨论",
  "制定",
  "采用",
  "尝试",
  "补充",
  "调整",
  "实施",
  "进行",
  "选择",
  "需要与医生",
  "应与医生",
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeComparableText = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");

const bigrams = (value: string) => {
  const chars = Array.from(value);
  if (chars.length < 2) return new Set(chars);
  return new Set(chars.slice(0, -1).map((char, index) => `${char}${chars[index + 1]}`));
};

const isSemanticallyDuplicate = (left: string, right: string) => {
  const a = normalizeComparableText(left);
  const b = normalizeComparableText(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  if (shorter.length >= 8 && longer.includes(shorter)) return true;

  const aGrams = bigrams(a);
  const bGrams = bigrams(b);
  if (aGrams.size === 0 || bGrams.size === 0) return false;
  let overlap = 0;
  for (const gram of aGrams) {
    if (bGrams.has(gram)) overlap += 1;
  }
  const union = new Set([...aGrams, ...bGrams]).size;
  const shorterOverlap = overlap / Math.min(aGrams.size, bGrams.size);
  return union > 0 && (overlap / union >= 0.68 || shorterOverlap >= 0.55);
};

const uniqueMeaningful = (
  values: readonly string[],
  options: { blocked?: readonly string[]; limit?: number } = {},
) => {
  const accepted: string[] = [];
  const blocked = [...(options.blocked ?? [])];
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    if ([...blocked, ...accepted].some((item) => isSemanticallyDuplicate(value, item))) {
      continue;
    }
    accepted.push(value);
    if (accepted.length >= (options.limit ?? 6)) break;
  }
  return accepted;
};

const containsClinicalDecision = (value: string) =>
  CLINICAL_DECISION_TERMS.some((term) => value.toLowerCase().includes(term.toLowerCase()));

const containsClinicalAction = (value: string) =>
  CLINICAL_ACTION_VERBS.some((verb) => value.includes(verb));

const firstClause = (value: string) =>
  value
    .split(/[，。；;！!？?]/u)[0]
    ?.trim() ?? value.trim();

const stripRecommendationPrefix = (value: string) => {
  let result = value.trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of RECOMMENDATION_PREFIXES) {
      if (result.startsWith(prefix)) {
        result = result.slice(prefix.length).replace(/^[：:，,、\s]+/u, "").trim();
        changed = true;
        break;
      }
    }
  }
  return result;
};

const asClinicianQuestion = (value: string) => {
  const topic = firstClause(stripRecommendationPrefix(value));
  if (!topic) return "";
  return `就诊时可询问：“${topic}”是否适合当前情况，其依据、潜在获益、风险与局限分别是什么？`;
};

const asTestQuestion = (value: string) => {
  const topic = firstClause(stripRecommendationPrefix(value));
  if (!topic) return "";
  return `可与医生确认：“${topic}”当前是否有必要，以及何时检查更合适？`;
};

const softenOutcomeClaims = (value: string) =>
  value.replace(
    /(提高|改善|增加)[^。；！？]{0,24}(成功率|妊娠率|活产率|着床率|卵子质量|胚胎质量)/gu,
    "相关获益仍需结合个体情况、证据质量与专科医生评估",
  );

const removePrescriptiveSentences = (value: string) => {
  const sentences = value.match(/[^。！？]+[。！？]?/gu) ?? [];
  const retained = sentences.filter((sentence) => {
    const trimmed = sentence.trim();
    const startsAsRecommendation = RECOMMENDATION_PREFIXES.some((prefix) =>
      trimmed.startsWith(prefix),
    );
    const containsTreatmentDirection =
      containsClinicalDecision(trimmed) && containsClinicalAction(trimmed);
    return !startsAsRecommendation && !containsTreatmentDirection;
  });
  return softenOutcomeClaims(retained.join("").trim());
};

const evidenceFact = (value: unknown) =>
  isRecord(value) && typeof value.fact === "string" ? value.fact.trim() : "";

const uniqueEvidenceItems = (dimension: FertilityDimension) => {
  const accepted: unknown[] = [];
  const acceptedFacts: string[] = [];
  for (const item of dimension.evidence) {
    const fact = evidenceFact(item);
    if (!fact) continue;
    if (acceptedFacts.some((current) => isSemanticallyDuplicate(fact, current))) continue;
    accepted.push(item);
    acceptedFacts.push(fact);
    if (accepted.length >= 8) break;
  }
  return accepted;
};

const applyDimensionPolicy = (dimension: FertilityDimension): FertilityDimension => {
  const evidenceItems = uniqueEvidenceItems(dimension);
  const evidence = evidenceItems.map(evidenceFact).filter(Boolean);
  const strengths = uniqueMeaningful(dimension.strengths, {
    blocked: evidence,
    limit: 5,
  });

  if (dimension.dataCompleteness <= 0 || evidence.length === 0) {
    return {
      ...dimension,
      evidence: [],
      strengths: [],
      concerns: [],
      missingEvidence: uniqueMeaningful(dimension.missingEvidence, { limit: 4 }),
      interpretation:
        "当前未获得足够直接资料，本维度的 5.0 分仅为中性参考基准，不代表正常或异常；补充关键资料后再重新评估。",
      actions: {
        selfCare: [],
        discussWithClinician: [],
        testsToConsider: [],
      },
    };
  }

  const concerns = uniqueMeaningful(dimension.concerns, {
    blocked: [...evidence, ...strengths],
    limit: 5,
  });
  const missingEvidence = uniqueMeaningful(dimension.missingEvidence, {
    blocked: [...evidence, ...concerns],
    limit: 4,
  });

  const clinicalSelfCare = dimension.actions.selfCare.filter(containsClinicalDecision);
  const safeSelfCare = uniqueMeaningful(
    dimension.actions.selfCare.filter((item) => !containsClinicalDecision(item)),
    { blocked: [...evidence, ...concerns], limit: 4 },
  );
  const discussWithClinician = uniqueMeaningful(
    [...clinicalSelfCare, ...dimension.actions.discussWithClinician]
      .map(asClinicianQuestion)
      .filter(Boolean),
    { blocked: safeSelfCare, limit: 4 },
  );
  const testsToConsider = uniqueMeaningful(
    dimension.actions.testsToConsider.map(asTestQuestion).filter(Boolean),
    {
      blocked: [...missingEvidence, ...discussWithClinician],
      limit: 4,
    },
  );

  return {
    ...dimension,
    evidence: evidenceItems,
    strengths,
    concerns,
    missingEvidence,
    interpretation:
      removePrescriptiveSentences(dimension.interpretation) ||
      "当前结果用于整理就诊方向，不替代专科医生结合原始资料作出的判断。",
    actions: {
      selfCare: safeSelfCare.map(softenOutcomeClaims),
      discussWithClinician,
      testsToConsider,
    },
  };
};

const applySummaryPolicy = (summary: FertilityReportSummary): FertilityReportSummary => {
  const strengths = uniqueMeaningful(summary.strengths.map(softenOutcomeClaims), {
    limit: 5,
  });
  const priorities = uniqueMeaningful(summary.priorities.map(softenOutcomeClaims), {
    blocked: strengths,
    limit: 5,
  });
  const visitPrep = uniqueMeaningful(summary.visitPrep.map(softenOutcomeClaims), {
    blocked: [...strengths, ...priorities],
    limit: 5,
  });
  const lifestyleFocus = uniqueMeaningful(
    summary.lifestyleFocus
      .filter((item) => !containsClinicalDecision(item))
      .map(softenOutcomeClaims),
    { blocked: [...strengths, ...priorities, ...visitPrep], limit: 5 },
  );
  return { strengths, priorities, visitPrep, lifestyleFocus };
};

export const applyFertilityReportContentPolicy = (input: {
  dimensions: Record<string, FertilityDimension>;
  summary: FertilityReportSummary;
  closingMessage: string;
}): Pick<FertilityAssessmentState, "dimensions" | "summary" | "closingMessage"> => ({
  dimensions: Object.fromEntries(
    Object.entries(input.dimensions).map(([id, dimension]) => [
      id,
      applyDimensionPolicy(dimension),
    ]),
  ),
  summary: applySummaryPolicy(input.summary),
  closingMessage: input.closingMessage.trim(),
});

export const fertilityReportContentPolicyInternals = {
  isSemanticallyDuplicate,
  uniqueMeaningful,
  containsClinicalDecision,
  asClinicianQuestion,
  removePrescriptiveSentences,
};
