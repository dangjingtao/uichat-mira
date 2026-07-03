import { afterEach, describe, expect, it, vi } from "vitest";
import { llmSharedNode } from "./llm.node.js";
import { llmService } from "@/services/llm.service.js";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";

describe("llmSharedNode", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates stream, generate and describe to llmService", async () => {
    const messages: NormalizedChatMessage[] = [{ role: "user", content: "hello" }];
    const streamSpy = vi.spyOn(llmService, "streamText").mockReturnValue((async function* () {
      yield "a";
      yield "b";
    })());
    const generateSpy = vi.spyOn(llmService, "generateText").mockResolvedValue("ab");
    const describeSpy = vi.spyOn(llmService, "describeTextInvocation").mockReturnValue({
      providerCode: "ollama",
      providerLabel: "Ollama",
      protocol: "ollama",
      operation: "chat",
      endpoint: "http://127.0.0.1:11434/api/chat",
      model: "qwen3",
      modelConfigId: "cfg-1",
      params: {},
      request: {
        method: "POST",
        url: "http://127.0.0.1:11434/api/chat",
        body: { model: "qwen3" },
      },
    });

    const deltas: string[] = [];
    for await (const delta of llmSharedNode.streamText({ roleType: "llm", messages })) {
      deltas.push(delta);
    }
    const answer = await llmSharedNode.generateText({ roleType: "llm", messages });
    const invocation = llmSharedNode.describeInvocation({ roleType: "llm", messages });

    expect(deltas).toEqual(["a", "b"]);
    expect(answer).toBe("ab");
    expect(invocation.operation).toBe("chat");
    expect(streamSpy).toHaveBeenCalledWith({
      roleType: "llm",
      requestedProvider: "default",
      messages,
    });
    expect(generateSpy).toHaveBeenCalledWith({
      roleType: "llm",
      requestedProvider: "default",
      messages,
    });
    expect(describeSpy).toHaveBeenCalledWith({
      roleType: "llm",
      requestedProvider: "default",
      messages,
      operation: "chat",
    });
  });

  it("creates a reusable node observation result", () => {
    vi.spyOn(llmService, "describeTextInvocation").mockReturnValue({
      providerCode: "ollama",
      providerLabel: "Ollama",
      protocol: "ollama",
      operation: "chat",
      endpoint: "http://127.0.0.1:11434/api/chat",
      model: "qwen3",
      modelConfigId: "cfg-1",
      params: { temperature: 0.2 },
      request: {
        method: "POST",
        url: "http://127.0.0.1:11434/api/chat",
        body: { model: "qwen3" },
      },
    });

    const result = llmSharedNode.runTextNode({
      roleType: "llm",
      messages: [{ role: "user", content: "hello" }],
      startedAtMs: Date.now() - 10,
      label: "Generate",
      state: { answer: "ok" },
      answer: "ok",
      result: {
        success: true,
        finishReason: "stop",
      },
      context: {
        conversationHistoryCount: 0,
      },
    });

    expect(result.state).toEqual({ answer: "ok" });
    expect(result.observation.label).toBe("Generate");
    expect(result.observation.environment?.model?.model).toBe("qwen3");
    expect(result.observation.environment?.result?.finishReason).toBe("stop");
  });
});
