import { beforeEach, describe, expect, it } from "vitest";
import { agentRunStore } from "@/agent/run-store";
import {
  clearSkillRegistryForTests,
  registerSkill,
} from "./registry";
import {
  cancelSkillForRun,
  clearSkillRuntimeForTests,
  ensureSkillResolvedForRun,
  getActiveSkillInstanceForRun,
  getActiveSkillRuntimeFrameForRun,
  getLatestSkillInstanceForRun,
  reduceSkillAfterAcceptedEvidence,
  resumeSkillForRun,
} from "./runtime";
import type { SkillRegistration } from "./types";

type TestState = {
  stage: "inspect" | "edit" | "done";
  evidenceCount: number;
};

type TestInput = {
  target: string;
};

const createRegistration = (): SkillRegistration<
  TestState,
  TestInput,
  { artifact: string }
> => ({
  definition: {
    id: "test_document_skill",
    version: "1.0.0",
    name: "Test Document Skill",
    description: "Test-only stateful document skill.",
    allowedToolIds: ["read_open", "edit_file"],
    semantics: {
      purpose: "Inspect and edit one document.",
      usageGuidance: "Use document evidence before editing.",
      decisionPolicy: "Inspect first, then edit, then verify completion.",
      qualityCriteria: "The requested document change is evidenced.",
      completionCriteria: ["The target document change is complete."],
    },
  },
  match: ({ goalText }) => (goalText.includes("document") ? 0.9 : 0),
  createInput: () => ({ target: "README.md" }),
  adapter: {
    initialize: () => ({ stage: "inspect", evidenceCount: 0 }),
    getRuntimeFrame: (state) => ({
      stage: state.stage,
      allowedToolIds:
        state.stage === "inspect"
          ? ["read_open"]
          : state.stage === "edit"
            ? ["edit_file"]
            : [],
      semanticContext: `Current stage: ${state.stage}`,
    }),
    reduceEvidence: (state) => ({
      evidenceCount: state.evidenceCount + 1,
      stage:
        state.stage === "inspect"
          ? "edit"
          : state.stage === "edit"
            ? "done"
            : "done",
    }),
    evaluate: (state) =>
      state.stage === "done"
        ? { status: "completed", output: { artifact: "out.docx" } }
        : { status: "running" },
  },
});

describe("Skill Runtime", () => {
  beforeEach(() => {
    clearSkillRegistryForTests();
    clearSkillRuntimeForTests();
    agentRunStore.clear();
  });

  it("resolves a matching skill and narrows tools by stage", async () => {
    registerSkill(createRegistration());
    const instance = await ensureSkillResolvedForRun({
      runId: "run-1",
      goalText: "edit this document",
    });

    expect(instance?.status).toBe("running");
    expect(instance?.stage).toBe("inspect");
    expect(getActiveSkillRuntimeFrameForRun("run-1")?.allowedToolIds).toEqual([
      "read_open",
    ]);
  });

  it("reduces only accepted evidence and completes through checkpoints", async () => {
    registerSkill(createRegistration());
    await ensureSkillResolvedForRun({
      runId: "run-2",
      goalText: "edit this document",
    });

    const afterInspect = await reduceSkillAfterAcceptedEvidence({
      runId: "run-2",
      evidence: { evidence: { toolExecutions: [{ toolId: "read_open" }] } },
    });
    expect(afterInspect?.status).toBe("running");
    expect(afterInspect?.stage).toBe("edit");
    expect(afterInspect?.checkpoint.sequence).toBe(1);
    expect(getActiveSkillRuntimeFrameForRun("run-2")?.allowedToolIds).toEqual([
      "edit_file",
    ]);

    const completed = await reduceSkillAfterAcceptedEvidence({
      runId: "run-2",
      evidence: { evidence: { toolExecutions: [{ toolId: "edit_file" }] } },
    });
    expect(completed?.status).toBe("completed");
    expect(completed?.checkpoint.sequence).toBe(2);
    expect(completed?.output).toEqual({ artifact: "out.docx" });
    expect(getActiveSkillInstanceForRun("run-2")).toBeUndefined();
    expect(getLatestSkillInstanceForRun("run-2")?.status).toBe("completed");
  });

  it("supports explicit activation and persists the binding through AgentRun runtimeInput", async () => {
    registerSkill({
      ...createRegistration(),
      match: undefined,
    });
    const run = agentRunStore.create({
      threadId: "thread-1",
      userId: 1,
      goal: {
        id: "goal-1",
        text: "explicit skill test",
        successCriteria: [],
        constraints: [],
        riskLevel: "low",
      },
      runtimeInput: {
        messages: [],
        params: {
          skillId: "test_document_skill",
        },
      },
    });

    await ensureSkillResolvedForRun({
      runId: run.id,
      goalText: run.goal.text,
      params: run.runtimeInput?.params,
    });
    expect(getActiveSkillInstanceForRun(run.id)?.skillId).toBe(
      "test_document_skill",
    );

    clearSkillRuntimeForTests();
    expect(getActiveSkillInstanceForRun(run.id)?.skillId).toBe(
      "test_document_skill",
    );
  });

  it("supports waiting, resume, and cancel lifecycle operations", async () => {
    const registration = createRegistration();
    registerSkill({
      ...registration,
      adapter: {
        ...registration.adapter,
        evaluate: () => ({ status: "waiting", reason: "Need user input" }),
      },
    });
    await ensureSkillResolvedForRun({
      runId: "run-3",
      goalText: "edit this document",
    });
    await reduceSkillAfterAcceptedEvidence({
      runId: "run-3",
      evidence: { evidence: {} },
    });

    expect(getActiveSkillInstanceForRun("run-3")?.status).toBe("waiting");
    expect(getActiveSkillRuntimeFrameForRun("run-3")?.allowedToolIds).toEqual([]);
    expect(resumeSkillForRun("run-3")?.status).toBe("running");
    expect(cancelSkillForRun("run-3")?.status).toBe("cancelled");
    expect(getActiveSkillInstanceForRun("run-3")).toBeUndefined();
  });
});
