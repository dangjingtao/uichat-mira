import { describe, expect, it } from "vitest";
import { executeOfficeRuntimeTask } from "@/microapps/office-suite/runtime.js";
import { resolveActiveSkillContext } from "../registry.js";

describe("docx skill", () => {
  it("activates for DOCX review intent", () => {
    const skill = resolveActiveSkillContext({
      question: "帮我审阅 contract.docx，并用修订模式给出修改建议",
    });

    expect(skill?.id).toBe("docx");
    expect(skill?.primaryToolIds).toContain("office_document");
  });

  it("does not activate for unrelated code work", () => {
    const skill = resolveActiveSkillContext({
      question: "帮我修复这个 TypeScript 编译错误",
    });

    expect(skill).toBeNull();
  });

  it("creates and re-inspects a structured Word document", async () => {
    const created = await executeOfficeRuntimeTask({
      operation: "create",
      kind: "word",
      request: {
        type: "document",
        fileName: "skill-created.docx",
        title: "文枢 Skill 验证",
        paragraphs: [
          { text: "第一章", style: "heading1" },
          { text: "这是 DOCX Skill 生成的正文。", style: "body" },
        ],
        tables: [
          {
            rows: [
              ["能力", "状态"],
              ["docx skill", "ready"],
            ],
          },
        ],
      },
    });

    expect(created.status).toBe("completed");
    if (created.status !== "completed" || !created.artifacts[0]) {
      throw new Error("Structured Word create did not return an artifact");
    }

    const inspected = await executeOfficeRuntimeTask({
      operation: "inspect",
      input: {
        fileName: created.artifacts[0].fileName,
        mimeType: created.artifacts[0].mimeType,
        buffer: created.artifacts[0].buffer,
      },
    });

    expect(inspected.status).toBe("completed");
    if (inspected.status !== "completed") {
      throw new Error(inspected.error.message);
    }
    expect(inspected.kind).toBe("word");
    expect(inspected.inspection?.previewText).toContain("文枢 Skill 验证");
    expect(inspected.inspection?.previewText).toContain("这是 DOCX Skill 生成的正文");
  });
});
