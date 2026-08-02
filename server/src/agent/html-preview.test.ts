import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveSkillReportHtmlPath } from "@/skills/flow/report-files.js";
import { prepareAgentHtmlPreview } from "./html-preview.js";
import { agentRunStore } from "./run-store.js";

const tempDirs: string[] = [];
const originalStateRoot = process.env.MIRA_SKILL_FLOW_STATE_ROOT;

afterEach(async () => {
  agentRunStore.clear();
  if (originalStateRoot) {
    process.env.MIRA_SKILL_FLOW_STATE_ROOT = originalStateRoot;
  } else {
    delete process.env.MIRA_SKILL_FLOW_STATE_ROOT;
  }
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

const createWechatRun = async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mira-wechat-preview-"));
  const stateRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mira-skill-report-"));
  tempDirs.push(workspaceRoot, stateRoot);
  process.env.MIRA_SKILL_FLOW_STATE_ROOT = stateRoot;

  const run = agentRunStore.create({
    threadId: "thread-wechat-preview",
    userId: 1,
    goal: {
      id: "goal-wechat-preview",
      text: "排版公众号文章",
      successCriteria: ["生成 HTML"],
      constraints: [],
      riskLevel: "low",
    },
    runtimeInput: {
      messages: [{ role: "user", content: "排版公众号文章" }],
      workspaceRoot,
    },
  });
  agentRunStore.addObservation(run.id, {
    id: "observation-wechat-preview",
    runId: run.id,
    stepId: "subagent:wechat-article-layout",
    status: "ok",
    facts: ["subAgent status: completed"],
    summary: {
      source: "observation",
      status: "completed",
      actionTaken: "Delegated wechat-article-layout Skill to one subAgent",
      keyFindings: ["HTML generated"],
      data: {
        kind: "generic_structured",
        preview: {
          skillId: "wechat-article-layout",
          status: "completed",
        },
        truncated: false,
        redacted: false,
        unsupported: false,
      },
    },
    createdAt: "2026-08-03T06:00:00.000Z",
  });

  return { run, workspaceRoot };
};

describe("prepareAgentHtmlPreview", () => {
  it("copies the stable WeChat HTML output and appends one preview marker", async () => {
    const { run, workspaceRoot } = await createWechatRun();
    const html = "<section><p>公众号预览</p></section>";
    await fs.writeFile(path.join(workspaceRoot, "article-wechat.html"), html, "utf8");

    const first = prepareAgentHtmlPreview({
      content: "排版完成。",
      metadata: {
        agent: { status: "completed", runId: run.id },
      },
    });
    const second = prepareAgentHtmlPreview({
      content: first,
      metadata: {
        agent: { status: "completed", runId: run.id },
      },
    });

    expect(first).toContain(
      `<!--mira-skill-report:${run.id}:html:wechat-article-layout-->`,
    );
    expect(second).toBe(first);
    await expect(fs.readFile(resolveSkillReportHtmlPath(run.id), "utf8")).resolves.toBe(
      html,
    );
  });

  it("leaves ordinary completed Agent messages unchanged", async () => {
    const { run } = await createWechatRun();
    agentRunStore.update(run.id, { observations: [] });

    expect(
      prepareAgentHtmlPreview({
        content: "普通回答",
        metadata: {
          agent: { status: "completed", runId: run.id },
        },
      }),
    ).toBe("普通回答");
  });
});
