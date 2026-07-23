import { afterEach, describe, expect, it, vi } from "vitest";
import type { McpInvocationContext } from "../core/definitions.js";
import { executeHarnessInvocation } from "@/harness/invocations.js";
import { registerCapability, unregisterCapability } from "@/harness/registry.js";
import {
  attachHarnessLlmContentToExecution,
} from "@/agent/nodes/harness-tool-result.js";
import {
  createToolExecutionEvidenceSummary,
} from "@/agent/evidence.js";
import type { AgentToolExecutionResult } from "@/agent/types.js";
import {
  askExternalExpertTool,
  createAskExternalExpertTool,
} from "./ask-external-expert.tool.js";

const context = (args: Record<string, unknown>): McpInvocationContext => ({
  invocationId: "invocation-external-expert",
  args,
  userId: 7,
  signal: new AbortController().signal,
  pushEvent: vi.fn(),
  addArtifact: vi.fn(),
  trace: {
    startSpan: vi.fn(() => ({ spanId: "span-external-expert", end: vi.fn() })),
  },
});

afterEach(() => {
  unregisterCapability(askExternalExpertTool.definition.id);
});

describe("ask_external_expert", () => {
  it("returns only the high-level provider conversation contract", async () => {
    const ask = vi.fn().mockResolvedValue({
      answer: "建议先验证数据来源。",
      provider: "chatgpt",
      conversationId: "conversation-1",
      status: "completed",
      latencyMs: 123,
    });
    const tool = createAskExternalExpertTool({ ask });

    const output = await tool.execute(context({
      action: "ask",
      provider: "chatgpt",
      question: "请给建议。",
      conversation: "new",
    }));

    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        action: "ask",
        provider: "chatgpt",
        question: "请给建议。",
        conversation: "new",
      }),
    );
    expect(output).toEqual({
      result: {
        answer: "建议先验证数据来源。",
        provider: "chatgpt",
        conversationId: "conversation-1",
        status: "completed",
        latencyMs: 123,
      },
      evidence: expect.objectContaining({
        facts: expect.arrayContaining([
          "tool=ask_external_expert",
          "provider=chatgpt",
          "conversationId=conversation-1",
        ]),
        data: expect.objectContaining({ answer: "建议先验证数据来源。" }),
      }),
    });
  });

  it("passes the provider result through Harness and into Agent Evidence", async () => {
    const tool = createAskExternalExpertTool({
      ask: vi.fn().mockResolvedValue({
        answer: "外部专家回复。",
        provider: "chatgpt",
        conversationId: "conversation-2",
        status: "completed",
        latencyMs: 88,
      }),
    });
    registerCapability(tool);

    const invocation = await executeHarnessInvocation({
      toolId: "ask_external_expert",
      args: {
        action: "ask",
        provider: "chatgpt",
        question: "问题",
      },
      userId: 7,
    });

    expect(invocation.status).toBe("completed");
    expect(invocation.result).toEqual(
      expect.objectContaining({
        answer: "外部专家回复。",
        conversationId: "conversation-2",
      }),
    );
    expect(invocation.evidence?.data).toEqual(
      expect.objectContaining({ answer: "外部专家回复。" }),
    );

    const execution: AgentToolExecutionResult = {
      toolId: invocation.toolId,
      args: invocation.args,
      invocationId: invocation.id,
      status: "completed",
      result: invocation.result,
      evidence: invocation.evidence,
      startedAt: invocation.startedAt!,
      finishedAt: invocation.finishedAt!,
    };
    const evidence = createToolExecutionEvidenceSummary({
      execution: attachHarnessLlmContentToExecution(execution)!,
      evidenceIndex: 0,
    });
    expect(evidence.data).toEqual(
      expect.objectContaining({
        answer: "外部专家回复。",
        provider: "chatgpt",
      }),
    );
    expect(evidence.facts).toEqual(
      expect.arrayContaining(["tool=ask_external_expert", "status=completed"]),
    );
  });
});
