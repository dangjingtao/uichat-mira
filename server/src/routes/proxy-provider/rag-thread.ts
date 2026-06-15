import type { FastifyBaseLogger } from "fastify";
import { knowledgeBaseService } from "@/services/knowledge-base.service.js";
import {
  type NormalizedChatMessage,
  providerProxyService,
} from "@/services/provider-proxy.service.js";
import { NO_CONTEXT_ANSWER } from "@/services/rag-response-constants.js";
import type { RetrievedChunk } from "@/services/rag-nodes/index.js";
import { ragPipeline } from "@/services/rag-pipeline.js";
import { threadService } from "@/services/thread.service.js";
import { createStaticAssistantStream } from "./stream-protocol.js";

export const toPersistedRagSources = (sources: RetrievedChunk[]) =>
  sources.map((source) => ({
    chunkId: source.chunkId,
    documentId: source.documentId,
    documentName: source.documentName,
    score: source.score,
    content: source.content,
    ...(source.matchType ? { matchType: source.matchType } : {}),
    ...(source.hitModes ? { hitModes: source.hitModes } : {}),
  }));

/** Extract the latest user question and history from normalized chat messages. */
export const toRagInput = (messages: NormalizedChatMessage[]) => {
  const latestUserIndex = [...messages]
    .map((message, index) => ({ message, index }))
    .reverse()
    .find((entry) => entry.message.role === "user")?.index;

  if (latestUserIndex === undefined) {
    return null;
  }

  const latestUserMessage = messages[latestUserIndex];
  if (!latestUserMessage?.content.trim()) {
    return null;
  }

  const conversationHistory = messages
    .slice(0, latestUserIndex)
    .filter((message) => message.role !== "system");

  return {
    question: latestUserMessage.content,
    conversationHistory,
  };
};

const cleanGeneratedTitle = (title: string) =>
  title
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .slice(0, 50);

const generateThreadTitle = async (question: string, answer: string) => {
  const prompt =
    "请根据以下对话内容生成一个简短的中文标题（不超过20个字符），只返回标题本身，不要解释。\n\n" +
    `用户：${question}\n助手：${answer.slice(0, 500)}`;

  let title = "";
  for await (const delta of providerProxyService.streamTaskChatText([
    {
      role: "user",
      content: prompt,
    },
  ])) {
    title += delta;
    if (title.length >= 80) {
      break;
    }
  }

  return cleanGeneratedTitle(title) || "新对话";
};

const shouldGenerateTitle = (title: string | undefined) => {
  const normalizedTitle = title?.trim();
  return !normalizedTitle || normalizedTitle === "新对话";
};

export interface RagAssistantStreamInput {
  /** Thread that owns the persisted RAG conversation. */
  threadId: string;
  /** Authenticated user id used for thread/message ownership checks. */
  userId: number;
  /** Optional client-side user message id. */
  userMessageId?: string;
  /** Latest user question and non-system history. */
  ragInput: NonNullable<ReturnType<typeof toRagInput>>;
  /** Logger from the Fastify route, used for route-level observability. */
  log: FastifyBaseLogger;
}

/**
 * Create the assistant-ui RAG stream and persist user/assistant messages around
 * it. Empty knowledge bases return a deterministic static stream.
 */
export const createRagAssistantStream = (input: RagAssistantStreamInput) => {
  const {
    threadId,
    userId,
    userMessageId,
    ragInput,
    log,
  } = input;

  log.info(
    {
      scope: "proxy-provider",
      event: "rag-branch-enter",
      threadId,
      userId,
      question: ragInput.question,
      historyCount: ragInput.conversationHistory?.length ?? 0,
    },
    "[proxy-provider] starting RAG assistant stream",
  );

  const latestUserMessageId =
    typeof userMessageId === "string" && userMessageId.trim()
      ? userMessageId
      : crypto.randomUUID();
  const assistantMessageId = crypto.randomUUID();

  const existingUserMessage = threadService.getMessageById(
    latestUserMessageId,
    userId,
  );

  if (!existingUserMessage) {
    threadService.createMessage(threadId, userId, {
      id: latestUserMessageId,
      role: "user",
      content: ragInput.question,
      metadata: { custom: {} },
    });
  }

  const persistRagAssistantMessage = async ({
    answer,
    sources,
    finishReason,
    routeReason,
  }: {
    answer: string;
    sources: RetrievedChunk[];
    finishReason: "stop" | "error";
    routeReason?: string;
  }) => {
    if (finishReason !== "stop" || !threadId || !answer.trim()) {
      return;
    }

    threadService.createMessage(threadId, userId, {
      id: assistantMessageId,
      role: "assistant",
      content: answer,
      metadata: {
        rag: {
          enabled: true,
          question: ragInput.question,
          topK: 10,
          topN: 4,
          sources: toPersistedRagSources(sources),
          ...(routeReason ? { routeReason } : {}),
        },
      },
    });

    try {
      const latestThread = threadService.getThreadSummaryById(threadId, userId);
      if (shouldGenerateTitle(latestThread?.title)) {
        const title = await generateThreadTitle(ragInput.question, answer);
        threadService.updateThread(threadId, userId, {
          title,
        });
      }
    } catch (titleError) {
      log.warn(
        { err: titleError, threadId },
        "[proxy-provider] failed to generate RAG thread title",
      );
    }
  };

  const defaultKnowledgeBase = knowledgeBaseService.getDefaultKnowledgeBase();

  if (defaultKnowledgeBase.enabledDocumentCount === 0) {
    log.info(
      {
        scope: "proxy-provider",
        event: "rag-route-empty-knowledge-base",
        threadId,
        userId,
        knowledgeBaseId: defaultKnowledgeBase.id,
      },
      "[proxy-provider] knowledge base empty, returning fixed RAG fallback",
    );

    return createStaticAssistantStream({
      messageId: assistantMessageId,
      answer: NO_CONTEXT_ANSWER,
      ragNode: {
        nodeId: "routeKnowledgeBase",
        nodeType: "route",
        label: "检查知识库可用性",
        summary: "知识库为空，直接返回固定拒答",
        details: {
          knowledgeBaseId: defaultKnowledgeBase.id,
          enabledDocumentCount: defaultKnowledgeBase.enabledDocumentCount,
          documentCount: defaultKnowledgeBase.documentCount,
        },
        environment: {
          result: {
            success: true,
            finishReason: "knowledge-base-empty",
            metrics: {
              candidateCount: 0,
              returnedCount: 0,
            },
            response: {
              summary: {
                answerLength: Array.from(NO_CONTEXT_ANSWER).length,
                routeReason: "knowledge-base-empty",
              },
            },
          },
          retrieval: {
            knowledgeBaseId: defaultKnowledgeBase.id,
            candidateCount: 0,
            returnedCount: 0,
          },
          timing: {
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            durationMs: 0,
          },
        },
      },
      onComplete: () =>
        persistRagAssistantMessage({
          answer: NO_CONTEXT_ANSWER,
          sources: [],
          finishReason: "stop",
          routeReason: "knowledge-base-empty",
        }),
    });
  }

  return ragPipeline.assistantStream(
    {
      question: ragInput.question,
      conversationHistory: ragInput.conversationHistory,
    },
    {
      messageId: assistantMessageId,
      onComplete: async ({ answer, sources, finishReason }) =>
        persistRagAssistantMessage({
          answer,
          sources,
          finishReason,
        }),
    },
  );
};
