import type { FastifyBaseLogger } from "fastify";
import { executeHarnessInvocation } from "@/mcp/harness/invocations.js";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import {
  assistantExecutionNodeChunk,
  type AssistantExecutionNodeEvent,
} from "@/services/chat-stream-events.js";
import type { RequestContextExecutionNode } from "./thread-request-context.types.js";

export interface ThreadRequestContextWebSearchInput {
  question: string;
  threadId: string;
  requestContextMessages?: NormalizedChatMessage[];
  requestContextPreludeChunks?: string[];
  log: FastifyBaseLogger;
  force?: boolean;
}

export interface ThreadRequestContextWebSearchResult {
  requestContextMessages?: NormalizedChatMessage[];
  preludeChunks: string[];
}

const looksLikeRealtimeQuestion = (question: string) => {
  const normalized = question.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return [
    "今天",
    "当前",
    "现在",
    "实时",
    "最新",
    "联网",
    "日期",
    "时间",
    "news",
    "latest",
    "current",
    "today",
    "weather",
    "price",
  ].some((keyword) => normalized.includes(keyword));
};

const toRealtimeSearchExecutionNode = (input: {
  phase: "start" | "done" | "error";
  summary: string;
  details?: Record<string, unknown>;
}): RequestContextExecutionNode =>
  ({
    nodeId: "tool-web_search-rag-prefetch",
    nodeType: "context",
    phase: input.phase,
    label: "web_search 预取",
    summary: input.summary,
    ...(input.details ? { details: input.details } : {}),
  });

const buildRealtimeSearchContextMessage = (
  result: unknown,
): NormalizedChatMessage => {
  const normalized =
    result && typeof result === "object"
      ? (result as {
          query?: string;
          provider?: string;
          results?: Array<{
            title?: string;
            link?: string;
            snippet?: string;
          }>;
        })
      : {};

  const lines = [
    "以下是本轮请求前通过 web_search 获取的实时参考信息。你必须把它当作 request-only 上下文使用，但不要提到“系统提示”或“搜索上下文”。",
    normalized.query ? `查询：${normalized.query}` : null,
    normalized.provider ? `来源：${normalized.provider}` : null,
    Array.isArray(normalized.results) && normalized.results.length > 0
      ? normalized.results
          .slice(0, 5)
          .map((item, index) =>
            [
              `${index + 1}. ${item.title ?? "Untitled"}`,
              item.snippet ? `摘要：${item.snippet}` : null,
              item.link ? `链接：${item.link}` : null,
            ]
              .filter(Boolean)
              .join("\n"),
          )
          .join("\n\n")
      : "未获取到可用实时结果。",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    role: "system",
    content: lines,
    parts: [{ type: "text", text: lines }],
  };
};

/**
 * This resolver is an outer request-only prefetch layer. It intentionally sits
 * before the current RAG graph so we can reuse the same execution-node contract
 * without forcing search behavior into the existing retrieval/generate nodes.
 */
export const resolveThreadWebSearchContext = async ({
  question,
  threadId,
  requestContextMessages,
  log,
  force = false,
}: ThreadRequestContextWebSearchInput): Promise<ThreadRequestContextWebSearchResult> => {
  if (!force && !looksLikeRealtimeQuestion(question)) {
    return {
      requestContextMessages,
      preludeChunks: [],
    };
  }

  const preludeChunks: string[] = [];
  const searchArgs = { query: question };

  preludeChunks.push(
    assistantExecutionNodeChunk(
      toRealtimeSearchExecutionNode({
        phase: "start",
        summary: "Running web_search",
        details: {
          toolName: "web_search",
          input: searchArgs,
        },
      }),
    ),
  );

  try {
    const invocation = await executeHarnessInvocation({
      toolId: "web_search",
      args: searchArgs,
      threadId,
    });

    if (invocation.status !== "completed") {
      const errorMessage =
        invocation.error?.message ?? "Tool invocation failed: web_search";
      preludeChunks.push(
        assistantExecutionNodeChunk(
          toRealtimeSearchExecutionNode({
            phase: "error",
            summary: "web_search failed",
            details: {
              toolName: "web_search",
              input: searchArgs,
              errorMessage,
            },
          }),
        ),
      );
      return {
        requestContextMessages,
        preludeChunks,
      };
    }

    preludeChunks.push(
      assistantExecutionNodeChunk(
        toRealtimeSearchExecutionNode({
          phase: "done",
          summary: "web_search completed",
          details: {
            toolName: "web_search",
            input: searchArgs,
            output: invocation.result ?? null,
          },
        }),
      ),
    );

    return {
      requestContextMessages: [
        ...(requestContextMessages ?? []),
        buildRealtimeSearchContextMessage(invocation.result ?? null),
      ],
      preludeChunks,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn(
      {
        scope: "proxy-provider",
        event: "rag-realtime-search-prefetch-failed",
        threadId,
        question,
        err: error,
      },
      "[proxy-provider] failed to prefetch realtime web search before RAG",
    );
    preludeChunks.push(
      assistantExecutionNodeChunk(
        toRealtimeSearchExecutionNode({
          phase: "error",
          summary: "web_search failed",
          details: {
            toolName: "web_search",
            input: searchArgs,
            errorMessage: message,
          },
        }),
      ),
    );
    return {
      requestContextMessages,
      preludeChunks,
    };
  }
};
