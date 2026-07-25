import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSkillFlowRequestContextMessages } from "@/skills/flow/context.js";
import type { SkillDirective } from "@/skills/flow/types.js";
import type { AgentNodeState } from "../node-runtime";

const mocks = vi.hoisted(() => ({
  basePlanner: vi.fn(),
  parsePlannerOutput: vi.fn(),
}));

vi.mock("../planner/index", () => ({
  nextActionPlannerNode: mocks.basePlanner,
  parseNextActionPlannerOutput: mocks.parsePlannerOutput,
}));

import { nextActionPlannerNode } from "./next-action-planner";

const createState = (directive: SkillDirective): AgentNodeState =>
  ({
    runId: "run-fertility-1",
    threadId: "thread-fertility-1",
    userId: 1,
    goal: {
      id: "goal-fertility-1",
      text: "完成备孕全景评估并生成报告",
      successCriteria: ["完成评估", "交付报告"],
      constraints: [],
      riskLevel: "low",
    },
    messages: [
      {
        role: "user",
        content: "帮我做一个备孕全景评估。",
        parts: [],
      },
    ],
    requestContextMessages: buildSkillFlowRequestContextMessages(directive),
  }) as AgentNodeState;

describe("nextActionPlannerNode active Skill conversation flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("turns structured user-input requirements into a Parent ask_user without Main Planner tools", async () => {
    const state = createState({
      skillId: "fertility-assessment",
      sessionId: "fertility-session-1",
      phase: "collecting",
      flowCompleted: false,
      round: 0,
      maxRounds: 10,
      interruption: {
        reason: "missing_requirement",
        requirements: [
          {
            id: "fertility-baseline-context",
            kind: "user_input",
            description:
              "缺少双方的基础备孕背景，包括年龄、备孕时长、既往妊娠经历与当前最担心的问题。",
            requiredFor: "建立首轮评估状态",
            acceptedFormats: ["natural_language"],
          },
        ],
      },
    });

    const result = await nextActionPlannerNode(state);

    expect(mocks.basePlanner).not.toHaveBeenCalled();
    expect(result.nextAction).toMatchObject({
      type: "ask_user",
    });
    expect(result.nextAction?.type === "ask_user" && result.nextAction.question).toContain(
      "请补充双方的基础备孕背景",
    );
  });

  it("keeps final confirmation as one Parent question and accepts an explicit no-more answer", async () => {
    const state = createState({
      skillId: "fertility-assessment",
      sessionId: "fertility-session-1",
      phase: "final_confirmation",
      flowCompleted: false,
      round: 4,
      maxRounds: 10,
      interruption: {
        reason: "missing_requirement",
        requirements: [
          {
            id: "fertility-final-confirmation",
            kind: "user_input",
            description:
              "需要用户确认是否还有尚未提供但重要的备孕、检查或治疗信息。",
            requiredFor: "结束信息收集并进入报告生成",
            acceptedFormats: [
              "natural_language",
              "explicit_no_more_information",
            ],
          },
        ],
      },
    });

    const result = await nextActionPlannerNode(state);

    expect(mocks.basePlanner).not.toHaveBeenCalled();
    expect(result.nextAction?.type).toBe("ask_user");
    expect(result.nextAction?.type === "ask_user" && result.nextAction.question).toContain(
      "如果没有补充",
    );
  });

  it("keeps completed deterministic report delivery out of Main Planner", async () => {
    const state = createState({
      skillId: "fertility-assessment",
      sessionId: "fertility-session-1",
      phase: "ready",
      flowCompleted: true,
      round: 5,
      maxRounds: 10,
      next: {
        intent: "deliver_report",
        targetSkillId: "fertility-assessment",
        args: { format: "inline_html", htmlAvailable: true },
      },
      delivery: {
        kind: "inline_html",
        content: "备孕全景报告已经生成。",
        inlineHtml: "<main>report</main>",
        reportTitle: "两个人的备孕全景报告",
        pdf: {
          available: false,
          fileName: "两个人的备孕全景报告.pdf",
        },
      },
    });

    const result = await nextActionPlannerNode(state);

    expect(mocks.basePlanner).not.toHaveBeenCalled();
    expect(result.nextAction?.type).toBe("answer");
    expect(result.finalizationPacket?.type).toBe("answer");
  });
});
