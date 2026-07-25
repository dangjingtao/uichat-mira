import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredSkillFlowSession } from "../flow/types.js";

const mocks = vi.hoisted(() => ({
  collectTaskModelText: vi.fn(),
}));

vi.mock("@/services/task-model.service.js", () => ({
  collectTaskModelText: mocks.collectTaskModelText,
}));

import { fertilityAssessmentRuntime } from "./runtime.js";

const createSession = (
  patch: Partial<StoredSkillFlowSession> = {},
): StoredSkillFlowSession => ({
  sessionId: "fertility-session-1",
  threadId: "thread-1",
  userId: 1,
  skillId: "fertility-assessment",
  skillVersion: "1.1.0",
  status: "collecting",
  round: 0,
  maxRounds: 10,
  state: fertilityAssessmentRuntime.createInitialState(),
  processedMessageIds: [],
  createdAt: "2026-07-25T00:00:00.000Z",
  updatedAt: "2026-07-25T00:00:00.000Z",
  ...patch,
});

const runtimeInput = (session: StoredSkillFlowSession, query: string) => ({
  session,
  threadId: session.threadId,
  userId: session.userId,
  userMessageId: `message-${session.round + 1}`,
  query,
  messages: [
    {
      role: "user" as const,
      content: query,
      parts: [],
    },
  ],
});

const serviceProfile = {
  displayName: "陈夏夫妻",
  assessmentScope: "couple",
  subjectGender: "couple",
  currentGoal: "assisted_reproduction",
  femaleName: "夏小姐",
  maleName: "陈先生",
};

const analysisResult = (
  readyForFinalConfirmation: boolean,
  patch: Record<string, unknown> = {},
) =>
  JSON.stringify({
    factsPatch: { serviceProfile, ...(patch.factsPatch as object | undefined) },
    evidenceItems: patch.evidenceItems ?? [],
    missingCriticalFields: [],
    uncertainties: [],
    contradictions: [],
    declinedRequirementIds: patch.declinedRequirementIds ?? [],
    dimensionUpdates: patch.dimensionUpdates ?? [],
    collectionDisposition:
      patch.collectionDisposition ??
      (readyForFinalConfirmation ? "ready_for_final_confirmation" : "continue"),
    nextRequirement: {
      id: "fertility-next-gap",
      description: "下一项最高价值业务信息",
      requiredFor: "继续完善评估",
      acceptedFormats: ["natural_language", "service_conversation"],
      userPrompt:
        "谢谢你前面说得很清楚。我还想了解一次既往治疗结果，因为它最能帮助我们理解当前方向；记得多少说多少，不方便回答也没关系。",
      ...(patch.nextRequirement as object | undefined),
    },
  });

