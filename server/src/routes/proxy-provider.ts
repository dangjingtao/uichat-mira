import type { FastifyPluginAsync, FastifyReply } from "fastify";
import {
  ErrorCodes,
  error,
  handleValidationError,
  success,
} from "@/utils/index.js";
import {
  providerProxyService,
  type ProxyProviderParam,
} from "@/services/provider-proxy.service.js";

const proxyProviderEnum = ["default", "ollama", "lmstudio", "openai", "cloudflare"] as const;

const errorEnvelope = {
  type: "object",
  required: ["success", "message", "timestamp"],
  properties: {
    success: { type: "boolean", const: false },
    message: { type: "string" },
    code: { type: "string" },
    errors: {
      type: "array",
      items: {},
    },
    timestamp: { type: "string", format: "date-time" },
  },
} as const;

const successEnvelope = (dataSchema: Record<string, unknown>) => ({
  type: "object",
  required: ["success", "data", "timestamp"],
  properties: {
    success: { type: "boolean", const: true },
    data: dataSchema,
    message: { type: "string" },
    timestamp: { type: "string", format: "date-time" },
  },
});

const createErrorResponse = (reply: FastifyReply, message: string) =>
  reply.code(400).send(error(message, ErrorCodes.VALIDATION_ERROR));

const proxyProviderRoute: FastifyPluginAsync = async (app) => {
  app.post<{
    Params: { provider: ProxyProviderParam };
    Body: {
      messages: Array<{
        role?: "system" | "user" | "assistant";
        parts?: Array<{ type?: string; text?: string }>;
      }>;
    };
  }>(
    "/proxy/chat/:provider",
    {
      attachValidation: true,
      schema: {
        tags: ["Provider Proxy"],
        summary: "Stream chat through the configured provider",
        operationId: "proxyProviderChat",
        params: {
          type: "object",
          required: ["provider"],
          properties: {
            provider: { type: "string", enum: proxyProviderEnum },
          },
        },
        body: {
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
                    type: "string",
                    enum: ["system", "user", "assistant"],
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
        },
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

        reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
        reply.raw.setHeader("Connection", "keep-alive");
        reply.type("text/event-stream; charset=utf-8");

        return reply.send(
          providerProxyService.streamChat(request.params.provider, messages),
        );
      } catch (err) {
        app.log.error({ err }, "[proxy-provider] chat failed");
        const message = err instanceof Error ? err.message : "Unknown error";
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
    "/proxy/embeddings/:provider",
    {
      attachValidation: true,
      schema: {
        tags: ["Provider Proxy"],
        summary: "Generate embeddings through the configured provider",
        operationId: "proxyProviderEmbeddings",
        params: {
          type: "object",
          required: ["provider"],
          properties: {
            provider: { type: "string", enum: proxyProviderEnum },
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
              providerCode: { type: "string", enum: ["ollama", "lmstudio", "openai", "cloudflare"] },
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
        const message = err instanceof Error ? err.message : "Unknown error";
        return reply.code(500).send(error(message, ErrorCodes.INTERNAL_ERROR));
      }
    },
  );
};

export default proxyProviderRoute;
