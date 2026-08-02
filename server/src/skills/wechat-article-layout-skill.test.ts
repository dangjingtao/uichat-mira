import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SkillLoader } from "./context/loader.js";
import { SkillContextProvider } from "./context/provider.js";
import { SkillRegistry, SkillScanner } from "./context/scanner.js";

const skillsRoot = path.dirname(fileURLToPath(import.meta.url));

const loadManifest = async () => {
  const manifests = await new SkillScanner().scan([skillsRoot]);
  const manifest = manifests.find(
    (candidate) => candidate.id === "wechat-article-layout",
  );
  expect(manifest).toBeDefined();
  return manifest!;
};

describe("WeChat article layout Skill", () => {
  it("discovers as a built-in fork Skill using the governed terminal", async () => {
    const manifest = await loadManifest();

    expect(manifest).toMatchObject({
      id: "wechat-article-layout",
      name: "微信公众号文章排版",
      version: "0.1.0",
      source: "Mira Lab",
      origin: "built-in",
      execution: {
        context: "fork",
        agent: "subAgent",
        allowedTools: ["read_open", "terminal_session"],
        runtimeBindings: [],
        workspaceBound: true,
      },
    });
  });

  it("ships the generator and dark-mode reference as progressively disclosed resources", async () => {
    const manifest = await loadManifest();
    const loader = new SkillLoader();
    const resources = await loader.listResources(manifest);

    expect(resources.map((resource) => resource.uri).sort()).toEqual([
      "skill://wechat-article-layout/references/dark-mode-mapping.md",
      "skill://wechat-article-layout/scripts/build_wechat_html.py",
    ]);
  });

  it("keeps natural Chinese style clarification and terminal execution inside the Skill contract", async () => {
    const manifest = await loadManifest();
    const registry = new SkillRegistry({
      scan: async () => [manifest],
    } as SkillScanner);
    const provider = new SkillContextProvider(registry);
    const context = await provider.prepare({
      query: "$wechat-article-layout 帮我把这篇文章排成公众号可粘贴 HTML",
      messages: [
        {
          role: "user",
          content: "$wechat-article-layout 帮我把这篇文章排成公众号可粘贴 HTML",
        },
      ],
    });

    expect(context?.primary?.id).toBe("wechat-article-layout");
    expect(context?.primary?.body).toContain("唯一必问项");
    expect(context?.primary?.body).toContain(
      "请选择排版风格：终端暗黑、清爽简约、杂志暖调、学术规整",
    );
    expect(context?.primary?.body).toContain("杂志暖调");
    expect(context?.primary?.body).toContain("`magazine-warm`");
    expect(context?.primary?.body).toContain("不要要求用户输入内部英文枚举");
    expect(context?.primary?.body).toContain("terminal_session");
    expect(context?.primary?.body).toContain("不注册专用 Runtime");
  });

  it("uses only Python standard-library imports", async () => {
    const manifest = await loadManifest();
    const loader = new SkillLoader();
    const resources = await loader.listResources(manifest);
    const scriptResource = resources.find(
      (resource) => resource.uri.endsWith("/scripts/build_wechat_html.py"),
    );
    expect(scriptResource).toBeDefined();

    const script = await loader.loadResource({
      manifest,
      resource: scriptResource!,
    });
    const imports = [...script.content.matchAll(/^import\s+([a-zA-Z0-9_]+)/gm)].map(
      (match) => match[1],
    );

    expect(imports).toEqual(["argparse", "os", "re"]);
    expect(script.content).not.toMatch(/\b(?:requests|bs4|PIL|markdown|mistune)\b/);
    expect(script.content).not.toContain("pip install");
  });
});
