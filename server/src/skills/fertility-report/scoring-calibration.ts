import type { FertilityDimension } from "../fertility-assessment/runtime.js";
import type {
  FertilityScoringProfile,
  FertilitySignalEffectMap,
} from "./source-config.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const round1 = (value: number) => Math.round(value * 10) / 10;

const signalEffect = (
  status: unknown,
  effects: FertilitySignalEffectMap,
): number => {
  const key = String(status) as keyof FertilitySignalEffectMap;
  return typeof effects[key] === "number" ? effects[key] : 0;
};

const calibrationReliability = (dimension: FertilityDimension) => {
  const completeness = clamp(dimension.dataCompleteness, 0, 1);
  const confidenceFloor =
    dimension.confidence === "high" ? 0.82 : dimension.confidence === "medium" ? 0.62 : 0.4;
  return Math.max(confidenceFloor, 0.35 + completeness * 0.65);
};

export const applyFertilityScoringProfile = (input: {
  dimensions: Record<string, FertilityDimension>;
  profile: FertilityScoringProfile;
}) => {
  if (input.profile.mode === "preserve_builtin") {
    return input.dimensions;
  }

  const next: Record<string, FertilityDimension> = {};
  for (const [dimensionId, dimension] of Object.entries(input.dimensions)) {
    const calibration = input.profile.dimensions[dimensionId];
    if (!calibration) {
      next[dimensionId] = dimension;
      continue;
    }

    const evidenceSignals = dimension.evidence.filter(isRecord);
    const configuredSignals = evidenceSignals.filter((item) => {
      const criterionId = typeof item.criterionId === "string" ? item.criterionId : "";
      return typeof calibration.criterionWeights[criterionId] === "number";
    });

    const configuredMin = calibration.minScore ?? 0;
    const configuredMax = calibration.maxScore ?? 10;
    const minScore = Math.min(configuredMin, configuredMax);
    const maxScore = Math.max(configuredMin, configuredMax);
    const offset = calibration.scoreOffset ?? 0;
    let score: number;

    if (configuredSignals.length === 0) {
      const current =
        evidenceSignals.length === 0
          ? input.profile.noEvidenceReferenceScore
          : typeof dimension.score === "number"
            ? dimension.score
            : input.profile.noEvidenceReferenceScore;
      score = current + offset;
    } else {
      // A configurable profile recalculates from its own explicit baseline. Using the
      // already-scored built-in dimension as a baseline would count the same evidence twice.
      const baseScore = calibration.baseScore ?? input.profile.noEvidenceReferenceScore;
      const rawEffect = configuredSignals.reduce((sum, item) => {
        const criterionId = String(item.criterionId);
        return (
          sum +
          calibration.criterionWeights[criterionId] *
            signalEffect(item.status, input.profile.statusEffect)
        );
      }, 0);
      const rawScore = clamp(baseScore + rawEffect, 0, 10);
      const reliability = calibrationReliability(dimension);
      score =
        input.profile.noEvidenceReferenceScore +
        (rawScore - input.profile.noEvidenceReferenceScore) * reliability +
        offset;
    }

    next[dimensionId] = {
      ...dimension,
      score: round1(clamp(score, minScore, maxScore)),
      evidence: dimension.evidence.map((item) =>
        isRecord(item)
          ? {
              ...item,
              scoringProfileId: input.profile.id,
              scoringProfileVersion: input.profile.version,
            }
          : item,
      ),
    };
  }

  return next;
};