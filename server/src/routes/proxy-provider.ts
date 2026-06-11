import type { FastifyPluginAsync, FastifyReply } from "fastify";
import {
  ErrorCodes,
  error,
  getErrorMessage,
  handleValidationError,
  success,
} from "@/utils/index.js";
import {
  providerProxyService,
  type ProxyProviderParam,
  type NormalizedChatMessage,
} from "@/services/provider-proxy.service.js";
import { ragPipeline } from "@/services/rag-pipeline.js";
import { threadService } from "@/services/thread.service.js";
import {
  PROVIDER_CODE_ENUM,
  proxyProviderSchema,
} from "@/providers/catalog.js";
import { PUBLIC_API_ROUTES } from "@/config/public-api.js";
import {
  errorEnvelope,
  messageRoleSchema,
  successEnvelope,
} from "@/routes/schema-helpers.js";

const createErrorResponse = (reply: FastifyReply, message: string) =>
  reply.code(400).send(error(message, ErrorCodes.VALIDATION_ERROR));

const chatMessagesBodySchema = {
  type: "object",
  required: ["messages"],
  properties: {
    messages: {
      type: "array",
      items: {
        type: "object",
        required: ["role", "parts"],
        properties: {
          role: {
            ...messageRoleSchema,
          },
          parts: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: true,
            },
          },
        },
      },
    },
  },
} as const;

const prepareEventStreamReply = (reply: FastifyReply) => {
  reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
  reply.raw.setHeader("Connection", "keep-alive");
  reply.type("text/event-stream; charset=utf-8");
};

const toRagInput = (messages: NormalizedChatMessage[]) => {
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

const proxyProviderRoute: FastifyPluginAsync = async (app) => {
  const taskDefaultChatRoute = PUBLIC_API_ROUTES.taskDefaultChat;
  const providerChatRoute = PUBLIC_API_ROUTES.providerChat;
  const providerEmbeddingsRoute = PUBLIC_API_ROUTES.providerEmbeddings;

  app.post<{
    Body: {
      messages: Array<{
        role?: "system" | "user" | "assistant";
        parts?: Array<{ type?: string; text?: string }>;
      }>;
    };
  }>(
    taskDefaultChatRoute.path,
    {
      attachValidation: true,
      schema: {
        tags: [taskDefaultChatRoute.tag],
        summary: taskDefaultChatRoute.summary,
        operationId: "taskDefaultChat",
        body: chatMessagesBodySchema,
        response: {
          200: {
            description: "Server-Sent Events stream delivering task chat chunks",
            type: "string",
          },
          400: errorEnvelope,
          500: errorEnvelope,
        },
      },
    },
    async (request, reply) => {
      const validationResponse = handleValidationError(request, reply);
      if (validationResponse) {
        return validationResponse;
      }

      try {
        const messages = providerProxyService.normalizeMessages(
          request.body.messages,
        );

        if (messages.length === 0) {
          return createErrorResponse(reply, "No valid task messages provided");
        }

        prepareEventStreamReply(reply);

        return reply.send(
          providerProxyService.streamTaskChat(messages),
        );
      } catch (err) {
        app.log.error({ err }, "[task-proxy] task chat failed");
        const message = getErrorMessage(err);
        return reply.code(500).send(error(message, ErrorCodes.INTERNAL_ERROR));
      }
    },
  );

  app.post<{
    Params: { provider: ProxyProviderParam };
    Body: {
      id?: string;
      messages: Array<{
        role?: "system" | "user" | "assistant";
        parts?: Array<{ type?: string; text?: string }>;
      }>;
    };
  }>(
    providerChatRoute.path,
    {
      attachValidation: true,
      schema: {
        tags: [providerChatRoute.tag],
        summary: providerChatRoute.summary,
        operationId: "proxyProviderChat",
        params: {
          type: "object",
          required: ["provider"],
          properties: {
            provider: proxyProviderSchema,
          },
        },
        body: chatMessagesBodySchema,
        response: {
          200: {
            description: "Server-Sent Events stream delivering chat chunks",
            type: "string",
          },
          400: errorEnvelope,
          500: errorEnvelope,
        },
      },
    },
    async (request, reply) => {
      const validationResponse = handleValidationError(request, reply);
      if (validationResponse) {
        return validationResponse;
      }

      try {
        const messages = providerProxyService.normalizeMessages(
          request.body.messages,
        );

        if (messages.length === 0) {
          return createErrorResponse(reply, "No valid chat messages provided");
        }

        prepareEventStreamReply(reply);

        if (request.params.provider === "default") {
          const threadId = request.body.id;
          const thread =
            typeof threadId === "string" && request.authUser
              ? threadService.getThreadSummaryById(threadId, request.authUser.id)
              : null;
          const ragInput = toRagInput(messages);

          if (thread?.ragEnabled && ragInput) {
            return reply.send(
              ragPipeline.stream({
                question: ragInput.question,
                conversationHistory: ragInput.conversationHistory,
              }),
            );
          }
        }

        return reply.send(
          providerProxyService.streamChat(request.params.provider, messages),
        );
      } catch (err) {
        app.log.error({ err }, "[proxy-provider] chat failed");
        const message = getErrorMessage(err);
        return reply.code(500).send(error(message, ErrorCodes.INTERNAL_ERROR));
      }
    },
  );

  app.post<{
    Params: { provider: ProxyProviderParam };
    Body: {
      input: string | string[];
    };
  }>(
    providerEmbeddingsRoute.path,
    {
      attachValidation: true,
      schema: {
        tags: [providerEmbeddingsRoute.tag],
        summary: providerEmbeddingsRoute.summary,
        operationId: "proxyProviderEmbeddings",
        params: {
          type: "object",
          required: ["provider"],
          properties: {
            provider: proxyProviderSchema,
          },
        },
        body: {
          type: "object",
          required: ["input"],
          properties: {
            input: {
              anyOf: [
                { type: "string", minLength: 1 },
                {
                  type: "array",
                  minItems: 1,
                  items: { type: "string", minLength: 1 },
                },
              ],
            },
          },
        },
        response: {
          200: successEnvelope({
            type: "object",
            required: ["providerCode", "model", "dimensions", "embeddings"],
            properties: {
              providerCode: {
                type: "string",
                enum: PROVIDER_CODE_ENUM,
              },
              model: { type: "string" },
              modelConfigId: { type: "string" },
              dimensions: { type: "number" },
              embeddings: {
                type: "array",
                items: {
                  type: "array",
                  items: { type: "number" },
                },
              },
            },
          }),
          400: errorEnvelope,
          500: errorEnvelope,
        },
      },
    },
    async (request, reply) => {
      const validationResponse = handleValidationError(request, reply);
      if (validationResponse) {
        return validationResponse;
      }

      try {
        const input = Array.isArray(request.body.input)
          ? request.body.input
          : [request.body.input];

        const result = await providerProxyService.createEmbeddings(
          request.params.provider,
          input,
        );

        return success(result);
      } catch (err) {
        app.log.error({ err }, "[proxy-provider] embeddings failed");
        const message = getErrorMessage(err);
        return reply.code(500).send(error(message, ErrorCodes.INTERNAL_ERROR));
      }
    },
  );
};

export default proxyProviderRoute;
