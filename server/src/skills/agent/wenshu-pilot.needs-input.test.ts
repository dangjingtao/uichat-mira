import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runPi: vi.fn(),
}));

vi.mock("./pi-core.js", () => ({
  runPiSkillAgent: mocks.runPi,
}));

import { runWenShuPiSkillAgentPilot } from "./wenshu-pilot.js";

const docxSkillContext = {
  instruction: "Use the DOCX runtime.",
  primary: {
    id: "docx",
    version: "1.0.0",
    name: "DOCX",
    body: "Create grounded Word documents and do not invent business facts.",
  },
  resources: [],
  disclosedResources: [],
};

describe("WenShu DOCX deterministic needs-input boundary", () => {
  it("asks for project facts instead of fabricating a formal acceptance report", async () => {
    const result = await runWenShuPiSkillAgentPilot({
      goal: "帮我生成一份正式的项目验收报告 Word 文档。",
      skillContext: docxSkillContext,
      workspaceRoot: "/workspace",
    });

    expect(result.status).toBe("needs_input");
    expect(result.requirements).toHaveLength(3);
    expect(result.requirements?.map((item) => item.kind)).toEqual([
      "user_input",
      "user_input",
      "user_input",
    ]);
    expect(result.requirements?.map((item) => item.description).join("\n")).toContain(
      "项目名称",
    );
    expect(result.artifacts).toEqual([]);
    expect(mocks.runPi).not.toHaveBeenCalled();
  });
});
