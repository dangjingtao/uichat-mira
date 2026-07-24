import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrateLegacyUserSkillPackages } from "./user-skill-migration.js";

const tempDirs: string[] = [];
const originalUserSkillsRoot = process.env.MIRA_USER_SKILLS_ROOT;

afterEach(async () => {
  if (originalUserSkillsRoot === undefined) delete process.env.MIRA_USER_SKILLS_ROOT;
  else process.env.MIRA_USER_SKILLS_ROOT = originalUserSkillsRoot;
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("legacy user Skill migration", () => {
  it("moves the whole flat package into category/skill layout", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mira-skill-migrate-"));
    tempDirs.push(root);
    process.env.MIRA_USER_SKILLS_ROOT = root;

    const legacy = path.join(root, "wechat-writer");
    await fs.mkdir(path.join(legacy, "references"), { recursive: true });
    await fs.writeFile(
      path.join(legacy, "SKILL.md"),
      `---\nid: wechat-writer\ndisplayName: 微信写作\ndescription: demo\ncategory: 内容创作\n---\n\n# Skill`,
      "utf8",
    );
    await fs.writeFile(path.join(legacy, "references", "guide.md"), "keep", "utf8");

    const result = await migrateLegacyUserSkillPackages();
    const target = path.join(root, "内容创作", "wechat-writer");

    expect(result.migrated).toEqual([
      expect.objectContaining({ id: "wechat-writer", from: legacy, to: target }),
    ]);
    await expect(fs.stat(legacy)).rejects.toThrow();
    await expect(fs.readFile(path.join(target, "SKILL.md"), "utf8")).resolves.toContain("wechat-writer");
    await expect(fs.readFile(path.join(target, "references", "guide.md"), "utf8")).resolves.toBe("keep");
  });

  it("does not touch already categorized packages", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mira-skill-migrate-"));
    tempDirs.push(root);
    process.env.MIRA_USER_SKILLS_ROOT = root;

    const canonical = path.join(root, "内容创作", "writer");
    await fs.mkdir(canonical, { recursive: true });
    await fs.writeFile(
      path.join(canonical, "SKILL.md"),
      `---\nid: writer\ndescription: demo\ncategory: 内容创作\n---\n`,
      "utf8",
    );

    await expect(migrateLegacyUserSkillPackages()).resolves.toEqual({ migrated: [], skipped: [] });
    await expect(fs.stat(path.join(canonical, "SKILL.md"))).resolves.toBeDefined();
  });

  it("does not overwrite an existing canonical target", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mira-skill-migrate-"));
    tempDirs.push(root);
    process.env.MIRA_USER_SKILLS_ROOT = root;

    const legacy = path.join(root, "writer");
    const target = path.join(root, "内容创作", "writer");
    await fs.mkdir(legacy, { recursive: true });
    await fs.mkdir(target, { recursive: true });
    const manifest = `---\nid: writer\ndescription: demo\ncategory: 内容创作\n---\n`;
    await fs.writeFile(path.join(legacy, "SKILL.md"), manifest, "utf8");
    await fs.writeFile(path.join(target, "SKILL.md"), manifest, "utf8");

    const result = await migrateLegacyUserSkillPackages();
    expect(result.migrated).toEqual([]);
    expect(result.skipped).toEqual([
      expect.objectContaining({ id: "writer", path: legacy }),
    ]);
    await expect(fs.stat(path.join(legacy, "SKILL.md"))).resolves.toBeDefined();
  });
});
