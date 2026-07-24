import { describe, expect, it } from "vitest";
import {
  getSkillCatalogDetail,
  getSkillCatalogFileContent,
  listSkillCatalogSummaries,
} from "./catalog.js";

describe("Skill presentation catalog", () => {
  it("keeps list payload lightweight and separates package status from runtime requirements", async () => {
    const skills = await listSkillCatalogSummaries();
    const docx = skills.find((skill) => skill.id === "docx");
    const xlsx = skills.find((skill) => skill.id === "xlsx");

    expect(docx).toMatchObject({
      id: "docx",
      origin: "built-in",
      packageStatus: "bundled",
      featured: true,
    });
    expect(docx?.runtimeRequirements).toEqual([]);
    expect(xlsx).toMatchObject({
      id: "xlsx",
      origin: "built-in",
      packageStatus: "bundled",
      featured: true,
      runtimeRequirements: ["wenshu-office@1.0.0"],
    });
    expect(docx).not.toHaveProperty("files");
    expect(docx).not.toHaveProperty("content");
    expect(docx).not.toHaveProperty("fileContents");
  });

  it("loads file descriptors only for detail and reads text content on demand", async () => {
    const detail = await getSkillCatalogDetail("docx");
    expect(detail?.files.some((file) => file.path === "SKILL.md" && file.contentAvailable)).toBe(true);

    const content = await getSkillCatalogFileContent("docx", "SKILL.md");
    expect(content?.content).toContain("description:");
    expect(content?.truncated).toBe(false);
  });

  it("resolves packaged WenShu runtime source files without inlining them into catalog lists", async () => {
    const detail = await getSkillCatalogDetail("xlsx");
    expect(
      detail?.files.find((file) => file.path === "runtime/xlsx_runtime.py"),
    ).toMatchObject({
      kind: "runtime",
      previewable: true,
      contentAvailable: true,
      declaredOnly: false,
    });

    const content = await getSkillCatalogFileContent("xlsx", "runtime/xlsx_runtime.py");
    expect(content?.content).toContain("WenShu spreadsheet runtime");
  });

  it("rejects path traversal and missing package files", async () => {
    await expect(getSkillCatalogFileContent("docx", "../registry.ts")).resolves.toBeNull();
    await expect(getSkillCatalogFileContent("missing", "SKILL.md")).resolves.toBeNull();
  });
});
