import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { fertilityAssessmentRuntime } from "../fertility-assessment/runtime.js";
import {
  buildSkillFlowRequestContextMessages,
  readSkillDeliveryFromRequestContext,
  readSkillDirectiveFromRequestContext,
} from "./context.js";
import {
  getSkillFlowSession,
  saveSkillFlowSession,
} from "./state-store.js";
import type { StoredSkillFlowSession } from "./types.js";

const tempDirs: string[] = [];
const originalStateRoot = process.env.MIRA_SKILL_FLOW_STATE_ROOT;

afterEach(async () => {
  if (originalStateRoot === undefined) delete process.env.MIRA_SKILL_FLOW_STATE_ROOT;
  else process.env.MIRA_SKILL_FLOW_STATE_ROOT = originalStateRoot;
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

const createSession = (): StoredSkillFlowSession => ({
  sessionId: "session-1",
  threadId: "thread-1",
  userId: 1,
  skillId: "fertility-assessment",
  skillVersion: "1.0.0",
  status: "collecting",
  round: 0,
  maxRounds: 10,
  state: fertilityAssessmentRuntime.createInitialState(),
  processedMessageIds: [],
  createdAt: "2026-07-23T00:00:00.000Z",
  updatedAt: "2026-07-23T00:00:00.000Z",
});

describe("Skill conversation flow", () => {
  it("keeps Planner directive compact while keeping delivery internal", () => {
    const messages = buildSkillFlowRequestContextMessages({
      skillId: "fertility-report",
      sessionId: "session-1",
      phase: "ready",
      flowCompleted: true,
      stateRef: "skill-flow:session-1",
      delivery: {
        kind: "markdown",
        content: "# report\nprivate rendered body",
      },
    });

    const directive = readSkillDirectiveFromRequestContext(messages);
    const delivery = readSkillDeliveryFromRequestContext(messages);

    expect(directive).toMatchObject({
      skillId: "fertility-report",
      phase: "ready",
      flowCompleted: true,
    });
    expect(directive).not.toHaveProperty("delivery");
    expect(delivery).toEqual({
      kind: "markdown",
      content: "# report\nprivate rendered body",
    });
  });

  it("starts an activation-only fertility request with a natural first question", async () => {
    const session = createSession();
    const result = await fertilityAssessmentRuntime.processTurn({
      session,
      threadId: session.threadId,
      userId: session.userId,
      userMessageId: "message-1",
      query: "帮我做一个备孕评估报告",
      messages: [
        {
          id: "message-1",
          role: "user",
          content: "帮我做一个备孕评估报告",
          parts: [],
        },
      ],
    });

    expect(result.directive).toMatchObject({
      skillId: "fertility-assessment",
      phase: "collecting",
      flowCompleted: false,
      round: 0,
      maxRounds: 10,
      requiredAction: "ask_user",
    });
    expect(result.directive.question).toContain("记得多少说多少");
    expect(result.session.round).toBe(0);
  });

  it("persists and replaces one thread flow state without duplicating files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mira-skill-flow-"));
    tempDirs.push(root);
    process.env.MIRA_SKILL_FLOW_STATE_ROOT = root;

    const first = createSession();
    await saveSkillFlowSession(first);
    await saveSkillFlowSession({
      ...first,
      round: 2,
      updatedAt: "2026-07-23T01:00:00.000Z",
    });

    const loaded = await getSkillFlowSession({
      threadId: first.threadId,
      userId: first.userId,
    });
    const files = await fs.readdir(root);

    expect(loaded?.round).toBe(2);
    expect(files.filter((file) => file.endsWith(".json"))).toHaveLength(1);
    expect(files.filter((file) => file.endsWith(".tmp"))).toHaveLength(0);
  });
});
