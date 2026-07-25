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

const analysisResult = (readyForFinalConfirmation: boolean) =>
  JSON.stringify({
    factsPatch: {},
    missingCriticalFields: [],
    uncertainties: [],
    contradictions: [],
    dimensionUpdates: [],
    readyForFinalConfirmation,
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

  it("starts with the existing free-narrative baseline requirement", async () => {
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
        requirements: [{ id: "fertility-baseline-context", kind: "user_input" }],
      },
    });
    expect(result.session.status).toBe("collecting");
  });

  it("keeps the one-time final confirmation stage", async () => {
    mocks.collectTaskModelText.mockResolvedValue(analysisResult(true));
    const result = await fertilityAssessmentRuntime.processTurn(
      runtimeInput(
        createSession({ round: 2 }),
        "女方32岁，男方34岁，备孕一年，做过基础激素和精液检查。",
      ),
    );

    expect(result.directive.phase).toBe("final_confirmation");
    expect(result.directive.flowCompleted).toBe(false);
    expect(result.directive.interruption?.requirements).toEqual([
      expect.objectContaining({ id: "fertility-final-confirmation" }),
    ]);
    expect(result.session.status).toBe("final_confirmation");
  });

  it("hands the same assessment state to the internal report stage after confirmation", async () => {
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
});
