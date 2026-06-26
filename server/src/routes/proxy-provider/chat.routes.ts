import type { FastifyInstance, FastifyReply } from "fastify";
import { PUBLIC_API_ROUTES } from "@/config/public-api.js";
import { threadService } from "@/services/thread.service.js";
import {
  roleService,
  type RoleLlmProfileResponse,
} from "@/services/role.service.js";
import { threadRequestContextNode } from "@/services/shared-nodes/thread-request-context.node.js";
import {
  type ProxyProviderParam,
  providerProxyService,
} from "@/services/provider-proxy.service/index.js";
import { normalizeProxyChatMessages } from "@/services/provider-proxy.message-protocol.js";
import {
  handleValidationError,
} from "@/utils/index.js";
import { badRequest, routeHandler } from "@/utils/route-errors.js";
import { createRagAssistantStream, toRagInput } from "./rag-thread.js";
import { proxyProviderRouteSchemas } from "./schemas.js";
import {
  prepareDataStreamReply,
  prepareEventStreamReply,
} from "./stream-protocol.js";
import { executeDefaultChatToolLoop } from "./chat-tool-loop.js";
import {
  getFallbackThreadTitle,
  generateThreadTitleFromMessages,
  getLatestUserTitleSeed,
  persistAssistantMessage,
  persistVisibleUserMessage,
  shouldGenerateTitle,
} from "./message-persistence.js";
import type {
  ChatMessagesBody,
  ProviderChatBody,
  ProviderChatParams,
} from "./types.js";

export const shouldUseThreadRag = (input: {
  knowledgeBaseId: string | null | undefined;
  ragInput: ReturnType<typeof toRagInput>;
  threadId?: string;
  hasAuthUser: boolean;
}) =>
  Boolean(
    input.knowledgeBaseId &&
      input.ragInput &&
      typeof input.threadId === "string" &&
      input.hasAuthUser,
  );

const resolveDefaultProviderThread = (
  threadId: string | undefined,
  userId: number | undefined,
) => {
  if (typeof threadId !== "string" || !userId) {
    return null;
  }

  return threadService.getThreadSummaryById(threadId, userId);
};

const collectThreadContextMessages = (
  threadId: string | undefined,
  userId: number | undefined,
) => {
  if (typeof threadId !== "string" || !userId) {
    return [];
  }

  const thread = threadService.getThreadSummaryById(threadId, userId);
  if (!thread) {
    return [];
  }

  return threadRequestContextNode.createRequestMessages(thread, userId);
};

const resolveThreadRoleLlmParams = (
  threadId: string | undefined,
  userId: number | undefined,
): Record<string, unknown> | undefined => {
  if (typeof threadId !== "string" || !userId) {
    return undefined;
  }

  const thread = threadService.getThreadSummaryById(threadId, userId);
  if (!thread?.roleId) {
    return undefined;
  }

  const role = roleService.getRoleById(thread.roleId, userId);
  if (!role) {
    return undefined;
  }

  const profile = role.llmProfile as RoleLlmProfileResponse;
  const params = Object.fromEntries(
    Object.entries({
      temperature: profile.temperature,
      topP: profile.topP,
      topK: profile.topK,
      maxTokens: profile.maxTokens,
      frequencyPenalty: profile.frequencyPenalty,
      presencePenalty: profile.presencePenalty,
    }).filter(([, value]) => typeof value === "number"),
  );

  return Object.keys(params).length > 0 ? params : undefined;
};

const sendRagChatStream = ({
  app,
  reply,
  threadId,
  authUserId,
  userMessageId,
  ragInput,
  messages,
  requestContextMessages,
}: {
  app: FastifyInstance;
  reply: FastifyReply;
  threadId: string;
  authUserId: number;
  userMessageId?: string;
  ragInput: NonNullable<ReturnType<typeof toRagInput>>;
  messages: ReturnType<typeof normalizeProxyChatMessages>;
  requestContextMessages?: ReturnType<typeof normalizeProxyChatMessages>;
}) => {
  prepareEventStreamReply(reply);
  return reply.send(
    createRagAssistantStream({
      threadId,
      userId: authUserId,
      userMessageId,
      ragInput,
      messages,
      requestContextMessages,
      log: app.log,
    }),
  );
};

