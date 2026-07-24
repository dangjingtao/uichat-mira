import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SkillScanner } from "./context/scanner.js";
import { deleteUserSkill, importMarkdownSkill, updateUserSkill } from "./user-skills.js";

const tempDirs: string[] = [];
const originalUserSkillsRoot = process.env.MIRA_USER_SKILLS_ROOT;

afterEach(async () => {
  if (originalUserSkillsRoot === undefined) delete process.env.MIRA_USER_SKILLS_ROOT;
  else process.env.MIRA_USER_SKILLS_ROOT = originalUserSkillsRoot;
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("Markdown Skill import", () => {
  it("turns a plain Markdown document into a categorized discoverable Skill package", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mira-user-skills-"));
    tempDirs.push(root);
    process.env.MIRA_USER_SKILLS_ROOT = root;

    const imported = await importMarkdownSkill({
      fileName: "review-playbook.md",
      content: "# 产品复盘教练\n\n帮助我复盘一个产品决策，并优先找出最关键的错误假设。",
    });

    expect(imported.name).toBe("产品复盘教练");
    expect(imported.category).toBe("内容创作");
    expect(imported.entry).toBe(path.join(root, "内容创作", imported.id, "SKILL.md"));
    expect(imported.content).toContain('displayName: "产品复盘教练"');
    expect(imported.content).toContain("visibility: public");
    expect(imported.content).toContain("# 产品复盘教练");

    const manifests = await new SkillScanner().scan([root]);
    expect(manifests).toEqual([
      expect.objectContaining({
        id: imported.id,
        name: "产品复盘教练",
        source: "用户导入",
        category: "内容创作",
      }),
    ]);
  });

  it("preserves explicit metadata while using category as the first-level directory", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mira-user-skills-"));
    tempDirs.push(root);
    process.env.MIRA_USER_SKILLS_ROOT = root;

    const imported = await importMarkdownSkill({
      fileName: "skill.md",
      content: `---\nid: decision-review\ndisplayName: 决策复盘\ndescription: 复盘关键决策\ncategory: 商业金融\n---\n\n# Routing\n\n用于复盘重要决策。`,
    });

    expect(imported).toMatchObject({
      id: "decision-review",
      name: "决策复盘",
      description: "复盘关键决策",
      category: "商业金融",
    });
    expect(imported.entry).toBe(path.join(root, "商业金融", "decision-review", "SKILL.md"));
  });

  it("moves the whole user Skill package when its category changes", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mira-user-skills-"));
    tempDirs.push(root);
    process.env.MIRA_USER_SKILLS_ROOT = root;

    const imported = await importMarkdownSkill({
      fileName: "demo.md",
      content: "# Demo Skill\n\nReusable instructions stay intact.",
    });
    const oldSkillDir = path.dirname(imported.entry);
    await fs.writeFile(path.join(oldSkillDir, "notes.txt"), "keep me", "utf8");

    const updated = await updateUserSkill(imported.entry, {
      name: "Demo Skill 2",
      category: "工程研发",
      featured: true,
    });

    expect(updated.name).toBe("Demo Skill 2");
    expect(updated.category).toBe("工程研发");
    expect(updated.featured).toBe(true);
    expect(updated.entry).toBe(path.join(root, "工程研发", imported.id, "SKILL.md"));
    expect(updated.content).toContain('displayName: "Demo Skill 2"');
    expect(updated.content).toContain('category: "工程研发"');
    expect(updated.content).toContain("featured: true");
    expect(updated.content).toContain("Reusable instructions stay intact.");
    await expect(fs.stat(oldSkillDir)).rejects.toThrow();
    await expect(fs.readFile(path.join(root, "工程研发", imported.id, "notes.txt"), "utf8")).resolves.toBe("keep me");
  });

  it("keeps legacy flat user packages discoverable and migrates them on edit", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mira-user-skills-"));
    tempDirs.push(root);
    process.env.MIRA_USER_SKILLS_ROOT = root;

    const legacyDir = path.join(root, "legacy-skill");
    await fs.mkdir(legacyDir, { recursive: true });
    const legacyEntry = path.join(legacyDir, "SKILL.md");
    await fs.writeFile(
      legacyEntry,
      `---\nid: legacy-skill\ndisplayName: Legacy Skill\ndescription: legacy\ncategory: 内容创作\n---\n\n# Legacy`,
      "utf8",
    );

    const before = await new SkillScanner().scan([root]);
    expect(before.map((skill) => skill.id)).toEqual(["legacy-skill"]);

    const updated = await updateUserSkill(legacyEntry, { category: "工程研发" });
    expect(updated.entry).toBe(path.join(root, "工程研发", "legacy-skill", "SKILL.md"));
    await expect(fs.stat(legacyDir)).rejects.toThrow();
  });

  it("deletes only packages inside the managed user Skill root", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mira-user-skills-"));
    tempDirs.push(root);
    process.env.MIRA_USER_SKILLS_ROOT = root;

    const imported = await importMarkdownSkill({
      fileName: "delete-me.md",
      content: "# Delete Me\n\nTemporary Skill.",
    });
    await deleteUserSkill(imported.entry);
    await expect(fs.stat(path.dirname(imported.entry))).rejects.toThrow();

    const outside = path.join(os.tmpdir(), "SKILL.md");
    await expect(updateUserSkill(outside, { name: "Nope" })).rejects.toThrow(
      "Only user-installed Skill packages can be modified",
    );
    await expect(deleteUserSkill(outside)).rejects.toThrow(
      "Only user-installed Skill packages can be modified",
    );
  });
});