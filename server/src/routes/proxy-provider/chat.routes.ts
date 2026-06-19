import type { FastifyInstance, FastifyReply } from "fastify";
import { PUBLIC_API_ROUTES } from "@/config/public-api.js";
import { threadService } from "@/services/thread.service.js";
import {
  type ProxyProviderParam,
  providerProxyService,
} from "@/services/provider-proxy.service.js";
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
import type {
  ChatMessagesBody,
  ProviderChatBody,
  ProviderChatParams,
} from "./types.js";

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

      const messages = providerProxyService.normalizeMessages(
        request.body.messages,
      );

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

      const messages = providerProxyService.normalizeMessages(
        request.body.messages,
      );

      if (messages.length === 0) {
        throw badRequest("No valid chat messages provided");
      }

      if (request.params.provider === "default") {
        const threadId = request.body.id;
        const authUser = request.authUser;
        const thread =
          typeof threadId === "string" && authUser
            ? threadService.getThreadSummaryById(threadId, authUser.id)
            : null;
        const ragInput = toRagInput(messages);

        if (
          thread?.ragEnabled &&
          ragInput &&
          typeof threadId === "string" &&
          authUser
        ) {
          prepareDataStreamReply(reply);
          return reply.send(
            createRagAssistantStream({
              threadId,
              userId: authUser.id,
              userMessageId: request.body.messageId,
              ragInput,
              messages,
              log: app.log,
            }),
          );
        }

        if (thread?.ragEnabled) {
          app.log.warn(
            {
              scope: "proxy-provider",
              event: "rag-branch-skipped",
              hasThreadId: typeof threadId === "string",
              hasAuthUser: Boolean(authUser),
              hasRagInput: Boolean(ragInput),
              threadFound: Boolean(thread),
              threadId,
            },
            "[proxy-provider] RAG enabled thread skipped RAG branch",
          );
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
