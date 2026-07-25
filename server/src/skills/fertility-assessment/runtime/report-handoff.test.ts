import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  executeLegacyReportStage: vi.fn(),
}));

vi.mock("../../fertility-report/runtime.js", () => ({
  fertilityReportRuntime: {
    execute: mocks.executeLegacyReportStage,
  },
}));

import { fertilityAssessmentReportRuntime } from "./report-handoff.js";

describe("fertility assessment report handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves report delivery while returning ownership to the single public Skill", async () => {
    const legacyDirective = {
      skillId: "fertility-report",
      sessionId: "fertility-session-1",
      phase: "ready",
      flowCompleted: true,
      round: 4,
      maxRounds: 10,
      stateRef: "skill-flow://fertility-session-1",
      next: {
        intent: "deliver_report",
        targetSkillId: "fertility-report",
        args: { format: "inline_html", pdfAvailable: true },
      },
      delivery: {
        kind: "inline_html",
        content: "报告已生成",
        inlineHtml: "<main>report</main>",
        reportTitle: "两个人的备孕全景报告",
        pdf: { available: true, fileName: "两个人的备孕全景报告.pdf" },
      },
    };
    mocks.executeLegacyReportStage.mockResolvedValue({
      session: {
        skillId: "fertility-report",
        sessionId: "fertility-session-1",
        status: "ready",
        round: 4,
        maxRounds: 10,
        state: {},
        createdAt: "2026-07-25T00:00:00.000Z",
        updatedAt: "2026-07-25T00:01:00.000Z",
        lastDirective: legacyDirective,
      },
      directive: legacyDirective,
    });

    const result = await fertilityAssessmentReportRuntime.execute({} as never);

    expect(mocks.executeLegacyReportStage).toHaveBeenCalledOnce();
    expect(result.directive.skillId).toBe("fertility-assessment");
    expect(result.directive.next?.targetSkillId).toBe("fertility-assessment");
    expect(result.directive.delivery).toEqual(legacyDirective.delivery);
    expect(result.session.skillId).toBe("fertility-assessment");
    expect(result.session.lastDirective).toEqual(result.directive);
  });
});