const sendPersistedDefaultChatStream = ({
  app,
  reply,
  threadId,
  authUserId,
  userMessageId,
  messages,
  params,
  toolConfig,
}: {
  app: FastifyInstance;
  reply: FastifyReply;
  threadId: string;
  authUserId: number;
  userMessageId?: string;
  messages: ReturnType<typeof normalizeProxyChatMessages>;
  params?: Record<string, unknown>;
  toolConfig?: ProviderChatBody["toolConfig"];
}) => {
  const { latestUserMessageId, latestUserMessage } = persistVisibleUserMessage({
    threadId,
    userId: authUserId,
    userMessageId,
    messages,
  });
  const assistantMessageId = crypto.randomUUID();

  prepareEventStreamReply(reply);
  return reply.send(
    providerProxyService.createPersistedChatStream({
      requestedProvider: "default",
      threadId,
      userId: authUserId,
      userMessageId: latestUserMessageId,
      assistantMessageId,
      messages,
      params,
      executeFullAnswer: async ({ emitToolEvent }) => {
        const toolLoopResult = await executeDefaultChatToolLoop({
          requestedProvider: "default",
          threadId,
          userId: authUserId,
          messages,
          params,
          toolConfig,
          onToolEvent: emitToolEvent,
        });

        if (toolLoopResult) {
          return toolLoopResult.answer;
        }

        return providerProxyService.generateTextForRole("llm", messages, params);
      },
      onComplete: async ({ answer, finishReason }) => {
        if (finishReason !== "stop" || !answer.trim()) {
          return;
        }

        persistAssistantMessage({
          threadId,
          userId: authUserId,
          assistantMessageId,
          parentId: latestUserMessageId,
          content: answer,
        });

        try {
          const currentThread = threadService.getThreadSummaryById(
            threadId,
            authUserId,
          );
          const latestUserText = getLatestUserTitleSeed(latestUserMessage);
          if (latestUserText && shouldGenerateTitle(currentThread?.title)) {
            const title = await generateThreadTitleFromMessages({
              question: latestUserText,
              answer,
              streamTaskChatText: (titleMessages) =>
                providerProxyService.streamTaskChatText(titleMessages),
            });
            threadService.updateThread(threadId, authUserId, {
              title,
            });
          }
        } catch (titleError) {
          const fallbackTitle = getFallbackThreadTitle(
            getLatestUserTitleSeed(latestUserMessage),
          );
          if (shouldGenerateTitle(threadService.getThreadSummaryById(
            threadId,
            authUserId,
          )?.title) && fallbackTitle !== "新对话") {
            threadService.updateThread(threadId, authUserId, {
              title: fallbackTitle,
            });
          }
          app.log.warn(
            { err: titleError, threadId, fallbackTitle },
            "[proxy-provider] failed to generate non-RAG thread title",
          );
        }
      },
    }),
  );
};

export const registerProxyProviderChatRoutes = async (
  app: FastifyInstance,
) => {
  const taskDefaultChatRoute = PUBLIC_API_ROUTES.taskDefaultChat;
  const providerChatRoute = PUBLIC_API_ROUTES.providerChat;

  app.post<{ Body: ChatMessagesBody }>(
    taskDefaultChatRoute.path,
    {
      attachValidation: true,
      schema: proxyProviderRouteSchemas.taskDefaultChat,
    },
    routeHandler("Task chat failed", async (request, reply) => {
      const validationResponse = handleValidationError(request, reply);
      if (validationResponse) {
        return validationResponse;
      }

      const messages = normalizeProxyChatMessages(request.body.messages);

      if (messages.length === 0) {
        throw badRequest("No valid task messages provided");
      }

      prepareEventStreamReply(reply);

      return reply.send(providerProxyService.streamTaskChat(messages));
    }),
  );

  app.post<{
    Params: ProviderChatParams;
    Body: ProviderChatBody;
  }>(
    providerChatRoute.path,
    {
      attachValidation: true,
      schema: proxyProviderRouteSchemas.providerChat,
    },
    routeHandler("Provider chat failed", async (request, reply) => {
      const validationResponse = handleValidationError(request, reply);
      if (validationResponse) {
        return validationResponse;
      }

      const messages = normalizeProxyChatMessages(request.body.messages);

      if (messages.length === 0) {
        throw badRequest("No valid chat messages provided");
      }

      if (request.params.provider === "default") {
        const threadId = request.body.id;
        const authUser = request.authUser;
        const thread = resolveDefaultProviderThread(threadId, authUser?.id);
        const requestContextMessages = collectThreadContextMessages(
          threadId,
          authUser?.id,
        );
        const defaultChatMessages = [...requestContextMessages, ...messages];
        const ragInput = toRagInput(messages);
        const roleLlmParams = resolveThreadRoleLlmParams(threadId, authUser?.id);
        const useThreadRag = shouldUseThreadRag({
          knowledgeBaseId: thread?.knowledgeBaseId,
          ragInput,
          threadId,
          hasAuthUser: Boolean(authUser),
        });

        if (useThreadRag && authUser && ragInput && typeof threadId === "string") {
          return sendRagChatStream({
            app,
            reply,
            threadId,
            authUserId: authUser.id,
            userMessageId: request.body.messageId,
            ragInput,
            messages,
            requestContextMessages,
          });
        }

        if (thread?.knowledgeBaseId) {
          app.log.warn(
            {
              scope: "proxy-provider",
              event: "rag-branch-skipped",
              hasThreadId: typeof threadId === "string",
              hasAuthUser: Boolean(authUser),
              hasRagInput: Boolean(ragInput),
              threadFound: Boolean(thread),
              knowledgeBaseId: thread.knowledgeBaseId,
              threadId,
            },
            "[proxy-provider] knowledge-base thread skipped RAG branch",
          );
        }

        if (typeof threadId === "string" && authUser) {
          return sendPersistedDefaultChatStream({
            app,
            reply,
            threadId,
            authUserId: authUser.id,
            userMessageId: request.body.messageId,
            messages: defaultChatMessages,
            params: roleLlmParams,
            toolConfig: request.body.toolConfig,
          });
        }
      }

      prepareEventStreamReply(reply);
      return reply.send(
        providerProxyService.streamChat(
          request.params.provider as ProxyProviderParam,
          messages,
        ),
      );
    }),
  );
};
