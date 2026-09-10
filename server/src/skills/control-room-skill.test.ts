import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SkillLoader } from "./context/loader.js";
import { SkillMatcher } from "./context/matcher.js";
import { SkillScanner } from "./context/scanner.js";

const skillsRoot = path.dirname(fileURLToPath(import.meta.url));

const CONTROL_ROOM_TOOLS = [
  "mcp:mira-control-room:tool:get_overview",
  "mcp:mira-control-room:tool:inspect_engineering",
  "mcp:mira-control-room:tool:inspect_runtime",
  "mcp:mira-control-room:tool:inspect_governance",
];

const loadControlRoomManifest = async () => {
  const manifests = await new SkillScanner().scan([skillsRoot]);
  const manifest = manifests.find((candidate) => candidate.id === "control-room");
  expect(manifest).toBeDefined();
  return manifest!;
};

describe("Control Room canonical Skill", () => {
  it("discovers the public operational skill with the bounded MCP tool surface", async () => {
    const manifest = await loadControlRoomManifest();

    expect(manifest).toMatchObject({
      id: "control-room",
      name: "Mira Control Room 运行观察",
      version: "0.1.0",
      source: "Mira Lab",
      category: "operations",
      execution: {
        context: "fork",
        agent: "subAgent",
        allowedTools: CONTROL_ROOM_TOOLS,
        runtimeBindings: [],
        workspaceBound: false,
      },
    });
    expect(manifest.description).toContain("Mira 组织整体运行");
    expect(manifest.entry.replaceAll("\\", "/")).toContain(
      "/skills/operations/control-room/SKILL.md",
    );
  });

  it("keeps Control Room as an observation skill instead of a second data plane", async () => {
    const manifest = await loadControlRoomManifest();
    const content = await new SkillLoader().loadContent(manifest);

    expect(content.body).toContain("最小的 Control Room MCP 能力");
    expect(content.body).toContain("不要一上来调用 `get_overview`");
    expect(content.body).toContain("`connected` 不等于“一切健康”");
    expect(content.body).toContain("`null`、缺字段和 `unknown` 不是 `false`");
    expect(content.body).toContain("最新默认分支 workflow run");
    expect(content.body).toContain("Project 是组织视图，不替代 Issue 作为工程事实 SSOT");
    expect(content.body).toContain("不是修复能力");
    expect(content.body).toContain("30 requests / 60 seconds / source IP");
  });

  it("matches organization-level Mira observability questions", async () => {
    const manifest = await loadControlRoomManifest();
    const matcher = new SkillMatcher();

    expect(
      matcher.match({
        query: "看看 Control Room，现在整体正常吗？",
        messages: [],
        manifests: [manifest],
      }).primary,
    ).toMatchObject({ skillId: "control-room", source: "exact" });

    expect(
      matcher.match({
        query: "Mira 组织现在有什么运行异常？",
        messages: [],
        manifests: [manifest],
      }).primary,
    ).toMatchObject({ skillId: "control-room", source: "exact" });

    expect(
      matcher.match({
        query: "Mira 哪些仓库构建失败了？",
        messages: [],
        manifests: [manifest],
      }).primary,
    ).toMatchObject({ skillId: "control-room", source: "exact" });
  });

  it("does not steal a concrete repository repair task", async () => {
    const manifest = await loadControlRoomManifest();
    const matcher = new SkillMatcher();

    expect(
      matcher.match({
        query: "这个仓库构建失败了，帮我修好并提 PR",
        messages: [],
        manifests: [manifest],
      }),
    ).toEqual({ primary: null, secondary: [] });
  });
});
