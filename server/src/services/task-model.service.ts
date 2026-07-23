import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import { streamResolvedChat } from "@/services/provider-proxy.service/chat-adapters.js";
import { resolveAgentTaskProvider } from "@/services/provider-proxy.service/resolution.js";

export type TaskModelCallOptions = {
  maxTokens?: number;
  temperature?: number;
};

const clampInteger = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.trunc(value)));

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
  const baseResolved = resolveAgentTaskProvider("default");
  const maxTokens = clampInteger(options.maxTokens ?? 512, 64, 4096);
  const temperature =
    typeof options.temperature === "number" && Number.isFinite(options.temperature)
      ? Math.max(0, Math.min(2, options.temperature))
      : 0;

  return streamResolvedChat(
    {
      ...baseResolved,
      params: {
        ...baseResolved.params,
        maxTokens,
        temperature,
      },
    },
    messages,
  );
};

export const collectTaskModelText = async (
  messages: NormalizedChatMessage[],
  options: TaskModelCallOptions = {},
) => {
  let output = "";
  for await (const delta of streamTaskModelText(messages, options)) {
    output += delta;
  }
  return output.trim();
};
