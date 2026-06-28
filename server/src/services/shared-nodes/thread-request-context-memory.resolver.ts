import type { RequestContextResolver } from "./thread-request-context.types.js";

export const createThreadMemoryContextPrompt = (memoryContext: string) =>
  `以下是当前线程已沉淀的可复用记忆。你必须把它作为本轮对话的长期背景之一，但不要直接提到“记忆”或“系统提示”。\n\n长期记忆：\n${memoryContext}`;

/**
 * Memory resolver:
 * Provides a dedicated request-only slot for future vector / long-term memory
 * integration without mixing that state into role or summary semantics.
 */
export const resolveMemoryContext: RequestContextResolver = ({ thread }) => {
  const normalized = thread.memoryContext?.trim();
  if (!normalized) {
    return null;
  }

  return {
    message: {
      role: "system",
      content: createThreadMemoryContextPrompt(normalized),
    },
    executionNode: {
      nodeId: `request-context-memory-${thread.memoryContextUpdatedAt ?? "unknown"}`,
      nodeType: "memory",
      phase: "done",
      label: "长期记忆",
      summary: "已注入线程长期记忆",
      details: {
        updatedAt: thread.memoryContextUpdatedAt ?? null,
      },
    },
  };
};
