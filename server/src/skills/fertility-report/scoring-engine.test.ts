import { describe, expect, it } from "vitest";
import {
  buildEmptyFertilityAssessmentDraft,
  scoreFertilityDimension,
  type FertilityDimensionAssessmentDraft,
} from "./scoring-engine.js";

const actions = {
  selfCare: [],
  discussWithClinician: [],
  testsToConsider: [],
};

describe("fertility deterministic scoring engine", () => {
  it("always returns a numeric low-confidence reference score when evidence is absent", () => {
    const result = scoreFertilityDimension(
      buildEmptyFertilityAssessmentDraft("female_ovarian_reserve"),
    );

    expect(result.score).toBe(5);
    expect(result.confidence).toBe("low");
    expect(result.dataCompleteness).toBe(0);
    expect(result.missingEvidence).toContain("AMH");
    expect(result.interpretation).toContain("低置信度参考值");
  });

  it("keeps a direct high-concern signal influential even with incomplete evidence", () => {
    const draft: FertilityDimensionAssessmentDraft = {
      id: "female_oocyte_context",
      signals: [
        {
          criterionId: "age_context",
          status: "high_concern",
          summary: "女方年龄 42 岁，时间窗口需要优先讨论",
          source: "user_reported",
          direct: true,
        },
      ],
      strengths: [],
      concerns: [],
      missingEvidence: [],
      interpretation: "",
      actions,
    };

    const result = scoreFertilityDimension(draft);

    expect(result.score).toBeTypeOf("number");
    expect(result.score).toBeLessThan(5);
    expect(result.confidence).toBe("low");
    expect(result.concerns).toContain("女方年龄 42 岁，时间窗口需要优先讨论");
  });

  it("raises confidence only when key and direct evidence coverage is sufficient", () => {
    const draft: FertilityDimensionAssessmentDraft = {
      id: "female_ovarian_reserve",
      signals: [
        {
          criterionId: "amh",
          status: "favorable",
          summary: "AMH 按检测平台与年龄背景处于预期范围",
          source: "clinical_record",
          direct: true,
        },
        {
          criterionId: "afc",
          status: "favorable",
          summary: "AFC 由生殖中心记录为该中心预期范围",
          source: "clinical_record",
          direct: true,
        },
        {
          criterionId: "basal_fsh_e2",
          status: "favorable",
          summary: "基础期 FSH 与 E2 在实验室参考范围",
          source: "clinical_record",
          direct: true,
        },
        {
          criterionId: "stimulation_response",
          status: "favorable",
          summary: "既往促排实际反应与方案预期相符",
          source: "clinical_record",
          direct: true,
        },
      ],
      strengths: [],
      concerns: [],
      missingEvidence: [],
      interpretation: "",
      actions,
    };

    const result = scoreFertilityDimension(draft);

    expect(result.score).toBeGreaterThanOrEqual(8);
    expect(result.confidence).toBe("high");
    expect(result.dataCompleteness).toBe(1);
    expect(result.evidence).toHaveLength(4);
  });
});
