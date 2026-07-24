import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentNodeState } from "../node-runtime.js";

const mocks = vi.hoisted(() => ({
  runPilot: vi.fn(),
  getProfile: vi.fn(),
}));

vi.mock("@/skills/agent/profiles.js", () => ({
  getSkillAgentExecutionProfile: mocks.getProfile,
}));
vi.mock("@/skills/agent/wenshu-pilot.js", () => ({
  runWenShuPiSkillAgentPilot: mocks.runPilot,
}));

import { forkedSkillAgentNode } from "./forked-skill-agent.js";

const baseState = (): AgentNodeState =>
  ({
    runId: "run-1",
    threadId: "thread-1",
    userId: 1,
    question: "Create a Word report",
    goal: { text: "Create a Word report" },
    workspaceRoot: "/workspace",
    currentTaskFrame: {
      skillContext: {
        primary: {
          id: "docx",
          version: "1.0.0",
          name: "DOCX",
          body: "Create documents safely.",
        },
        resources: [],
        disclosedResources: [],
      },
    },
  }) as AgentNodeState;

describe("forkedSkillAgentNode approval replay scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MIRA_SKILL_AGENT_RUNTIME;
    mocks.getProfile.mockReturnValue({
      skillId: "docx",
      engine: "pi-agent-core",
      mode: "forked",
      allowedHarnessToolIds: [],
      runtimeBindings: [],
    });
    mocks.runPilot.mockResolvedValue({
      status: "completed",
      summary: "done",
      evidence: [{ status: "completed" }],
      artifacts: [],
      trace: { engine: "pi-agent-core", skillId: "docx", toolCalls: [] },
    });
  });

  it("runs a profiled Skill without requiring a runtime environment flag", async () => {
    await forkedSkillAgentNode(baseState());

    expect(mocks.runPilot).toHaveBeenCalledOnce();
  });

  it("passes only the currently frozen exact approval into a replay fork", async () => {
    const state = baseState();
    state.approvedInvocations = [
      {
        toolId: "office_document",
        input: { operation: "create", outputPath: "old.docx" },
        inputHash: "old-hash",
        approvedAt: "2026-07-24T00:00:00.000Z",
        approvalId: "approval-old",
      },
      {
        toolId: "office_document",
        input: { operation: "create", outputPath: "current.docx" },
        inputHash: "current-hash",
        approvedAt: "2026-07-24T00:01:00.000Z",
        approvalId: "approval-current",
      },
    ];
    state.pendingToolCall = {
      toolId: "office_document",
      args: { operation: "create", outputPath: "current.docx" },
      inputHash: "current-hash",
      source: "llm_tool_call",
      origin: "skill_agent",
      skillId: "docx",
      createdAt: "2026-07-24T00:00:30.000Z",
    };

    await forkedSkillAgentNode(state);

    expect(mocks.runPilot).toHaveBeenCalledOnce();
    expect(mocks.runPilot.mock.calls[0]?.[0].approvedInvocations).toEqual([
      {
        toolId: "office_document",
        inputHash: "current-hash",
        input: { operation: "create", outputPath: "current.docx" },
      },
    ]);
  });

  it("does not leak historical approvals into a fresh fork", async () => {
    const state = baseState();
    state.approvedInvocations = [
      {
        toolId: "office_document",
        input: { operation: "create", outputPath: "old.docx" },
        inputHash: "old-hash",
        approvedAt: "2026-07-24T00:00:00.000Z",
        approvalId: "approval-old",
      },
    ];

    await forkedSkillAgentNode(state);

    expect(mocks.runPilot.mock.calls[0]?.[0].approvedInvocations).toEqual([]);
  });
});