describe("fertility assessment conversation flow contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with a service-toned lightweight profile requirement", async () => {
    const result = await fertilityAssessmentRuntime.processTurn(
      runtimeInput(createSession(), "帮我做一个备孕全景评估"),
    );

    expect(mocks.collectTaskModelText).not.toHaveBeenCalled();
    expect(result.directive).toMatchObject({
      skillId: "fertility-assessment",
      phase: "collecting",
      flowCompleted: false,
      round: 0,
      maxRounds: 10,
      interruption: {
        reason: "missing_requirement",
        requirements: [{ id: "fertility-service-profile", kind: "user_input" }],
      },
    });
    expect(result.directive.interruption?.requirements[0]?.userPrompt).toContain(
      "怎么称呼",
    );
    expect(
      (
        result.session.state.caseRecord as {
          askedRequirementIds: string[];
        }
      ).askedRequirementIds,
    ).toContain("fertility-service-profile");
    expect(result.session.status).toBe("collecting");
  });

  it("persists raw answers and numbered evidence in the temporary case record", async () => {
    mocks.collectTaskModelText.mockResolvedValue(
      analysisResult(false, {
        evidenceItems: [
          {
            fieldId: "female.age",
            statement: "女方34岁",
            value: 34,
            source: "user_reported",
            relatedDimensionIds: ["female_oocyte_context"],
          },
          {
            fieldId: "female.amh",
            statement: "AMH 1.8 ng/mL，用户口述",
            value: 1.8,
            unit: "ng/mL",
            source: "user_reported",
            relatedDimensionIds: ["female_ovarian_reserve"],
          },
        ],
      }),
    );

    const result = await fertilityAssessmentRuntime.processTurn(
      runtimeInput(createSession(), "女方34岁，AMH 1.8 ng/mL。"),
    );
    const caseRecord = result.session.state.caseRecord as {
      evidenceLedger: Record<string, { fieldId: string }>;
      answerLog: Array<{ text: string }>;
      askedRequirementIds: string[];
    };

    expect(Object.keys(caseRecord.evidenceLedger)).toEqual(["E001", "E002"]);
    expect(Object.values(caseRecord.evidenceLedger).map((item) => item.fieldId)).toEqual([
      "female.age",
      "female.amh",
    ]);
    expect(caseRecord.answerLog.at(-1)?.text).toContain("女方34岁");
    expect(caseRecord.askedRequirementIds).toContain("fertility-next-gap");
    expect(result.directive.interruption?.requirements[0]?.userPrompt).toContain(
      "谢谢你",
    );
  });

  it("keeps the one-time final confirmation stage", async () => {
    mocks.collectTaskModelText.mockResolvedValue(analysisResult(true));
    const result = await fertilityAssessmentRuntime.processTurn(
      runtimeInput(
        createSession({ round: 2 }),
        "我们是陈夏夫妻，准备继续试管，女方32岁，男方34岁。",
      ),
    );

    expect(result.directive.phase).toBe("final_confirmation");
    expect(result.directive.flowCompleted).toBe(false);
    expect(result.directive.interruption?.requirements).toEqual([
      expect.objectContaining({ id: "fertility-final-confirmation" }),
    ]);
    expect(result.session.status).toBe("final_confirmation");
  });

  it("treats an explicit refusal to provide more information as a deterministic close signal", async () => {
    mocks.collectTaskModelText.mockResolvedValue(
      analysisResult(false, { collectionDisposition: "user_declined_more" }),
    );
    const result = await fertilityAssessmentRuntime.processTurn(
      runtimeInput(
        createSession({ round: 3 }),
        "我不方便再提供更多资料了。",
      ),
    );

    expect(result.directive.phase).toBe("final_confirmation");
    expect(result.session.status).toBe("final_confirmation");
    expect(result.directive.interruption?.requirements).toEqual([
      expect.objectContaining({ id: "fertility-final-confirmation" }),
    ]);
  });

  it("does not ask the same requirement twice", async () => {
    mocks.collectTaskModelText.mockResolvedValue(analysisResult(false));
    const state = fertilityAssessmentRuntime.createInitialState() as Record<
      string,
      unknown
    >;
    state.caseRecord = {
      evidenceLedger: {},
      askedRequirementIds: ["fertility-next-gap"],
      declinedRequirementIds: [],
      answerLog: [],
    };
    const result = await fertilityAssessmentRuntime.processTurn(
      runtimeInput(createSession({ round: 2, state }), "这部分我刚才已经说过了。"),
    );

    expect(result.directive.phase).toBe("final_confirmation");
    expect(result.directive.interruption?.requirements[0]?.id).toBe(
      "fertility-final-confirmation",
    );
  });

  it("uses an explicit generate-report request as the final confirmation itself", async () => {
    mocks.collectTaskModelText.mockResolvedValue(
      analysisResult(false, { collectionDisposition: "user_confirmed_report" }),
    );
    const result = await fertilityAssessmentRuntime.processTurn(
      runtimeInput(
        createSession({ round: 3 }),
        "没有其他补充了，请直接生成报告。",
      ),
    );

    expect(result.directive).toMatchObject({
      phase: "ready",
      flowCompleted: true,
      next: {
        intent: "generate_report",
        targetSkillId: "fertility-report",
      },
    });
    expect(result.session.status).toBe("ready");
    expect(result.directive.interruption).toBeUndefined();
  });

  it("hands the same scoped case record to the internal report stage after confirmation", async () => {
    mocks.collectTaskModelText.mockResolvedValue(analysisResult(true));
    const result = await fertilityAssessmentRuntime.processTurn(
      runtimeInput(
        createSession({ status: "final_confirmation", round: 3 }),
        "没有其他补充了。",
      ),
    );

    expect(result.directive).toMatchObject({
      skillId: "fertility-assessment",
      phase: "ready",
      flowCompleted: true,
      next: {
        intent: "generate_report",
        targetSkillId: "fertility-report",
        args: {
          reportType: "couple",
          displayName: "陈夏夫妻",
          currentGoal: "assisted_reproduction",
          format: "markdown",
          includeFemale: true,
          includeMale: true,
          htmlAvailable: true,
        },
      },
    });
    expect(result.directive.next?.args?.assessmentRef).toBe(result.directive.stateRef);
    expect(result.session.state.caseRecord).toBeDefined();
    expect(result.session.status).toBe("ready");
  });

  it("keeps a female-only service profile out of male dimensions and report work", async () => {
    mocks.collectTaskModelText.mockResolvedValue(
      JSON.stringify({
        factsPatch: {
          serviceProfile: {
            displayName: "林女士",
            assessmentScope: "female",
            subjectGender: "female",
            currentGoal: "natural_conception",
            femaleName: "林女士",
          },
        },
        evidenceItems: [],
        missingCriticalFields: ["AFC"],
        uncertainties: [],
        contradictions: [],
        declinedRequirementIds: [],
        dimensionUpdates: [
          {
            id: "female_ovarian_reserve",
            score: 6,
            confidence: "low",
            dataCompleteness: 0.3,
            evidence: [],
            strengths: [],
            concerns: [],
            missingEvidence: ["AFC"],
            interpretation: "信息有限",
            actions: { selfCare: [], discussWithClinician: [], testsToConsider: [] },
          },
          {
            id: "male_motility",
            score: 7,
            confidence: "medium",
            dataCompleteness: 0.5,
            evidence: [],
            strengths: [],
            concerns: [],
            missingEvidence: [],
            interpretation: "不应进入女方个人评估",
            actions: { selfCare: [], discussWithClinician: [], testsToConsider: [] },
          },
        ],
        collectionDisposition: "continue",
        nextRequirement: {
          id: "female-next-gap",
          description: "女方AFC结果",
          requiredFor: "完善女性卵巢储备评估",
          acceptedFormats: ["natural_language", "service_conversation"],
          userPrompt:
            "谢谢你已经说了AMH。我还想了解AFC，因为它能和AMH互相印证；不知道也没关系。",
        },
      }),
    );

    const result = await fertilityAssessmentRuntime.processTurn(
      runtimeInput(createSession(), "称呼我林女士，只评估女方，自然备孕。"),
    );
    const dimensions = result.session.state.dimensions as Record<string, unknown>;

    expect(dimensions.female_ovarian_reserve).toBeDefined();
    expect(dimensions.male_motility).toBeUndefined();
    expect(result.directive.phase).toBe("collecting");
  });
});
