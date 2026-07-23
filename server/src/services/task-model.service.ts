import { writeStructuredLog } from "@/logger";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import { streamResolvedChat } from "@/services/provider-proxy.service/chat-adapters.js";
import { resolveAgentTaskProvider } from "@/services/provider-proxy.service/resolution.js";

export type TaskModelCallOptions = {
  maxTokens?: number;
  temperature?: number;
  purpose?: string;
};

const clampInteger = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.trunc(value)));

const resolveBoundedTaskInvocation = (options: TaskModelCallOptions) => {
  const baseResolved = resolveAgentTaskProvider("default");
  const maxTokens = clampInteger(options.maxTokens ?? 512, 64, 4096);
  const temperature =
    typeof options.temperature === "number" && Number.isFinite(options.temperature)
      ? Math.max(0, Math.min(2, options.temperature))
      : 0;
  return {
    resolved: {
      ...baseResolved,
      params: {
        ...baseResolved.params,
        maxTokens,
        temperature,
      },
    },
    maxTokens,
    temperature,
  };
};

/**
 * One bounded TaskModel call for internal structured work.
 *
 * This intentionally does not change the persisted/default agentTask model
 * configuration used by Planner. Callers that need more than Planner's compact
 * output budget must opt in per invocation.
 */
export const streamTaskModelText = (
  messages: NormalizedChatMessage[],
  options: TaskModelCallOptions = {},
) => {
  const invocation = resolveBoundedTaskInvocation(options);
  return streamResolvedChat(invocation.resolved, messages);
};

export const collectTaskModelText = async (
  messages: NormalizedChatMessage[],
  options: TaskModelCallOptions = {},
) => {
  const startedAtMs = Date.now();
  const invocation = resolveBoundedTaskInvocation(options);
  let output = "";

  try {
    for await (const delta of streamResolvedChat(invocation.resolved, messages)) {
      output += delta;
    }
    const trimmed = output.trim();
    writeStructuredLog("info", {
      scope: "bounded-task-model",
      event: "call-completed",
      purpose: options.purpose ?? "unspecified",
      providerCode: invocation.resolved.providerCode,
      model: invocation.resolved.model,
      modelConfigId: invocation.resolved.modelConfigId,
      maxTokens: invocation.maxTokens,
      temperature: invocation.temperature,
      messageCount: messages.length,
      outputCharCount: Array.from(trimmed).length,
      durationMs: Date.now() - startedAtMs,
    });
    return trimmed;
  } catch (error) {
    writeStructuredLog("warn", {
      scope: "bounded-task-model",
      event: "call-failed",
      purpose: options.purpose ?? "unspecified",
      providerCode: invocation.resolved.providerCode,
      model: invocation.resolved.model,
      modelConfigId: invocation.resolved.modelConfigId,
      maxTokens: invocation.maxTokens,
      temperature: invocation.temperature,
      messageCount: messages.length,
      durationMs: Date.now() - startedAtMs,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : String(error),
    });
    throw error;
  }
};
