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
  skillVersion: "1.0.0",
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
  messages: [],
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
    missingCriticalFields: [],
    uncertainties: [],
    contradictions: [],
    dimensionUpdates: patch.dimensionUpdates ?? [],
    collectionDisposition:
      patch.collectionDisposition ??
      (readyForFinalConfirmation ? "ready_for_final_confirmation" : "continue"),
    nextRequirement: {
      id: "fertility-next-gap",
      description: "缺少下一项最高价值信息",
      requiredFor: "继续完善评估",
      acceptedFormats: ["natural_language"],
    },
  });

describe("fertility assessment conversation flow contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with the lightweight service-profile requirement", async () => {
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
    expect(result.directive.interruption?.requirements[0]?.description).toContain(
      "如何称呼",
    );
    expect(result.session.status).toBe("collecting");
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
    expect(result.directive.interruption?.requirements[0]?.description).not.toContain(
      "缺少下一项最高价值信息",
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

  it("hands the same scoped assessment state to the internal report stage after confirmation", async () => {
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
        missingCriticalFields: ["AFC"],
        uncertainties: [],
        contradictions: [],
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
          description: "缺少女方AFC结果",
          requiredFor: "完善女性卵巢储备评估",
          acceptedFormats: ["natural_language"],
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
