import assert from "node:assert/strict";
import { test } from "vitest";
import { collectLlmText, createLlmService } from "./llm.service.js";
import type { ProviderResolution } from "@/services/provider-proxy.service/types.js";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";

test("collectLlmText concatenates streamed deltas without trimming", async () => {
  const output = await collectLlmText(
    (async function* () {
      yield " hello";
      yield " world ";
    })(),
  );

  assert.equal(output, " hello world ");
});

test("createLlmService streams and describes with merged params", async () => {
  const messages: NormalizedChatMessage[] = [{ role: "user", content: "ping" }];
  const resolvedBase: ProviderResolution = {
    providerCode: "ollama",
    baseUrl: "http://127.0.0.1:11434",
    apiKey: "",
    model: "qwen3",
    modelConfigId: "cfg-1",
    params: {
      temperature: 0.7,
      think: false,
    },
  };

  let resolvedFromStream: ProviderResolution | null = null;
  let resolvedFromDescribe: ProviderResolution | null = null;

  const service = createLlmService({
    resolveProviderForRole: () => resolvedBase,
    streamResolvedChat: async function* (resolved, streamMessages) {
      resolvedFromStream = resolved;
      assert.deepEqual(streamMessages, messages);
      yield "a";
      yield "b";
    },
    describeResolvedChatInvocation: (resolved, describeMessages, operation) => {
      resolvedFromDescribe = resolved;
      assert.deepEqual(describeMessages, messages);
      assert.equal(operation, "chat");
      return {
        providerCode: resolved.providerCode,
        providerLabel: "Ollama",
        protocol: "ollama",
        operation,
        endpoint: `${resolved.baseUrl}/api/chat`,
        model: resolved.model,
        modelConfigId: resolved.modelConfigId,
        params: resolved.params,
        request: {
          method: "POST",
          url: `${resolved.baseUrl}/api/chat`,
          body: {
            model: resolved.model,
          },
        },
      };
    },
  });

  const text = await service.generateText({
    roleType: "llm",
    requestedProvider: "default",
    messages,
    params: {
      temperature: 0.2,
      maxTokens: 128,
    },
  });
  const description = service.describeTextInvocation({
    roleType: "llm",
    requestedProvider: "default",
    messages,
    operation: "chat",
    params: {
      temperature: 0.2,
      maxTokens: 128,
    },
  });

  assert.equal(text, "ab");
  assert.deepEqual(resolvedFromStream?.params, {
    temperature: 0.2,
    think: false,
    maxTokens: 128,
  });
  assert.deepEqual(resolvedFromDescribe?.params, {
    temperature: 0.2,
    think: false,
    maxTokens: 128,
  });
  assert.deepEqual(description.params, {
    temperature: 0.2,
    think: false,
    maxTokens: 128,
  });
});
