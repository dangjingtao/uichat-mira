import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInvocationInputHash } from "@/agent/approval-fingerprint.js";
import type { SkillAgentExecutionInput, SkillAgentToolBinding } from "./types.js";

const mocks = vi.hoisted(() => ({
  promptCalls: 0,
  continueCalls: 0,
  resumedToolResult: undefined as unknown,
}));

vi.mock("@/providers/catalog.js", () => ({
  getProviderDefinition: () => ({ chatAdapter: "openai-compatible" }),
}));

vi.mock("@/services/provider-proxy.service/resolution.js", () => ({
  resolveAgentTaskProvider: () => ({
    providerCode: "test-provider",
    baseUrl: "http://localhost:1234/v1",
    model: "test-model",
    apiKey: "test-key",
    params: {},
  }),
}));

vi.mock("@earendil-works/pi-agent-core", () => {
  const usage = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };

  class Agent {
    state: {
      messages: any[];
      tools: any[];
    };

    constructor(options: any) {
      this.state = {
        messages: structuredClone(options.initialState.messages ?? []),
        tools: options.initialState.tools ?? [],
      };
    }

    async prompt(input: string) {
      mocks.promptCalls += 1;
      const args = { operation: "create", outputPath: "smoke.docx" };
      const toolCallId = "pi-call-1";
      const tool = this.state.tools.find((candidate) => candidate.name === "office_document");
      this.state.messages.push({ role: "user", content: input, timestamp: 1 });
      this.state.messages.push({
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: toolCallId,
            name: "office_document",
            arguments: args,
          },
        ],
        api: "openai-completions",
        provider: "test-provider",
        model: "test-model",
        usage,
        stopReason: "toolUse",
        timestamp: 2,
      });
      const result = await tool.execute(toolCallId, args);
      this.state.messages.push({
        role: "toolResult",
        toolCallId,
        toolName: "office_document",
        content: result.content,
        details: result.details,
        isError: false,
        timestamp: 3,
      });
    }

    async continue() {
      mocks.continueCalls += 1;
      mocks.resumedToolResult = structuredClone(this.state.messages.at(-1));
      this.state.messages.push({
        role: "assistant",
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "completed",
              summary: "document created",
              missingEvidence: [],
              requirements: [],
              recoverable: true,
            }),
          },
        ],
        api: "openai-completions",
        provider: "test-provider",
        model: "test-model",
        usage,
        stopReason: "stop",
        timestamp: 4,
      });
    }
  }

  return { Agent };
});

import { runPiSkillAgent } from "./pi-core.js";

const baseExecution = (): SkillAgentExecutionInput => ({
  goal: "Create smoke.docx",
  skillContext: {
    instruction: "Use the DOCX runtime.",
    primary: {
      id: "docx",
      version: "1.0.0",
      name: "DOCX",
      body: "Create a document with the private runtime.",
    },
    resources: [],
    disclosedResources: [],
  },
  workspaceRoot: "/workspace",
  threadId: "thread-1",
});

describe("runPiSkillAgent exact approval resume", () => {
  beforeEach(() => {
    mocks.promptCalls = 0;
    mocks.continueCalls = 0;
    mocks.resumedToolResult = undefined;
  });

  it("executes the frozen invocation once and continues the saved transcript", async () => {
    let executionCount = 0;
    const binding: SkillAgentToolBinding = {
      id: "office_document",
      label: "Document Runtime",
      description: "Create a DOCX document.",
      inputSchema: { type: "object" },
      execute: async (args) => {
        executionCount += 1;
        const inputHash = createInvocationInputHash(args);
        if (executionCount === 1) {
          return {
            result: { status: "needs_approval" },
            terminate: true,
            requirement: {
              id: `approval:office_document:${inputHash}`,
              kind: "approval",
              description: "approve document creation",
              requiredFor: "office_document",
              toolId: "office_document",
              input: structuredClone(args),
              inputHash,
            },
          };
        }
        return {
          result: { status: "completed", path: "smoke.docx" },
          evidence: { status: "completed", path: "smoke.docx" },
          artifacts: [{ path: "smoke.docx" }],
        };
      },
    };

    const initial = await runPiSkillAgent({
      execution: baseExecution(),
      tools: [binding],
    });

    expect(initial.status).toBe("needs_input");
    expect(initial.checkpoint?.pendingInvocation).toMatchObject({
      toolCallId: "pi-call-1",
      toolId: "office_document",
      input: { operation: "create", outputPath: "smoke.docx" },
    });
    expect(mocks.promptCalls).toBe(1);
    expect(mocks.continueCalls).toBe(0);

    const pending = initial.checkpoint!.pendingInvocation;
    const resumed = await runPiSkillAgent({
      execution: {
        ...baseExecution(),
        checkpoint: initial.checkpoint,
        approvedInvocations: [
          {
            toolId: pending.toolId,
            inputHash: pending.inputHash,
            input: pending.input,
          },
        ],
      },
      tools: [binding],
    });

    expect(resumed.status).toBe("completed");
    expect(resumed.artifacts).toEqual([{ path: "smoke.docx" }]);
    expect(executionCount).toBe(2);
    expect(mocks.promptCalls).toBe(1);
    expect(mocks.continueCalls).toBe(1);
    expect(mocks.resumedToolResult).toMatchObject({
      role: "toolResult",
      toolCallId: "pi-call-1",
      toolName: "office_document",
      isError: false,
    });
    expect(JSON.stringify(mocks.resumedToolResult)).toContain("completed");
    expect(JSON.stringify(mocks.resumedToolResult)).not.toContain("needs_approval");
  });
});
