import type { FertilityDimension } from "../fertility-assessment/runtime.js";
import {
  FERTILITY_SCORING_VERSION,
  getFertilityScoreBand,
  getFertilityScoringRule,
  type FertilityScoringRule,
  type FertilitySignalStatus,
} from "./scoring-rules.js";

export type FertilityEvidenceSignal = {
  criterionId: string;
  status: FertilitySignalStatus;
  summary: string;
  source: "user_reported" | "document" | "clinical_record" | "inferred";
  direct: boolean;
};

export type FertilityDimensionAssessmentDraft = {
  id: string;
  signals: FertilityEvidenceSignal[];
  strengths: string[];
  concerns: string[];
  missingEvidence: string[];
  interpretation: string;
  actions: FertilityDimension["actions"];
};

const STATUS_EFFECT: Record<FertilitySignalStatus, number> = {
  favorable: 0.8,
  neutral: 0,
  mild_concern: -0.75,
  moderate_concern: -1.45,
  high_concern: -2.35,
  unknown: 0,
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const round1 = (value: number) => Math.round(value * 10) / 10;

const uniqueStrings = (values: string[], limit = 12) =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, limit);

const evidenceCompleteness = (
  rule: FertilityScoringRule,
  signals: FertilityEvidenceSignal[],
) => {
  const byCriterion = new Map(
    signals
      .filter((signal) => signal.status !== "unknown" && signal.summary.trim())
      .map((signal) => [signal.criterionId, signal]),
  );
  const totalWeight = rule.criteria.reduce((sum, item) => sum + item.weight, 0);
  const coveredWeight = rule.criteria.reduce(
    (sum, item) => sum + (byCriterion.has(item.id) ? item.weight : 0),
    0,
  );
  const keyCriteria = rule.criteria.filter((item) => item.role === "key");
  const coveredKey = keyCriteria.filter((item) => byCriterion.has(item.id)).length;
  return {
    completeness: totalWeight > 0 ? coveredWeight / totalWeight : 0,
    keyCoverage: keyCriteria.length > 0 ? coveredKey / keyCriteria.length : 0,
    directCount: [...byCriterion.values()].filter((item) => item.direct).length,
    byCriterion,
  };
};

const resolveConfidence = (input: {
  completeness: number;
  keyCoverage: number;
  directCount: number;
}): FertilityDimension["confidence"] => {
  if (
    input.completeness >= 0.72 &&
    input.keyCoverage >= 0.6 &&
    input.directCount >= 2
  ) {
    return "high";
  }
  if (
    input.completeness >= 0.38 &&
    input.keyCoverage > 0 &&
    input.directCount >= 1
  ) {
    return "medium";
  }
  return "low";
};

const defaultInterpretation = (
  score: number,
  confidence: FertilityDimension["confidence"],
  evidenceCount: number,
) => {
  const band = getFertilityScoreBand(score);
  if (evidenceCount === 0) {
    return `当前未获得足够直接资料，${score.toFixed(1)} 分为中性基准附近的低置信度参考值；后续补充关键资料后应重新计算。`;
  }
  if (confidence === "low") {
    return `当前落在“${band.label}”区间，但直接证据仍有限；该结果用于确定下一步关注顺序，不代表生育概率。`;
  }
  return `当前落在“${band.label}”区间，结果基于已提供资料形成；仍需结合原始检查单和专科医生判断。`;
};

export const scoreFertilityDimension = (
  draft: FertilityDimensionAssessmentDraft,
): FertilityDimension => {
  const rule = getFertilityScoringRule(draft.id);
  if (!rule) {
    return {
      id: draft.id,
      score: 5,
      confidence: "low",
      dataCompleteness: 0,
      evidence: [],
      strengths: uniqueStrings(draft.strengths),
      concerns: uniqueStrings(draft.concerns),
      missingEvidence: uniqueStrings(draft.missingEvidence),
      interpretation:
        draft.interpretation ||
        "当前维度缺少已发布量化规则，暂以中性基准形成低置信度参考结果。",
      actions: draft.actions,
    };
  }

  const validSignals = draft.signals.filter((signal) =>
    rule.criteria.some((criterion) => criterion.id === signal.criterionId),
  );
  const coverage = evidenceCompleteness(rule, validSignals);
  const rawEffect = rule.criteria.reduce((sum, criterion) => {
    const signal = coverage.byCriterion.get(criterion.id);
    if (!signal) return sum;
    return sum + criterion.weight * STATUS_EFFECT[signal.status];
  }, 0);
  const hasDirectHighConcern = validSignals.some(
    (signal) => signal.direct && signal.status === "high_concern",
  );
  const reliability = Math.max(
    hasDirectHighConcern ? 0.72 : 0,
    0.35 + coverage.completeness * 0.65,
  );
  const rawScore = clamp(rule.baseScore + rawEffect, 0, 10);
  const score = round1(clamp(5 + (rawScore - 5) * reliability, 0, 10));
  const confidence = resolveConfidence(coverage);
  const observedSignals = validSignals.filter(
    (signal) => signal.status !== "unknown" && signal.summary.trim(),
  );

  const derivedStrengths = observedSignals
    .filter((signal) => signal.status === "favorable")
    .map((signal) => signal.summary);
  const derivedConcerns = observedSignals
    .filter((signal) =>
      ["mild_concern", "moderate_concern", "high_concern"].includes(signal.status),
    )
    .map((signal) => signal.summary);
  const missingFromRules = rule.criteria
    .filter((criterion) => !coverage.byCriterion.has(criterion.id))
    .map((criterion) => criterion.label);

  return {
    id: draft.id,
    score,
    confidence,
    dataCompleteness: round1(coverage.completeness * 10) / 10,
    evidence: observedSignals.slice(0, 10).map((signal) => ({
      fact: signal.summary,
      source: signal.source,
      criterionId: signal.criterionId,
      status: signal.status,
      direct: signal.direct,
      scoringVersion: FERTILITY_SCORING_VERSION,
    })),
    strengths: uniqueStrings([...draft.strengths, ...derivedStrengths], 8),
    concerns: uniqueStrings([...draft.concerns, ...derivedConcerns], 8),
    missingEvidence: uniqueStrings(
      [...draft.missingEvidence, ...missingFromRules],
      8,
    ),
    interpretation:
      draft.interpretation ||
      defaultInterpretation(score, confidence, observedSignals.length),
    actions: draft.actions,
  };
};

export const buildEmptyFertilityAssessmentDraft = (
  id: string,
): FertilityDimensionAssessmentDraft => {
  const rule = getFertilityScoringRule(id);
  return {
    id,
    signals: [],
    strengths: [],
    concerns: [],
    missingEvidence: rule?.criteria.map((criterion) => criterion.label) ?? [],
    interpretation: "",
    actions: {
      selfCare: [],
      discussWithClinician: [],
      testsToConsider: [],
    },
  };
};
