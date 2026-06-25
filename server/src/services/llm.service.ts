import type { ModelType } from "@/db/schema.js";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import {
  describeResolvedChatInvocation,
  streamResolvedChat,
} from "@/services/provider-proxy.service/chat-adapters.js";
import { resolveProviderForRole } from "@/services/provider-proxy.service/resolution.js";
import type {
  ProviderInvocationMetadata,
  ProviderResolution,
  ProxyProviderParam,
} from "@/services/provider-proxy.service/types.js";

export interface LlmTextInvocationInput {
  roleType: ModelType;
  requestedProvider?: ProxyProviderParam;
  messages: NormalizedChatMessage[];
  params?: Record<string, unknown>;
}

export interface LlmTextDescribeInput extends LlmTextInvocationInput {
  operation: "chat" | "task-chat";
}

export interface LlmServiceDeps {
  resolveProviderForRole: (
    roleType: ModelType,
    requestedProvider?: ProxyProviderParam,
  ) => ProviderResolution;
  streamResolvedChat: (
    resolved: ProviderResolution,
    messages: NormalizedChatMessage[],
  ) => AsyncIterable<string>;
  describeResolvedChatInvocation: (
    resolved: ProviderResolution,
    messages: NormalizedChatMessage[],
    operation: "chat" | "task-chat",
  ) => ProviderInvocationMetadata;
}

const withResolvedParams = (
  resolved: ProviderResolution,
  params: Record<string, unknown> | undefined,
): ProviderResolution =>
  params
    ? {
        ...resolved,
        params: {
          ...resolved.params,
          ...params,
        },
      }
    : resolved;

export const collectLlmText = async (stream: AsyncIterable<string>) => {
  let output = "";

  for await (const delta of stream) {
    output += delta;
  }

  return output;
};

export const createLlmService = (deps: LlmServiceDeps) => {
  const resolveInvocation = (input: LlmTextInvocationInput) =>
    withResolvedParams(
      deps.resolveProviderForRole(input.roleType, input.requestedProvider ?? "default"),
      input.params,
    );

  return {
    streamText(input: LlmTextInvocationInput) {
      return deps.streamResolvedChat(resolveInvocation(input), input.messages);
    },

    async generateText(input: LlmTextInvocationInput) {
      return collectLlmText(this.streamText(input));
    },

    describeTextInvocation(input: LlmTextDescribeInput) {
      return deps.describeResolvedChatInvocation(
        resolveInvocation(input),
        input.messages,
        input.operation,
      );
    },
  };
};

export const llmService = createLlmService({
  resolveProviderForRole,
  streamResolvedChat,
  describeResolvedChatInvocation,
});
