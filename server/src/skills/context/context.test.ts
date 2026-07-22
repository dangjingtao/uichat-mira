import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SkillLoader } from "./loader.js";
import { SkillMatcher } from "./matcher.js";
import type { SkillManifest } from "./types.js";

const manifests: SkillManifest[] = [
  {
    id: "docx",
    name: "Word 文档处理",
    description: "Create and review DOCX documents",
    version: "1.0.0",
    entry: "/skills/docx/SKILL.md",
  },
  {
    id: "xlsx",
    name: "Excel 处理",
    description: "Create Excel workbooks and financial models",
    version: "1.0.0",
    entry: "/skills/xlsx/SKILL.md",
  },
  {
    id: "pdf",
    name: "PDF 文档处理",
    description: "Create and process PDF files",
    version: "1.0.0",
    entry: "/skills/pdf/SKILL.md",
  },
  {
    id: "pptx",
    name: "PowerPoint 处理",
    description: "Create PowerPoint presentations",
    version: "1.0.0",
    entry: "/skills/pptx/SKILL.md",
  },
];

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

describe("SkillMatcher", () => {
  it("prefers deterministic attachment type over ambiguous text", () => {
    const matcher = new SkillMatcher();
    const result = matcher.match({
      query: "帮我审一下这个",
      manifests,
      messages: [
        {
          role: "user",
          content: "帮我审一下这个",
          parts: [
            { type: "text", text: "帮我审一下这个" },
            {
              type: "file",
              filename: "contract.docx",
              mimeType:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              data: "file-ref",
            },
          ],
        },
      ],
    });

    expect(result.primary?.skillId).toBe("docx");
    expect(result.primary?.source).toBe("resource");
  });

  it("matches DCF requests to xlsx without auto-loading secondary skills", () => {
    const matcher = new SkillMatcher();
    const result = matcher.match({
      query: "给我做一个 DCF Excel 模型，再准备后续汇报思路",
      manifests,
      messages: [{ role: "user", content: "给我做一个 DCF Excel 模型，再准备后续汇报思路" }],
    });

    expect(result.primary?.skillId).toBe("xlsx");
    expect(result.primary?.score).toBeGreaterThanOrEqual(0.9);
  });

  it("gives explicit triggers highest priority", () => {
    const matcher = new SkillMatcher();
    const result = matcher.match({
      query: "$pdf 把这个 Excel 内容整理成报告",
      manifests,
      messages: [{ role: "user", content: "$pdf 把这个 Excel 内容整理成报告" }],
    });

    expect(result.primary).toMatchObject({ skillId: "pdf", source: "explicit", score: 1 });
  });
});

describe("SkillLoader", () => {
  it("loads SKILL.md separately and exposes references as stable skill:// URIs", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mira-skill-context-"));
    tempDirs.push(root);
    const skillRoot = path.join(root, "xlsx");
    await fs.mkdir(path.join(skillRoot, "reference"), { recursive: true });
    await fs.writeFile(
      path.join(skillRoot, "SKILL.md"),
      "---\nname: xlsx\ndescription: test\n---\n# Routing\nUse formulas.",
      "utf8",
    );
    await fs.writeFile(
      path.join(skillRoot, "reference", "DCF_SKILL.md"),
      "# DCF\nKeep valuation formula-linked.",
      "utf8",
    );

    const manifest: SkillManifest = {
      id: "xlsx",
      name: "Excel 处理",
      description: "test",
      version: "1.0.0",
      entry: path.join(skillRoot, "SKILL.md"),
    };
    const loader = new SkillLoader();
    const content = await loader.loadContent(manifest);
    const resources = await loader.listResources(manifest);

    expect(content.body).toContain("# Routing");
    expect(content.body).not.toContain("name: xlsx");
    expect(resources).toEqual([
      expect.objectContaining({
        uri: "skill://xlsx/reference/DCF_SKILL.md",
        kind: "reference",
      }),
    ]);

    const loaded = await loader.loadResource({ manifest, resource: resources[0]! });
    expect(loaded.content).toContain("formula-linked");
  });
});
