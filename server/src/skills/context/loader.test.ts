import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SkillLoader } from "./loader.js";
import type { SkillManifest } from "./types.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("SkillLoader resource exposure boundary", () => {
  it("does not disclose nested SKILL.md or reserved internal directories", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mira-skill-loader-"));
    tempDirs.push(root);

    const entry = path.join(root, "SKILL.md");
    await fs.writeFile(entry, "---\nid: demo\n---\n\n# Demo", "utf8");
    await fs.mkdir(path.join(root, "references", "helper"), { recursive: true });
    await fs.mkdir(path.join(root, "references", "_internal"), { recursive: true });
    await fs.mkdir(path.join(root, "scripts"), { recursive: true });
    await fs.writeFile(path.join(root, "references", "guide.md"), "guide", "utf8");
    await fs.writeFile(path.join(root, "references", "DCF_SKILL.md"), "dcf", "utf8");
    await fs.writeFile(path.join(root, "references", "helper", "SKILL.md"), "helper", "utf8");
    await fs.writeFile(path.join(root, "references", "_internal", "secret.md"), "secret", "utf8");
    await fs.writeFile(path.join(root, "scripts", "tool.py"), "print('ok')", "utf8");

    const manifest: SkillManifest = {
      id: "demo",
      name: "Demo",
      description: "Demo",
      version: "1.0.0",
      entry,
    };

    const resources = await new SkillLoader().listResources(manifest);
    const uris = resources.map((resource) => resource.uri).sort();

    expect(uris).toEqual([
      "skill://demo/references/DCF_SKILL.md",
      "skill://demo/references/guide.md",
      "skill://demo/scripts/tool.py",
    ]);
    expect(uris.some((uri) => uri.endsWith("/SKILL.md"))).toBe(false);
    expect(uris.some((uri) => uri.includes("/_internal/"))).toBe(false);
  });
});