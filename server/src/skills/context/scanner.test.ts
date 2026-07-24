import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SkillScanner } from "./scanner.js";

const tempDirs: string[] = [];
const originalUserSkillsRoot = process.env.MIRA_USER_SKILLS_ROOT;

const writeSkill = async (dir: string, frontmatter: string, body = "# Skill") => {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "SKILL.md"), `---\n${frontmatter}\n---\n\n${body}\n`, "utf8");
};

afterEach(async () => {
  if (originalUserSkillsRoot === undefined) delete process.env.MIRA_USER_SKILLS_ROOT;
  else process.env.MIRA_USER_SKILLS_ROOT = originalUserSkillsRoot;
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("SkillScanner public discovery boundary", () => {
  it("treats category/skill as one public user Skill and never scans inside that package", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mira-user-skill-scan-"));
    tempDirs.push(root);
    process.env.MIRA_USER_SKILLS_ROOT = root;

    const skillDir = path.join(root, "内容创作", "writer");
    await writeSkill(
      skillDir,
      'id: writer\ndisplayName: 写作助手\ndescription: 写作方法',
    );
    await writeSkill(
      path.join(skillDir, "references", "internal-helper"),
      'id: leaked-helper\ndisplayName: 不应暴露\ndescription: internal',
    );

    const manifests = await new SkillScanner().scan([root]);

    expect(manifests).toEqual([
      expect.objectContaining({
        id: "writer",
        name: "写作助手",
        category: "内容创作",
      }),
    ]);
    expect(manifests.some((skill) => skill.id === "leaked-helper")).toBe(false);
  });

  it("keeps legacy user-installed flat packages discoverable", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mira-user-skill-legacy-"));
    tempDirs.push(root);
    process.env.MIRA_USER_SKILLS_ROOT = root;

    await writeSkill(
      path.join(root, "legacy-writer"),
      'id: legacy-writer\ndisplayName: 旧版写作\ndescription: legacy\ncategory: 内容创作',
    );

    const manifests = await new SkillScanner().scan([root]);
    expect(manifests.map((skill) => skill.id)).toEqual(["legacy-writer"]);
  });

  it("does not expose unregistered helpers while preserving explicit and legacy public source Skills", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mira-system-skill-scan-"));
    tempDirs.push(root);

    await writeSkill(
      path.join(root, "pptx-swarm"),
      'name: pptx-swarm\ndescription: internal long-deck helper',
    );
    await writeSkill(
      path.join(root, "fertility-assessment"),
      'id: fertility-assessment\ndisplayName: 备孕全景评估\ndescription: legacy public\ncategory: 健康',
    );
    await writeSkill(
      path.join(root, "_internal", "secret-helper"),
      'id: secret-helper\ndisplayName: Secret\ndescription: secret\ncategory: Internal\nvisibility: public',
    );
    await writeSkill(
      path.join(root, "实验", "not-public"),
      'id: not-public\ndisplayName: Not Public\ndescription: missing public gate',
    );
    await writeSkill(
      path.join(root, "实验", "public-skill"),
      'id: public-skill\ndisplayName: Public Skill\ndescription: public\nvisibility: public',
    );

    const manifests = await new SkillScanner().scan([root]);
    const ids = new Set(manifests.map((skill) => skill.id));

    expect(ids).toEqual(new Set(["fertility-assessment", "public-skill"]));
    expect(manifests.find((skill) => skill.id === "public-skill")?.category).toBe("实验");
    expect(ids.has("pptx-swarm")).toBe(false);
    expect(ids.has("secret-helper")).toBe(false);
    expect(ids.has("not-public")).toBe(false);
  });

  it("lets visibility: internal override legacy public-looking metadata", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mira-system-skill-internal-"));
    tempDirs.push(root);

    await writeSkill(
      path.join(root, "internal-looking-public"),
      'id: internal-looking-public\ndisplayName: Internal\ndescription: helper\ncategory: 测试\nvisibility: internal',
    );

    await expect(new SkillScanner().scan([root])).resolves.toEqual([]);
  });

  it("keeps registered built-ins discoverable during flat-layout compatibility", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mira-system-skill-built-in-"));
    tempDirs.push(root);

    await writeSkill(path.join(root, "pptx"), 'name: pptx\ndescription: pptx');
    await writeSkill(path.join(root, "pptx-swarm"), 'name: pptx-swarm\ndescription: helper');

    const manifests = await new SkillScanner().scan([root]);

    expect(manifests.map((skill) => skill.id)).toEqual(["pptx"]);
  });
});