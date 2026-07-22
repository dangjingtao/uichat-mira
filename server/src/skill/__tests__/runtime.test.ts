import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";
import * as intentMatcherModule from "@/agent/intent/embedding-capability-matcher";
import { prepareContextNode } from "@/agent/nodes/prepare-context";
import type { AgentNodeState } from "@/agent/node-runtime";
import { skillRegistry } from "../registry";
import {
  getActiveSkillRuntimeFrame,
  reduceActiveSkillFromEvidence,
  resolveSkillRuntime,
} from "../runtime";
import { skillInstanceStore } from "../store";
import type { SkillRegistration } from "../types";

const registration: SkillRegistration = {
  definition: {
    id: "test_document_skill",
    version: "1.0.0",
    name: "Test document skill",
    description: "Exercises the Skill Runtime contract.",
    semantics: {
      purpose: "Process one document with a bounded tool set.",
      usageGuidance: "Inspect before changing the document.",
      decisionPolicy: "Choose the next valid document action from evidence.",
      qualityCriteria: "The result must be verified before completion.",
      completionCriteria: ["Document changes have been verified."],
    },
    allowedToolIds: ["read_open", "edit_file"],
  },
  adapter: {
    initialize: () => ({ acceptedToolResults: 0, stage: "inspect" }),
    getRuntimeFrame: ({ instance, definition }) => {
      const state = instance.state as {
        acceptedToolResults: number;
        stage: string;
      };
      return {
        stage: state.stage,
        semanticContext: [
          definition.semantics.purpose,
          definition.semantics.usageGuidance,
          definition.semantics.decisionPolicy,
        ].join("\n"),
        completionCriteria: definition.semantics.completionCriteria,
        qualityCriteria: definition.semantics.qualityCriteria,
        allowedToolIds:
          state.stage === "inspect" ? ["read_open"] : ["edit_file"],
      };
    },
    reduceEvidence: ({ state, evidence }) => {
      const current = state as {
        acceptedToolResults: number;
        stage: string;
      };
      const acceptedToolResults =
        current.acceptedToolResults + evidence.toolExecutions.length;
      return {
        acceptedToolResults,
        stage: acceptedToolResults > 0 ? "edit" : current.stage,
      };
    },
    evaluate: ({ state }) => {
      const current = state as {
        acceptedToolResults: number;
        stage: string;
      };
      return current.acceptedToolResults >= 2
        ? { status: "completed", output: { verified: true } }
        : { status: "running" };
    },
  },
};

const createAgentState = (): AgentNodeState => ({
  runId: "run-skill-1",
  threadId: "thread-1",
  userId: 1,
  goal: {
    id: "goal-1",
    text: "Edit the document",
    successCriteria: ["Document updated"],
    constraints: [],
    riskLevel: "low",
  },
  messages: [],
  params: { skillId: registration.definition.id },
});

beforeEach(() => {
  skillRegistry.clear();
  skillInstanceStore.clear();
  skillRegistry.register(registration);
});

test("explicit skill activation creates a version-bound stateful instance", () => {
  const resolved = resolveSkillRuntime({
    runId: "run-skill-1",
    threadId: "thread-1",
    userId: 1,
    goalText: "Edit the document",
    messages: [],
    params: { skillId: registration.definition.id },
  });

  assert.ok(resolved);
  assert.equal(resolved.instance.status, "running");
  assert.equal(resolved.instance.skillId, "test_document_skill");
  assert.equal(resolved.instance.skillVersion, "1.0.0");
  assert.equal(resolved.frame.stage, "inspect");
  assert.deepEqual(resolved.frame.allowedToolIds, ["read_open"]);
});

test("skill state consumes only newly accepted evidence and completes deterministically", () => {
  resolveSkillRuntime({
    runId: "run-skill-1",
    threadId: "thread-1",
    userId: 1,
    goalText: "Edit the document",
    messages: [],
    params: { skillId: registration.definition.id },
  });

  const first = reduceActiveSkillFromEvidence({
    runId: "run-skill-1",
    evidence: {
      observations: [],
      retrievals: [],
      toolExecutions: [
        {
          toolId: "read_open",
          args: {},
          status: "completed",
          result: { ok: true },
          startedAt: "2026-07-23T00:00:00.000Z",
          finishedAt: "2026-07-23T00:00:01.000Z",
        },
      ],
    },
  });

  assert.equal(first?.status, "running");
  assert.equal(
    (first?.state as { acceptedToolResults: number }).acceptedToolResults,
    1,
  );
  assert.deepEqual(getActiveSkillRuntimeFrame("run-skill-1")?.allowedToolIds, [
    "edit_file",
  ]);

  const repeated = reduceActiveSkillFromEvidence({
    runId: "run-skill-1",
    evidence: {
      observations: [],
      retrievals: [],
      toolExecutions: [
        {
          toolId: "read_open",
          args: {},
          status: "completed",
          result: { ok: true },
          startedAt: "2026-07-23T00:00:00.000Z",
          finishedAt: "2026-07-23T00:00:01.000Z",
        },
      ],
    },
  });
  assert.equal(
    (repeated?.state as { acceptedToolResults: number }).acceptedToolResults,
    1,
  );

  const completed = reduceActiveSkillFromEvidence({
    runId: "run-skill-1",
    evidence: {
      observations: [],
      retrievals: [],
      toolExecutions: [
        {
          toolId: "read_open",
          args: {},
          status: "completed",
          result: { ok: true },
          startedAt: "2026-07-23T00:00:00.000Z",
          finishedAt: "2026-07-23T00:00:01.000Z",
        },
        {
          toolId: "edit_file",
          args: {},
          status: "completed",
          result: { ok: true },
          startedAt: "2026-07-23T00:00:02.000Z",
          finishedAt: "2026-07-23T00:00:03.000Z",
        },
      ],
    },
  });

  assert.equal(completed?.status, "completed");
  assert.deepEqual(completed?.output, { verified: true });
});

test("prepareContextNode intersects Harness exposure with the active Skill tool surface", async () => {
  resolveSkillRuntime({
    runId: "run-skill-1",
    threadId: "thread-1",
    userId: 1,
    goalText: "Edit the document",
    messages: [],
    params: { skillId: registration.definition.id },
  });

  const readOpen = {
    id: "read_open",
    title: "read_open",
    description: "read",
    inputSchema: { type: "object", properties: {} },
    domain: "read",
    source: "internal" as const,
    tags: ["read"],
    capabilities: { sideEffect: "none" as const, requiresApproval: false },
  };
  const webSearch = {
    ...readOpen,
    id: "web_search",
    title: "web_search",
    description: "search",
    domain: "research",
  };
  const matcherSpy = vi
    .spyOn(intentMatcherModule, "matchToolCandidatesByEmbedding")
    .mockResolvedValue({
      query: "Edit the document",
      topCandidates: [],
      toolCandidates: [],
      toolExposure: {
        exposedToolIds: ["read_open", "web_search"],
        exposedDefinitions: [readOpen, webSearch],
        reason: ["test"],
      },
      exposureReasons: ["test"],
    });

  try {
    const patch = await prepareContextNode(createAgentState());
    assert.deepEqual(patch.toolExposure?.exposedTools, ["read_open"]);
    assert.deepEqual(
      patch.toolExposure?.toolMeta.map((tool) => tool.toolId),
      ["read_open"],
    );
  } finally {
    matcherSpy.mockRestore();
  }
});
