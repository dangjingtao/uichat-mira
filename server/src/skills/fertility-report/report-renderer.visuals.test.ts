import { describe, expect, it } from "vitest";
import type { FertilityAssessmentState } from "../fertility-assessment/runtime.js";
import { renderFertilityHtmlReport } from "./report-renderer.js";

const dimension = (id: string, score: number, confidence: "low" | "medium" | "high") => ({
  id,
  score,
  confidence,
  dataCompleteness: confidence === "low" ? 0.2 : confidence === "medium" ? 0.55 : 0.85,
  evidence: [{ fact: `${id} 的样例依据`, source: "user_reported" }],
  strengths: [],
  concerns: [],
  missingEvidence: [],
  interpretation: `${id} 的核心判断`,
  actions: { selfCare: [], discussWithClinician: [], testsToConsider: [] },
});

const state: FertilityAssessmentState = {
  facts: {},
  missingCriticalFields: [],
  uncertainties: [],
  contradictions: [],
  dimensions: {
    female_endometrium: dimension("female_endometrium", 7.2, "medium"),
    female_hormonal_balance: dimension("female_hormonal_balance", 5, "low"),
    male_motility: dimension("male_motility", 4.5, "high"),
    male_concentration: dimension("male_concentration", 6.8, "medium"),
  },
  summary: {
    strengths: [],
    priorities: [],
    visitPrep: [],
    lifestyleFocus: [],
  },
};

const generatedAt = "2026-07-25T12:00:00.000Z";

describe("fertility report quantitative visuals", () => {
  it("renders a static female radar and score bars without print-time scripts", () => {
    const html = renderFertilityHtmlReport({
      state,
      profile: {
        displayName: "林女士",
        assessmentScope: "female",
        subjectGender: "female",
        currentGoal: "natural_conception",
        femaleName: "林女士",
      },
      generatedAt,
    });

    expect(html).toContain("女性十维雷达画像");
    expect(html).toContain("女性十维评分明细");
    expect(html).toContain("class=\"radar-value-area\"");
    expect(html).toContain("class=\"score-row\"");
    expect(html).toContain("fertility-rubric-v2.0.0");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("男性十维雷达画像");
  });

  it("renders separate female and male visual pages for a couple report", () => {
    const html = renderFertilityHtmlReport({
      state,
      profile: {
        displayName: "陈夏夫妻",
        assessmentScope: "couple",
        subjectGender: "couple",
        currentGoal: "assisted_reproduction",
        femaleName: "夏小姐",
        maleName: "陈先生",
      },
      generatedAt,
    });

    expect(html).toContain("女性十维雷达画像");
    expect(html).toContain("男性十维雷达画像");
    expect(html).toContain("低置信度仍给参考结果");
    expect(html).toContain("0–2.9 优先评估");
  });
});
