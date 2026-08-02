import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { materializeSkillScriptResource } from "./subagent-runtime.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

describe("Skill script resource materialization", () => {
  it("writes the bundled script into governed workspace staging and returns a short relative path", async () => {
    const workspaceRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "mira-skill-script-"),
    );
    tempDirs.push(workspaceRoot);
    const content = "#!/usr/bin/env python3\nprint('wechat smoke')\n";

    const workspacePath = await materializeSkillScriptResource({
      skillId: "wechat-article-layout",
      uri: "skill://wechat-article-layout/scripts/build_wechat_html.py",
      content,
      workspaceRoot,
    });

    expect(workspacePath).toBe(
      ".mira/staging/skill-resources/wechat-article-layout/scripts/build_wechat_html.py",
    );
    expect(workspacePath.length).toBeLessThan(128);
    await expect(
      fs.readFile(path.join(workspaceRoot, ...workspacePath.split("/")), "utf8"),
    ).resolves.toBe(content);
  });

  it("overwrites the same managed path instead of creating repeated copies", async () => {
    const workspaceRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "mira-skill-script-"),
    );
    tempDirs.push(workspaceRoot);
    const input = {
      skillId: "wechat-article-layout",
      uri: "skill://wechat-article-layout/scripts/build_wechat_html.py",
      workspaceRoot,
    };

    const firstPath = await materializeSkillScriptResource({
      ...input,
      content: "print('first')\n",
    });
    const secondPath = await materializeSkillScriptResource({
      ...input,
      content: "print('second')\n",
    });

    expect(secondPath).toBe(firstPath);
    await expect(
      fs.readFile(path.join(workspaceRoot, ...secondPath.split("/")), "utf8"),
    ).resolves.toBe("print('second')\n");
  });

  it("rejects a script URI owned by another Skill", async () => {
    const workspaceRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "mira-skill-script-"),
    );
    tempDirs.push(workspaceRoot);

    await expect(
      materializeSkillScriptResource({
        skillId: "wechat-article-layout",
        uri: "skill://other-skill/scripts/build_wechat_html.py",
        content: "print('no')\n",
        workspaceRoot,
      }),
    ).rejects.toThrow("must belong to active Skill");
  });
});
