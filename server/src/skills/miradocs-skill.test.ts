import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SkillLoader } from "./context/loader.js";
import { SkillMatcher } from "./context/matcher.js";
import { SkillScanner } from "./context/scanner.js";

const skillsRoot = path.dirname(fileURLToPath(import.meta.url));

const loadMiraDocsManifest = async () => {
  const manifests = await new SkillScanner().scan([skillsRoot]);
  const manifest = manifests.find((candidate) => candidate.id === "miradocs");
  expect(manifest).toBeDefined();
  return manifest!;
};

describe("MiraDocs canonical Skill", () => {
  it("discovers one public Skill for site creation, content publishing, and maintenance", async () => {
    const manifest = await loadMiraDocsManifest();

    expect(manifest).toMatchObject({
      id: "miradocs",
      name: "MiraDocs 建站与内容发布",
      version: "0.1.0",
      source: "Mira Lab",
      category: "工程研发",
    });
    expect(manifest.description).toContain("创建 MiraDocs 站点");
    expect(manifest.description).toContain("发布博客或文档");
    expect(manifest.description).toContain("维护已有站点");
    expect(manifest.entry.replaceAll("\\", "/")).toContain(
      "/skills/development/miradocs/SKILL.md",
    );
  });

  it("loads only the three workflow references plus the shared draft and examples", async () => {
    const manifest = await loadMiraDocsManifest();
    const loader = new SkillLoader();
    const content = await loader.loadContent(manifest);
    const resources = await loader.listResources(manifest);

    expect(content.body).toContain("一个 Skill，三个操作");
    expect(content.body).toContain("它不是 Tool，不注册能力");
    expect(content.body).toContain("V1 只做创建站点、发布博客或文档、维护已有站点");
    expect(content.body).toContain("不加入项目、里程碑、任务、决策或风险产品模型");
    expect(content.body).toContain("不修改 Main Agent、Planner、Agent Graph、Harness 审批或 C contract");
    expect(resources.map((resource) => resource.uri).sort()).toEqual([
      "skill://miradocs/examples/conversations.md",
      "skill://miradocs/references/create-site.md",
      "skill://miradocs/references/maintain-site.md",
      "skill://miradocs/references/publish-content.md",
      "skill://miradocs/templates/site-draft.md",
    ]);
  });

  it("matches MiraDocs product names and the three user operations", async () => {
    const manifest = await loadMiraDocsManifest();
    const matcher = new SkillMatcher();

    expect(
      matcher.match({
        query: "帮我建一个 MiraDocs 文档站",
        messages: [],
        manifests: [manifest],
      }).primary,
    ).toMatchObject({
      skillId: "miradocs",
      source: "exact",
      score: 0.97,
    });

    expect(
      matcher.match({
        query: "把这篇文章发成博客",
        messages: [],
        manifests: [manifest],
      }).primary,
    ).toMatchObject({
      skillId: "miradocs",
      source: "exact",
      score: 0.88,
    });

    expect(
      matcher.match({
        query: "这个文档站构建失败了，帮我诊断修复",
        messages: [],
        manifests: [manifest],
      }).primary,
    ).toMatchObject({
      skillId: "miradocs",
      source: "exact",
      score: 0.84,
    });

    expect(
      matcher.match({
        query: "帮我建个网站",
        messages: [],
        manifests: [manifest],
      }).primary,
    ).toMatchObject({
      skillId: "miradocs",
      source: "semantic",
      score: 0.68,
    });
  });
});
