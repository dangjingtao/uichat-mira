import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FertilityAssessmentState } from "../fertility-assessment/runtime.js";

const mocks = vi.hoisted(() => ({
  collectTaskModelText: vi.fn(),
}));

vi.mock("@/services/task-model.service.js", () => ({
  collectTaskModelText: mocks.collectTaskModelText,
}));

import {
  completeFertilityDimensions,
  FEMALE_DIMENSIONS,
} from "./dimension-analysis.js";

const state: FertilityAssessmentState = {
  facts: {
    serviceProfile: {
      displayName: "林女士",
      assessmentScope: "female",
      subjectGender: "female",
      currentGoal: "natural_conception",
    },
    people: { female: { age: 42 } },
  },
  missingCriticalFields: [],
  uncertainties: [],
  contradictions: [],
  dimensions: {},
};

describe("fertility report dimension analysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("produces numeric low-confidence dimensions even when every TaskModel batch fails", async () => {
    mocks.collectTaskModelText.mockRejectedValue(new Error("model unavailable"));

    const result = await completeFertilityDimensions(state, FEMALE_DIMENSIONS);

    expect(Object.keys(result)).toHaveLength(10);
    for (const [id] of FEMALE_DIMENSIONS) {
      expect(result[id]?.score).toBe(5);
      expect(result[id]?.confidence).toBe("low");
      expect(result[id]?.dataCompleteness).toBe(0);
    }
    expect(mocks.collectTaskModelText).toHaveBeenCalledTimes(5);
  });

  it("uses criterion signals rather than accepting a TaskModel score", async () => {
    mocks.collectTaskModelText.mockImplementation(async (_messages, options) => {
      const purpose = String(options?.purpose ?? "");
      if (purpose.includes("female_oocyte_context")) {
        return JSON.stringify({
          dimensions: [
            {
              id: "female_oocyte_context",
              score: 10,
              confidence: "high",
              dataCompleteness: 1,
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
              interpretation: "年龄是当前最明确的时间窗口背景。",
              actions: {
                selfCare: [],
                discussWithClinician: [],
                testsToConsider: [],
              },
            },
          ],
        });
      }
      return JSON.stringify({ dimensions: [] });
    });

    const result = await completeFertilityDimensions(state, FEMALE_DIMENSIONS);
    const oocyte = result.female_oocyte_context;

    expect(oocyte?.score).toBeLessThan(5);
    expect(oocyte?.score).not.toBe(10);
    expect(oocyte?.confidence).toBe("low");
    expect(oocyte?.evidence[0]).toMatchObject({
      criterionId: "age_context",
      scoringVersion: "fertility-rubric-v2.0.0",
    });
  });
});
