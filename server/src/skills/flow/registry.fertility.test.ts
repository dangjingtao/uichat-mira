import { describe, expect, it } from "vitest";
import {
  getSkillConversationFlowRuntime,
  getSkillDirectiveHandoffRuntime,
  listSkillConversationFlowRuntimes,
} from "./registry.js";

describe("fertility assessment runtime registry", () => {
  it("keeps one public conversation flow and one internal report handoff", () => {
    const publicRuntime = getSkillConversationFlowRuntime("fertility-assessment");
    const accidentalSecondFlow = getSkillConversationFlowRuntime("fertility-report");
    const internalReportStage = getSkillDirectiveHandoffRuntime("fertility-report");

    expect(publicRuntime?.skillId).toBe("fertility-assessment");
    expect(accidentalSecondFlow).toBeNull();
    expect(internalReportStage?.skillId).toBe("fertility-assessment");
    expect(
      listSkillConversationFlowRuntimes().filter(
        (runtime) => runtime.skillId === "fertility-assessment",
      ),
    ).toHaveLength(1);
  });
});
