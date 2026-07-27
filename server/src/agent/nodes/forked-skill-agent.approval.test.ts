import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentNodeState } from "../node-runtime.js";
import type { SkillAgentCheckpoint } from "@/skills/agent/types.js";

const mocks = vi.hoisted(() => ({
  runPilot: vi.fn(),
  getProfile: vi.fn(),
}));

vi.mock("@/skills/agent/profiles.js", () => ({
  getSkillAgentExecutionProfile: mocks.getProfile,
  resolveSubAgentExecutionProfile: mocks.getProfile,
}));
vi.mock("@/skills/agent/wenshu-pilot.js", () => ({
  runWenShuPiSkillAgentPilot: mocks.runPilot,
}));
vi.mock("@/skills/agent/subagent-runtime.js", () => ({
  runSubAgent: mocks.runPilot,
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

const checkpoint = (): SkillAgentCheckpoint => ({
  version: 1,
  messages: [
    {
      role: "user",
      content: "Create a Word report",
      timestamp: 1,
    },
    {
      role: "assistant",
      content: [
        {
          type: "toolCall",
          id: "call-current",
          name: "office_document",
          arguments: { operation: "create", outputPath: "current.docx" },
        },
      ],
      api: "openai-completions",
      provider: "test",
      model: "test",
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "toolUse",
      timestamp: 2,
    },
    {
      role: "toolResult",
      toolCallId: "call-current",
      toolName: "office_document",
      content: [{ type: "text", text: "needs approval" }],
      isError: false,
      timestamp: 3,
    },
  ],
  pendingInvocation: {
    toolCallId: "call-current",
    toolId: "office_document",
    input: { operation: "create", outputPath: "current.docx" },
    inputHash: "current-hash",
  },
  evidence: [],
  artifacts: [],
  toolCalls: ["office_document"],
});

describe("forkedSkillAgentNode approval replay scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MIRA_SKILL_AGENT_RUNTIME;
    mocks.getProfile.mockReturnValue({
      skillId: "docx",
      engine: "pi-agent-core",
      mode: "forked-agent",
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

  it("persists the exact Pi checkpoint on the Parent approval boundary", async () => {
    const frozenCheckpoint = checkpoint();
    mocks.runPilot.mockResolvedValueOnce({
      status: "needs_input",
      summary: "approval required",
      evidence: [],
      artifacts: [],
      requirements: [
        {
          id: "approval:office_document:current-hash",
          kind: "approval",
          description: "approve document creation",
          requiredFor: "office_document",
          toolId: "office_document",
          toolCallId: "call-current",
          input: { operation: "create", outputPath: "current.docx" },
          inputHash: "current-hash",
        },
      ],
      checkpoint: frozenCheckpoint,
      trace: {
        engine: "pi-agent-core",
        skillId: "docx",
        toolCalls: ["office_document"],
      },
    });

    const patch = await forkedSkillAgentNode(baseState());

    expect(patch.pendingApproval?.toolCallId).toBe("call-current");
    expect(patch.pendingToolCall).toMatchObject({
      id: "call-current",
      toolId: "office_document",
      inputHash: "current-hash",
      origin: "skill_agent",
      skillId: "docx",
      skillAgentCheckpoint: frozenCheckpoint,
    });
  });

  it("passes only the current exact approval and checkpoint into resume", async () => {
    const state = baseState();
    const frozenCheckpoint = checkpoint();
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
      id: "call-current",
      toolId: "office_document",
      args: { operation: "create", outputPath: "current.docx" },
      inputHash: "current-hash",
      source: "llm_tool_call",
      origin: "skill_agent",
      skillId: "docx",
      skillAgentCheckpoint: frozenCheckpoint,
      createdAt: "2026-07-24T00:00:30.000Z",
    } as AgentNodeState["pendingToolCall"];

    await forkedSkillAgentNode(state);

    expect(mocks.runPilot).toHaveBeenCalledOnce();
    expect(mocks.runPilot.mock.calls[0]?.[0]).toMatchObject({
      approvedInvocations: [
        {
          toolId: "office_document",
          inputHash: "current-hash",
          input: { operation: "create", outputPath: "current.docx" },
        },
      ],
      checkpoint: frozenCheckpoint,
    });
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
    expect(mocks.runPilot.mock.calls[0]?.[0].checkpoint).toBeUndefined();
  });
});
