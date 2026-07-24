// @vitest-environment jsdom
import assert from "node:assert/strict";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { test, vi } from "vitest";
import {
  AgentSkillComposerEditor,
  AgentSkillComposerSuggestion,
  AgentToolkitComposerSuggestion,
  getAgentSkillDraftQuery,
  insertExplicitSkill,
  resolveExplicitSkillsForSubmission,
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

vi.mock("@/shared/api/tools", () => ({
  getMcpTools: vi.fn().mockResolvedValue([
    {
      id: "web_search",
      title: "web_search",
      description: "搜索公网内容",
      workbench: {
        groupId: "web_search",
        groupLabel: "网络搜索",
        groupDescription: "公网实时搜索与本地新闻源检索。",
        icon: "globe",
      },
    },
  ]),
}));

test("recognizes a trailing explicit Skill draft", () => {
  assert.equal(getAgentSkillDraftQuery("请使用 $xls"), "xls");
  assert.equal(getAgentSkillDraftQuery("$"), "");
  assert.equal(getAgentSkillDraftQuery("请使用 $xlsx 后继续"), null);
});

test("replaces an explicit Skill draft while preserving the message", () => {
  assert.equal(
    insertExplicitSkill("请使用 $xls", "xlsx"),
    "请使用 @(xlsx) ",
  );
});

test("restores applied Skill mentions to the Agent submission protocol", () => {
  assert.equal(
    resolveExplicitSkillsForSubmission("请使用 @(xlsx) 和 @(pdf)"),
    "请使用 $xlsx 和 $pdf",
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

test("uses arrow keys to highlight suggestions and Enter to select", async () => {
  const onSelect = vi.fn();
  render(
    <>
      <textarea aria-label="composer" defaultValue="$" />
      <AgentSkillComposerSuggestion text="$" onSelect={onSelect} />
    </>,
  );

  await waitFor(() => assert.equal(screen.getAllByRole("option").length, 2));
  const editor = screen.getByRole("textbox", { name: "composer" });
  fireEvent.keyDown(editor, { key: "ArrowDown" });
  assert.equal(
    screen.getByRole("option", { name: "使用技能 PDF 处理" }).getAttribute("aria-selected"),
    "true",
  );
  fireEvent.keyDown(editor, { key: "Enter" });
  assert.deepEqual(onSelect.mock.calls, [["pdf"]]);
});

test("does not trim ordinary composer text while resolving markers", () => {
  assert.equal(resolveExplicitSkillsForSubmission("  保留首尾空格  "), "  保留首尾空格  ");
});

test("shows matching tool packages and selects a tool package", async () => {
  const onSelect = vi.fn();
  render(<AgentToolkitComposerSuggestion text="@网络" onSelect={onSelect} />);

  await waitFor(() =>
    assert.ok(screen.getByRole("option", { name: "使用工具包 网络搜索" })),
  );
  fireEvent.click(screen.getByRole("option", { name: "使用工具包 网络搜索" }));
  assert.deepEqual(onSelect.mock.calls, [["web_search"]]);
});

test("renders an applied Skill as its display name", async () => {
  const { container } = render(
    <AgentSkillComposerEditor
      text="@(xlsx) "
      placeholder="输入问题"
      disabled={false}
      onChange={() => {}}
      onSubmit={() => {}}
      onPasteFiles={() => {}}
    />,
  );

  await waitFor(() => assert.ok(screen.getAllByText("Excel 分析").length >= 1));
  const appliedSkill = document.querySelector("strong");
  const editor = screen.getByRole("textbox") as HTMLTextAreaElement;
  const highlighter = editor.previousElementSibling as HTMLDivElement;
  assert.equal(highlighter.style.zIndex, "1");
  assert.equal(highlighter.style.color, "rgb(var(--color-text-primary))");
  assert.equal(editor.style.color, "transparent");
  assert.equal(appliedSkill?.style.color, "rgb(168, 83, 55)");
  assert.ok(container.textContent?.includes("Excel 分析"));
  assert.equal(screen.queryByText("@(xlsx)"), null);
});

test("keeps ordinary pasted text visible in the editor", async () => {
  render(
    <AgentSkillComposerEditor
      text="一段普通文本"
      placeholder="输入问题"
      disabled={false}
      onChange={() => {}}
      onSubmit={() => {}}
      onPasteFiles={() => {}}
    />,
  );

  const editor = screen.getByRole("textbox") as HTMLTextAreaElement;
  await waitFor(() => assert.equal(editor.value, "一段普通文本"));
  const highlighter = editor.previousElementSibling as HTMLDivElement;
  const visibleText = [...highlighter.querySelectorAll("span")].find(
    (span) => span.textContent === "一段普通文本",
  );
  assert.equal(editor.style.color, "transparent");
  assert.equal(highlighter.style.color, "rgb(var(--color-text-primary))");
  assert.equal(visibleText?.style.visibility, "visible");
});

test("caps long composer content and scrolls inside the editor", async () => {
  const { container } = render(
    <AgentSkillComposerEditor
      text={Array.from({ length: 30 }, (_, index) => `第 ${index + 1} 行`).join("\n")}
      placeholder="输入问题"
      disabled={false}
      onChange={() => {}}
      onSubmit={() => {}}
      onPasteFiles={() => {}}
    />,
  );

  const editor = screen.getByRole("textbox") as HTMLTextAreaElement;
  const editorFrame = container.firstElementChild as HTMLDivElement;
  await waitFor(() =>
    assert.equal(editorFrame.style.maxHeight, "min(240px, 35vh)"),
  );
  assert.equal(editor.style.maxHeight, "min(240px, 35vh)");
  assert.equal(editor.style.overflowY, "auto");
});
