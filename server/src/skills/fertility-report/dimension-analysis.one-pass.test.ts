import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  streamChatText: vi.fn(),
}));

vi.mock("@/services/provider-proxy.service/index.js", () => ({
  providerProxyService: {
    streamChatText: mocks.streamChatText,
  },
}));

import type { FertilityAssessmentState } from "../fertility-assessment/runtime.js";
import {
  buildFertilityReportContent,
  FEMALE_DIMENSIONS,
} from "./dimension-analysis.js";

const reportPayload = JSON.stringify({
  dimensions: FEMALE_DIMENSIONS.map(([id]) => ({
    id,
    signals: [],
    strengths: [],
    concerns: [],
    missingEvidence: [],
    interpretation: `${id}的专属判断`,
    actions: {
      selfCare: [],
      discussWithClinician: [],
      testsToConsider: [],
    },
  })),
  summary: {
    strengths: ["已建立完整服务档案"],
    priorities: ["根据现有资料安排下一步"],
    visitPrep: [],
    lifestyleFocus: [],
  },
  closingMessage:
    "谢谢您愿意把这些经历交给我们整理。愿接下来的每一步都更清楚，也愿您在这个过程中被认真理解和温柔支持。",
});

const state: FertilityAssessmentState = {
  facts: {
    serviceProfile: {
      displayName: "周女士",
      assessmentScope: "female",
      subjectGender: "female",
      currentGoal: "natural_conception",
    },
  },
  caseRecord: {
    evidenceLedger: {
      E001: {
        id: "E001",
        fieldId: "female.age",
        statement: "女方34岁",
        value: 34,
        source: "user_reported",
        round: 1,
        relatedDimensionIds: ["female_oocyte_context"],
      },
    },
    askedRequirementIds: [],
    declinedRequirementIds: [],
    answerLog: [{ round: 1, text: "我34岁。" }],
  },
  missingCriticalFields: [],
  uncertainties: [],
  contradictions: [],
  dimensions: {},
};

describe("fertility report one-pass generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.streamChatText.mockImplementation(async function* () {
      yield reportPayload;
    });
  });

  it("uses the main model once for one subject and returns all ten dimensions", async () => {
    const result = await buildFertilityReportContent(state, FEMALE_DIMENSIONS);

    expect(mocks.streamChatText).toHaveBeenCalledTimes(1);
    expect(mocks.streamChatText).toHaveBeenCalledWith(
      "default",
      expect.any(Array),
      expect.objectContaining({ maxTokens: 12000 }),
    );
    expect(Object.keys(result.dimensions)).toHaveLength(10);
    expect(result.summary.strengths).toContain("已建立完整服务档案");
    expect(result.closingMessage).toContain("温柔支持");

    const messages = mocks.streamChatText.mock.calls[0]?.[1] as Array<{
      content: string;
    }>;
    expect(messages[1]?.content).toContain("E001");
    expect(messages[1]?.content).toContain("我34岁");
  });
});
