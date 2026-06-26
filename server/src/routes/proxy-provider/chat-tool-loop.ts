import OpenAI from "openai";
import { createOpenAICompatibleClient } from "@/services/openai-compatible-provider.js";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import { executeHarnessInvocation } from "@/mcp/harness/invocations.js";
import { resolveProviderForRole } from "@/services/provider-proxy.service/resolution.js";
import { getProviderDefinition } from "@/providers/catalog.js";
import { toOpenAICompatibleChatOptions } from "@/services/provider-proxy.service/params.js";
import {
  resolveChatToolSurface,
  type ChatToolSurfaceDefinition,
} from "./chat-tool-surface.js";
import type {
  AssistantExecutionNodeEvent,
  AssistantToolEvent,
} from "@/services/chat-stream-events.js";

const MAX_TOOL_LOOP_STEPS = 3;
const TODAY_DATE_ISO = "2026-06-26";

interface ExecuteChatToolLoopInput {
  requestedProvider: "default";
  threadId: string;
  userId: number;
  messages: NormalizedChatMessage[];
  params?: Record<string, unknown>;
  onToolEvent?: (event: AssistantToolEvent) => Promise<void> | void;
  onExecutionNode?: (
    event: AssistantExecutionNodeEvent,
  ) => Promise<void> | void;
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

const buildDefaultToolPolicyMessage =
  (): OpenAI.Chat.Completions.ChatCompletionSystemMessageParam => ({
    role: "system",
    content: [
      `Today is ${TODAY_DATE_ISO}.`,
      "If the user asks about today's date, current time, latest news, live events, weather, prices, recent developments, or any fact that depends on current real-world information, do not guess from memory.",
      "Use the available web_search tool first whenever current information is required.",
      "If a search tool call fails or returns no usable current information, say that the real-time lookup failed instead of pretending to know the answer.",
    ].join(" "),
  });

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

const toToolExecutionNodeEvent = (input: {
  toolCallId?: string;
  toolName: string;
  phase: "start" | "done" | "error";
  summary: string;
  toolArgs?: Record<string, unknown>;
  output?: unknown;
  errorMessage?: string;
}) => ({
  nodeId: input.toolCallId ?? `tool-${input.toolName}`,
  nodeType: "tool",
  phase: input.phase,
  label: input.toolName,
  summary: input.summary,
  details: {
    toolName: input.toolName,
    ...(input.toolCallId ? { callId: input.toolCallId } : {}),
    ...(input.toolArgs ? { input: input.toolArgs } : {}),
    ...(Object.prototype.hasOwnProperty.call(input, "output")
      ? { output: input.output }
      : {}),
    ...(input.errorMessage ? { errorMessage: input.errorMessage } : {}),
  },
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
    [buildDefaultToolPolicyMessage(), ...toOpenAIMessages(input.messages)];
  const tools = toOpenAITools(toolSurface);
  const mergedParams = {
    ...resolved.params,
    ...(input.params ?? {}),
  };

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
      await input.onExecutionNode?.(
        toToolExecutionNodeEvent({
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
          phase: "start",
          summary: `Running ${toolCall.function.name}`,
          toolArgs,
        }),
      );
      const invocation = await executeHarnessInvocation({
        toolId: toolCall.function.name,
        args: toolArgs,
        threadId: input.threadId,
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
        await input.onExecutionNode?.(
          toToolExecutionNodeEvent({
            toolCallId: toolCall.id,
            toolName: toolCall.function.name,
            phase: "error",
            summary: `${toolCall.function.name} failed`,
            toolArgs,
            errorMessage:
              invocation.error?.message ??
              `Tool invocation failed: ${toolCall.function.name}`,
          }),
        );
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
      await input.onExecutionNode?.(
        toToolExecutionNodeEvent({
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
          phase: "done",
          summary: `${toolCall.function.name} completed`,
          toolArgs,
          output: invocation.result ?? null,
        }),
      );

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
