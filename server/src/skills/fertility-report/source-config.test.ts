import { describe, expect, it } from "vitest";
import type { FertilityDimension } from "../fertility-assessment/runtime.js";
import { applyFertilityReportProfile } from "./report-profile.js";
import { applyFertilityScoringProfile } from "./scoring-calibration.js";
import {
  parseFertilityReportProfileSource,
  parseFertilityScoringProfileSource,
} from "./source-config.js";

const sampleDimension: FertilityDimension = {
  id: "female_oocyte_context",
  score: 4.8,
  confidence: "low",
  dataCompleteness: 0.25,
  evidence: [
    {
      fact: "女方年龄 42 岁",
      criterionId: "age_context",
      status: "high_concern",
      source: "user_reported",
      direct: true,
    },
  ],
  strengths: [],
  concerns: ["时间窗口需要优先讨论"],
  missingEvidence: [],
  interpretation: "年龄是当前最明确的背景。",
  actions: { selfCare: [], discussWithClinician: [], testsToConsider: [] },
};

const reportSource = {
  activeProfileId: "yuanjie",
  profiles: {
    yuanjie: {
      service: {
        brandName: "圆姐品牌",
        teamName: "圆姐团队",
        serviceLine: "圆姐服务线",
        footerText: "圆姐页脚",
        deliveryLabel: "圆姐交付",
      },
      theme: {
        primaryColor: "#5B2A86",
        secondaryColor: "#D79ACB",
        accentColor: "#8FB5E8",
        softBackground: "#F7F2FA",
        textColor: "#2C2530",
        mutedTextColor: "#766B79",
      },
    },
    "clinic-a": {
      service: {
        brandName: "甲诊所",
        teamName: "甲诊所专属团队",
        serviceLine: "陪伴式生育健康服务",
        footerText: "仅供健康教育参考。",
        deliveryLabel: "专属团队交付",
      },
      theme: {
        primaryColor: "#123456",
        secondaryColor: "#654321",
        accentColor: "#336699",
        softBackground: "#F0F0F0",
        textColor: "#222222",
        mutedTextColor: "#777777",
      },
    },
  },
};

describe("fertility runtime source profiles", () => {
  it("parses a named report profile and applies branding without regenerating content", () => {
    const profile = parseFertilityReportProfileSource(reportSource, "clinic-a");

    const result = applyFertilityReportProfile({
      profile,
      html: '<main class="report"><div>圆姐聊女性全周期服务</div><style>:root{--primary:#5B2A86}</style></main>',
      markdown: "服务团队：Mira 生育健康评估服务团队",
    });

    expect(result.html).toContain('data-report-profile-id="clinic-a"');
    expect(result.html).toContain("甲诊所");
    expect(result.html).toContain("#123456");
    expect(result.markdown).toContain("甲诊所专属团队");
  });

  it("lets a service profile select a customer template without changing the global active profile", () => {
    const selected = parseFertilityReportProfileSource(reportSource, "clinic-a");
    const globalDefault = parseFertilityReportProfileSource(reportSource);

    expect(selected.id).toBe("clinic-a");
    expect(selected.brandName).toBe("甲诊所");
    expect(globalDefault.id).toBe("yuanjie");
    expect(globalDefault.brandName).toBe("圆姐品牌");
  });

  it("falls back safely when a requested customer template does not exist", () => {
    const diagnostics: string[] = [];
    const profile = parseFertilityReportProfileSource(
      reportSource,
      "missing-clinic",
      diagnostics,
    );

    expect(profile.id).toBe("yuanjie");
    expect(diagnostics.join("\n")).toContain("missing-clinic");
  });

  it("replaces theme values in two phases so overlapping colors do not cascade", () => {
    const profile = parseFertilityReportProfileSource({
      activeProfileId: "collision",
      profiles: {
        collision: {
          service: {},
          theme: {
            primaryColor: "#8FB5E8",
            secondaryColor: "#D79ACB",
            accentColor: "#112233",
          },
        },
      },
    });
    const result = applyFertilityReportProfile({
      profile,
      html: '<main class="report"><style>:root{--primary:#5B2A86;--accent:#8FB5E8}</style></main>',
      markdown: "",
    });

    expect(result.html).toContain("--primary:#8FB5E8");
    expect(result.html).toContain("--accent:#112233");
  });

  it("keeps built-in scoring untouched when the active profile is preserve_builtin", () => {
    const profile = parseFertilityScoringProfileSource({
      activeProfileId: "default",
      profiles: {
        default: {
          mode: "preserve_builtin",
          version: "v1",
          dimensions: {},
        },
      },
    });
    const result = applyFertilityScoringProfile({
      dimensions: { female_oocyte_context: sampleDimension },
      profile,
    });

    expect(result.female_oocyte_context?.score).toBe(4.8);
    expect(result.female_oocyte_context).toBe(sampleDimension);
  });

  it("recalculates only dimensions explicitly configured by a doctor profile", () => {
    const profile = parseFertilityScoringProfileSource({
      activeProfileId: "clinic-a",
      profiles: {
        "clinic-a": {
          mode: "recalculate_configured_dimensions",
          version: "clinic-a-v1",
          noEvidenceReferenceScore: 5,
          statusEffect: { high_concern: -2.5 },
          dimensions: {
            female_oocyte_context: {
              baseScore: 6.5,
              criterionWeights: { age_context: 1.6 },
            },
          },
        },
      },
    });
    const result = applyFertilityScoringProfile({
      dimensions: { female_oocyte_context: sampleDimension },
      profile,
    });
    const calibrated = result.female_oocyte_context;

    expect(calibrated?.score).toBeLessThan(4.8);
    expect(calibrated?.evidence[0]).toMatchObject({
      scoringProfileId: "clinic-a",
      scoringProfileVersion: "clinic-a-v1",
    });
  });

  it("uses the profile reference score as calibration baseline when baseScore is omitted", () => {
    const profile = parseFertilityScoringProfileSource({
      activeProfileId: "clinic-a",
      profiles: {
        "clinic-a": {
          mode: "recalculate_configured_dimensions",
          version: "clinic-a-v2",
          noEvidenceReferenceScore: 5,
          statusEffect: { high_concern: -2 },
          dimensions: {
            female_oocyte_context: {
              criterionWeights: { age_context: 1 },
            },
          },
        },
      },
    });
    const result = applyFertilityScoringProfile({
      dimensions: { female_oocyte_context: sampleDimension },
      profile,
    });

    // Recalculation starts from the profile baseline 5.0, not the already-calculated 4.8.
    expect(result.female_oocyte_context?.score).toBe(4);
  });
});