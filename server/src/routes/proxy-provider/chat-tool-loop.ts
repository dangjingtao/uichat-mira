import OpenAI from "openai";
import { createOpenAICompatibleClient } from "@/services/openai-compatible-provider.js";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import { executeHarnessInvocation } from "@/mcp/harness/invocations.js";
import { createHarnessEnvironmentSnapshot } from "@/mcp/harness/environment.js";
import { resolveProviderForRole } from "@/services/provider-proxy.service/resolution.js";
import { getProviderDefinition } from "@/providers/catalog.js";
import { toOpenAICompatibleChatOptions } from "@/services/provider-proxy.service/params.js";
import {
  resolveChatToolSurface,
  type ChatToolSurfaceDefinition,
} from "./chat-tool-surface.js";
import type { AssistantToolEvent } from "@/services/chat-stream-events.js";
import type { HarnessToolConfig } from "@/mcp/harness/environment.js";

const MAX_TOOL_LOOP_STEPS = 3;

interface ExecuteChatToolLoopInput {
  requestedProvider: "default";
  threadId: string;
  userId: number;
  messages: NormalizedChatMessage[];
  params?: Record<string, unknown>;
  toolConfig?: HarnessToolConfig;
  onToolEvent?: (event: AssistantToolEvent) => Promise<void> | void;
}

type OpenAIToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

const toOpenAIMessageContent = (message: NormalizedChatMessage) => {
  const textParts = (message.parts ?? [])
    .filter(
      (
        part,
      ): part is Extract<NonNullable<NormalizedChatMessage["parts"]>[number], { type: "text" }> =>
        part.type === "text",
    )
    .map((part) => part.text);

  return textParts.join("\n").trim() || message.content;
};

const toOpenAIMessages = (messages: NormalizedChatMessage[]) =>
  messages.map((message) => ({
    role: message.role,
    content: toOpenAIMessageContent(message),
  })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[];

const toOpenAITools = (tools: ChatToolSurfaceDefinition[]) =>
  tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));

const parseToolArguments = (raw: string) => {
  if (!raw.trim()) {
    return {};
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Tool arguments must be a JSON object");
  }

  return parsed as Record<string, unknown>;
};

const buildToolResultMessage = (
  toolCallId: string,
  toolName: string,
  result: unknown,
): OpenAI.Chat.Completions.ChatCompletionToolMessageParam => ({
  role: "tool",
  tool_call_id: toolCallId,
  content: JSON.stringify({
    toolName,
    result,
  }),
});

const buildAssistantToolCallMessage = (
  toolCalls: OpenAIToolCall[],
): OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam => ({
  role: "assistant",
  content: "",
  tool_calls: toolCalls.map((toolCall) => ({
    id: toolCall.id,
    type: "function",
    function: {
      name: toolCall.function.name,
      arguments: toolCall.function.arguments,
    },
  })),
});

/**
 * Minimal Phase 2 normal-chat tool loop.
 *
 * Scope:
 * - openai-compatible providers only
 * - allowlisted Harness-backed tools only
 * - synchronous completion API, no tool streaming yet
 * - single request completes the whole tool loop before returning final answer
 */
export const executeDefaultChatToolLoop = async (
  input: ExecuteChatToolLoopInput,
) => {
  const resolved = resolveProviderForRole("llm", input.requestedProvider);
  const providerDefinition = getProviderDefinition(resolved.providerCode);

  if (providerDefinition.chatAdapter !== "openai-compatible") {
    return null;
  }

  const toolSurface = resolveChatToolSurface();
  if (toolSurface.length === 0) {
    return null;
  }

  const client = createOpenAICompatibleClient(resolved.baseUrl, resolved.apiKey);
  const openAiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
    toOpenAIMessages(input.messages);
  const tools = toOpenAITools(toolSurface);
  const mergedParams = {
    ...resolved.params,
    ...(input.params ?? {}),
  };
  const mergedToolConfig = input.toolConfig ?? {};

  for (let step = 0; step < MAX_TOOL_LOOP_STEPS; step += 1) {
    const completion = await client.chat.completions.create({
      model: resolved.model,
      messages: openAiMessages,
      tools,
      tool_choice: "auto",
      stream: false,
      ...toOpenAICompatibleChatOptions(mergedParams),
    });

    const choice = completion.choices[0];
    const message = choice?.message;
    const toolCalls = (message?.tool_calls ?? []) as OpenAIToolCall[];
    const finalText = message?.content?.trim() ?? "";

    if (toolCalls.length === 0) {
      return {
        answer: finalText,
        toolCallsUsed: step,
      };
    }

    openAiMessages.push(buildAssistantToolCallMessage(toolCalls));

    for (const toolCall of toolCalls) {
      const toolArgs = parseToolArguments(toolCall.function.arguments ?? "");
      await input.onToolEvent?.({
        callId: toolCall.id,
        toolName: toolCall.function.name,
        status: "requested",
        input: toolArgs,
      });
      await input.onToolEvent?.({
        callId: toolCall.id,
        toolName: toolCall.function.name,
        status: "running",
        input: toolArgs,
      });
      const invocation = await executeHarnessInvocation({
        toolId: toolCall.function.name,
        args: toolArgs,
        threadId: input.threadId,
        ...(mergedToolConfig.web_search
          ? {
              environment: createHarnessEnvironmentSnapshot({
                toolConfig: {
                  web_search: mergedToolConfig.web_search,
                },
              }),
            }
          : {}),
      });

      if (invocation.status !== "completed") {
        await input.onToolEvent?.({
          callId: toolCall.id,
          toolName: toolCall.function.name,
          status: "failed",
          input: toolArgs,
          errorMessage:
            invocation.error?.message ??
            `Tool invocation failed: ${toolCall.function.name}`,
        });
        throw new Error(
          invocation.error?.message ??
            `Tool invocation failed: ${toolCall.function.name}`,
        );
      }

      await input.onToolEvent?.({
        callId: toolCall.id,
        toolName: toolCall.function.name,
        status: "succeeded",
        input: toolArgs,
        output: invocation.result ?? null,
      });

      openAiMessages.push(
        buildToolResultMessage(
          toolCall.id,
          toolCall.function.name,
          invocation.result ?? null,
        ),
      );
    }
  }

  throw new Error("Tool loop exceeded maximum step limit");
};
