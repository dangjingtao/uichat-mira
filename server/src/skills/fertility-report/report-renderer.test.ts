import { describe, expect, it } from "vitest";
import type { FertilityAssessmentState } from "../fertility-assessment/runtime.js";
import {
  renderFertilityHtmlReport,
  renderFertilityMarkdownReport,
} from "./report-renderer.js";

const state: FertilityAssessmentState = {
  facts: {},
  missingCriticalFields: ["AMH"],
  uncertainties: [],
  contradictions: [],
  dimensions: {
    female_ovarian_reserve: {
      id: "female_ovarian_reserve",
      score: 6,
      confidence: "low",
      dataCompleteness: 0.3,
      evidence: [{ fact: "月经周期基本规律", source: "user_reported" }],
      strengths: [],
      concerns: ["缺少关键储备指标"],
      missingEvidence: ["AMH", "AFC"],
      interpretation: "当前仅能形成低置信度方向性判断。",
      actions: {
        selfCare: ["整理既往检查资料"],
        discussWithClinician: ["与生殖科医生讨论基础评估"],
        testsToConsider: [],
      },
    },
    male_motility: {
      id: "male_motility",
      score: 7,
      confidence: "medium",
      dataCompleteness: 0.5,
      evidence: [],
      strengths: [],
      concerns: [],
      missingEvidence: [],
      interpretation: "男性维度样例。",
      actions: { selfCare: [], discussWithClinician: [], testsToConsider: [] },
    },
  },
  summary: {
    strengths: ["已明确当前评估目标"],
    priorities: ["补充关键检查资料"],
    visitPrep: ["携带既往检查单"],
    lifestyleFocus: ["保持规律作息"],
  },
};

const generatedAt = "2026-07-25T10:00:00.000Z";

describe("fertility service report renderer", () => {
  it("renders a female-only dedicated service report without male sections", () => {
    const profile = {
      displayName: "林女士",
      assessmentScope: "female" as const,
      subjectGender: "female" as const,
      currentGoal: "natural_conception" as const,
      femaleName: "林女士",
    };
    const html = renderFertilityHtmlReport({ state, profile, generatedAt });
    const markdown = renderFertilityMarkdownReport({ state, profile, generatedAt });

    expect(html).toContain("林女士 · 生育力综合评估报告");
    expect(html).toContain("女性个人十维评估");
    expect(html).toContain("女性生育力综合画像");
    expect(html).not.toContain("男性生育力综合画像");
    expect(html).toContain("Mira 生育健康评估服务团队");
    expect(html).toContain("print-header");
    expect(html).toContain("print-footer");
    expect(markdown).toContain("服务对象：林女士");
    expect(markdown).not.toContain("## 男性生育力综合画像");
  });

  it("renders both dimensions only for a couple service profile", () => {
    const profile = {
      displayName: "陈夏夫妻",
      assessmentScope: "couple" as const,
      subjectGender: "couple" as const,
      currentGoal: "assisted_reproduction" as const,
      femaleName: "夏小姐",
      maleName: "陈先生",
    };
    const html = renderFertilityHtmlReport({ state, profile, generatedAt });

    expect(html).toContain("女性生育力综合画像");
    expect(html).toContain("男性生育力综合画像");
    expect(html).toContain("辅助生殖专项评估");
    expect(html).toContain("夫妻双方十维联合评估");
  });
});
