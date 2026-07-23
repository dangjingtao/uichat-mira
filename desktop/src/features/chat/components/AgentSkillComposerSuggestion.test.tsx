// @vitest-environment jsdom
import assert from "node:assert/strict";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { test, vi } from "vitest";
import {
  AgentSkillComposerSuggestion,
  getAgentSkillDraftQuery,
  insertExplicitSkill,
} from "./AgentSkillComposerSuggestion";

vi.mock("@/shared/api/officeSuiteSkills", () => ({
  getWenshuSkillCatalog: vi.fn().mockResolvedValue({
    skills: [
      {
        id: "xlsx",
        name: "Excel 分析",
        description: "分析电子表格和财务模型",
      },
      {
        id: "pdf",
        name: "PDF 处理",
        description: "合并、拆分和审阅 PDF",
      },
    ],
  }),
}));

test("recognizes a trailing explicit Skill draft", () => {
  assert.equal(getAgentSkillDraftQuery("请使用 $xls"), "xls");
  assert.equal(getAgentSkillDraftQuery("$"), "");
  assert.equal(getAgentSkillDraftQuery("请使用 $xlsx 后继续"), null);
});

test("replaces an explicit Skill draft while preserving the message", () => {
  assert.equal(
    insertExplicitSkill("请使用 $xls", "xlsx"),
    "请使用 $xlsx ",
  );
});

test("shows matching skills and selects an explicit Skill", async () => {
  const onSelect = vi.fn();
  render(<AgentSkillComposerSuggestion text="$xls" onSelect={onSelect} />);

  await waitFor(() => assert.ok(screen.getByRole("option", { name: "使用技能 Excel 分析" })));
  fireEvent.click(screen.getByRole("option", { name: "使用技能 Excel 分析" }));
  assert.deepEqual(onSelect.mock.calls, [["xlsx"]]);
  assert.equal(screen.queryByText("PDF 处理"), null);
});
