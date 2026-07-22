import { describe, expect, it } from "vitest";
import { listBuiltInSkillContexts, resolveActiveSkillContext } from "./registry.js";

const attachmentMessage = (filename: string, mimeType: string) => [
  {
    role: "user" as const,
    content: "帮我处理这个文件",
    parts: [
      { type: "text" as const, text: "帮我处理这个文件" },
      {
        type: "file" as const,
        filename,
        mimeType,
        data: "data:application/octet-stream;base64,AA==",
      },
    ],
  },
];

describe("WenShu built-in skills", () => {
  it("registers document skills including pptx swarm semantics", () => {
    expect(listBuiltInSkillContexts().map((skill) => skill.id).sort()).toEqual([
      "docx",
      "pdf",
      "pptx",
      "pptx-swarm",
      "xlsx",
    ]);
  });

  it("routes PDF intent to the task-level PDF capability", () => {
    const skill = resolveActiveSkillContext({ question: "把这几个 PDF 合并后再拆成单页" });
    expect(skill?.id).toBe("pdf");
    expect(skill?.primaryToolIds).toContain("office_pdf");
  });

  it("routes spreadsheet finance intent to the task-level spreadsheet capability", () => {
    const skill = resolveActiveSkillContext({ question: "帮我做一个三表模型和 DCF Excel" });
    expect(skill?.id).toBe("xlsx");
    expect(skill?.primaryToolIds).toContain("office_spreadsheet");
  });

  it("routes a normal presentation to pptx", () => {
    const skill = resolveActiveSkillContext({ question: "做一份 12 页路演 PPT" });
    expect(skill?.id).toBe("pptx");
    expect(skill?.primaryToolIds).toContain("office_presentation");
  });

  it("routes a 20+ slide presentation to pptx-swarm semantics", () => {
    const skill = resolveActiveSkillContext({ question: "做一份 30 页 PPT 路演稿" });
    expect(skill?.id).toBe("pptx-swarm");
    expect(skill?.primaryToolIds).toContain("office_presentation");
  });

  it("routes batch presentation creation to pptx-swarm semantics", () => {
    const skill = resolveActiveSkillContext({ question: "批量做 3 份 PPT 演示文稿" });
    expect(skill?.id).toBe("pptx-swarm");
  });

  it("activates PDF from attachment metadata", () => {
    const skill = resolveActiveSkillContext({
      question: "帮我看看这个",
      messages: attachmentMessage("report.pdf", "application/pdf"),
    });
    expect(skill?.id).toBe("pdf");
  });

  it("activates XLSX from attachment metadata", () => {
    const skill = resolveActiveSkillContext({
      question: "帮我看看这个",
      messages: attachmentMessage(
        "model.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    });
    expect(skill?.id).toBe("xlsx");
  });

  it("activates PPTX from attachment metadata", () => {
    const skill = resolveActiveSkillContext({
      question: "帮我看看这个",
      messages: attachmentMessage(
        "deck.pptx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ),
    });
    expect(skill?.id).toBe("pptx");
  });

  it("keeps DOCX routing intact", () => {
    const skill = resolveActiveSkillContext({ question: "审阅 contract.docx 并添加批注" });
    expect(skill?.id).toBe("docx");
    expect(skill?.primaryToolIds).toContain("office_document");
  });

  it("prefers the current explicit task over stale document history", () => {
    const skill = resolveActiveSkillContext({
      question: "现在做一份 Excel DCF",
      messages: [
        {
          role: "user",
          content: "之前看过 report.pdf",
          parts: [{ type: "text", text: "之前看过 report.pdf" }],
        },
        {
          role: "assistant",
          content: "PDF 已处理。",
          parts: [{ type: "text", text: "PDF 已处理。" }],
        },
        {
          role: "user",
          content: "现在做一份 Excel DCF",
          parts: [{ type: "text", text: "现在做一份 Excel DCF" }],
        },
      ],
    });
    expect(skill?.id).toBe("xlsx");
  });
});
