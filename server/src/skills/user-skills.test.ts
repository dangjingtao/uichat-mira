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
  it("turns a plain Markdown document into a discoverable Skill package", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mira-user-skills-"));
    tempDirs.push(root);
    process.env.MIRA_USER_SKILLS_ROOT = root;

    const imported = await importMarkdownSkill({
      fileName: "review-playbook.md",
      content: "# 产品复盘教练\n\n帮助我复盘一个产品决策，并优先找出最关键的错误假设。",
    });

    expect(imported.name).toBe("产品复盘教练");
    expect(imported.content).toContain('displayName: "产品复盘教练"');
    expect(imported.content).toContain("# 产品复盘教练");

    const manifests = await new SkillScanner().scan([root]);
    expect(manifests).toEqual([
      expect.objectContaining({
        id: imported.id,
        name: "产品复盘教练",
        source: "用户导入",
      }),
    ]);
  });

  it("preserves explicit metadata while normalizing the generated package", async () => {
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
  });

  it("updates user-facing metadata without rewriting the Skill body", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mira-user-skills-"));
    tempDirs.push(root);
    process.env.MIRA_USER_SKILLS_ROOT = root;

    const imported = await importMarkdownSkill({
      fileName: "demo.md",
      content: "# Demo Skill\n\nReusable instructions stay intact.",
    });
    const updated = await updateUserSkill(imported.entry, {
      name: "Demo Skill 2",
      category: "工程研发",
      featured: true,
    });

    expect(updated.name).toBe("Demo Skill 2");
    expect(updated.category).toBe("工程研发");
    expect(updated.featured).toBe(true);
    expect(updated.content).toContain('displayName: "Demo Skill 2"');
    expect(updated.content).toContain('category: "工程研发"');
    expect(updated.content).toContain("featured: true");
    expect(updated.content).toContain("Reusable instructions stay intact.");
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
