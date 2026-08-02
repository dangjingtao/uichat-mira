import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SkillLoader } from "./loader.js";
import { SkillMatcher } from "./matcher.js";
import { SkillContextProvider } from "./provider.js";
import { SkillRegistry, type SkillScanner } from "./scanner.js";
import type { SkillManifest } from "./types.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

describe("Skill clarification continuation context", () => {
  it("carries the original request, assistant question and latest reply into the resumed Skill body", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mira-skill-continuation-"));
    tempDirs.push(root);
    const skillRoot = path.join(root, "wechat-article-layout");
    await fs.mkdir(skillRoot, { recursive: true });
    await fs.writeFile(
      path.join(skillRoot, "SKILL.md"),
      "---\nname: wechat-article-layout\ndescription: WeChat article layout\n---\n# Rules\nGenerate grounded HTML only after style confirmation.",
      "utf8",
    );

    const manifest: SkillManifest = {
      id: "wechat-article-layout",
      name: "微信公众号文章排版",
      description: "WeChat article layout",
      version: "0.1.0",
      entry: path.join(skillRoot, "SKILL.md"),
    };
    const registry = new SkillRegistry({
      scan: async () => [manifest],
    } as SkillScanner);
    const provider = new SkillContextProvider(
      registry,
      new SkillMatcher(),
      new SkillLoader(),
    );

    const originalRequest =
      "$wechat-article-layout 把工作区里的 article.md 排成公众号 HTML";
    const assistantQuestion =
      "请选择排版风格：terminal-dark、minimal-light、magazine-warm 或 academic-blue？";
    const latestReply = "magazine-warm";
    const context = await provider.prepare({
      query: latestReply,
      messages: [
        { role: "user", content: originalRequest },
        { role: "assistant", content: assistantQuestion },
        { role: "user", content: latestReply },
      ],
    });

    expect(context?.match?.source).toBe("continuation");
    expect(context?.primary?.body).toContain("<skill-task-continuation>");
    expect(context?.primary?.body).toContain(originalRequest);
    expect(context?.primary?.body).toContain(assistantQuestion);
    expect(context?.primary?.body).toContain(latestReply);
    expect(context?.primary?.body).toContain(
      "do not treat the reply as a standalone task",
    );
  });
});
