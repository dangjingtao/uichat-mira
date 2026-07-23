import type { McpInvocationContext, McpToolImplementation } from "../core/definitions.js";
import { mcpBadRequest } from "../core/errors.js";
import {
  externalExpertService,
  type ExternalExpertAction,
  type ExternalExpertConversation,
  type ExternalExpertService,
} from "@/microapps/external-expert/index.js";

type ExternalExpertConsultationService = Pick<ExternalExpertService, "ask">;

const conversationSchema = {
  oneOf: [
    { type: "string", enum: ["new"] },
    {
      type: "object",
      required: ["conversationId"],
      properties: {
        conversationId: { type: "string" },
      },
      additionalProperties: false,
    },
  ],
} as const;

const askExternalExpertInputSchema = {
  type: "object",
  required: ["action", "provider"],
  properties: {
    action: {
      type: "string",
      enum: ["ask", "continue", "new_conversation"],
      description:
        "ask uses the current expert conversation, continue resumes the supplied conversationId, and new_conversation opens a fresh provider conversation.",
    },
    provider: {
      type: "string",
      enum: ["chatgpt", "kimi", "deepseek"],
      description: "Registered external expert provider.",
    },
    question: {
      type: "string",
      description: "Question sent to the external expert. Required for ask and continue.",
    },
    conversation: conversationSchema,
  },
  additionalProperties: false,
} as const;

const isAction = (value: unknown): value is ExternalExpertAction =>
  value === "ask" || value === "continue" || value === "new_conversation";

const normalizeConversation = (value: unknown): ExternalExpertConversation | undefined => {
  if (value === undefined) return undefined;
  if (value === "new") return "new";
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).conversationId === "string"
  ) {
    return {
      conversationId: (value as Record<string, string>).conversationId,
    };
  }
  throw mcpBadRequest("conversation must be new or an object with conversationId");
};

export const createAskExternalExpertTool = (
  service: ExternalExpertConsultationService = externalExpertService,
): McpToolImplementation => ({
  definition: {
    id: "ask_external_expert",
    title: "Ask External Expert",
    description:
      "Ask a user's signed-in ChatGPT, Kimi, or DeepSeek web expert for advice. The reply is evidence for Mira; the external expert cannot execute Mira tools.",
    domain: "external_expert",
    source: "internal",
    mode: "sync",
    inputSchema: askExternalExpertInputSchema,
    tags: [
      "external-expert",
      "expert-advice",
      "ask",
      "consult",
      "chatgpt",
      "kimi",
      "deepseek",
      "问策",
      "专家",
    ],
    outputSchema: {
      type: "object",
      required: ["answer", "provider", "conversationId", "status", "latencyMs"],
      properties: {
        answer: { type: "string" },
        provider: { type: "string", enum: ["chatgpt", "kimi", "deepseek"] },
        conversationId: {
          oneOf: [{ type: "string" }, { type: "null" }],
        },
        status: { type: "string", enum: ["completed", "ready"] },
        latencyMs: { type: "number" },
      },
    },
    capabilities: {
      sideEffect: "network",
      requiresApproval: false,
      networkAccess: true,
      longRunning: true,
    },
  },
  execute: async (context: McpInvocationContext) => {
    if (context.userId === undefined || !Number.isInteger(context.userId)) {
      throw mcpBadRequest(
        "External Expert requires a trusted authenticated user context",
      );
    }

    const action = context.args.action;
    if (!isAction(action)) {
      throw mcpBadRequest("action must be ask, continue, or new_conversation");
    }

    const provider = context.args.provider;
    if (typeof provider !== "string") {
      throw mcpBadRequest("provider is required");
    }

    const question = context.args.question;
    if (question !== undefined && typeof question !== "string") {
      throw mcpBadRequest("question must be a string");
    }

    const result = await service.ask({
      userId: context.userId,
      action,
      provider,
      ...(question !== undefined ? { question } : {}),
      ...(context.args.conversation !== undefined
        ? { conversation: normalizeConversation(context.args.conversation) }
        : {}),
      signal: context.signal,
    });

    return {
      result,
      evidence: {
        actionTaken:
          result.status === "ready"
            ? `Opened a new ${result.provider} expert conversation.`
            : `Received advice from the ${result.provider} external expert.`,
        facts: [
          "tool=ask_external_expert",
          `provider=${result.provider}`,
          `status=${result.status}`,
          `conversationId=${result.conversationId ?? "none"}`,
          `latencyMs=${result.latencyMs}`,
        ],
        status: "completed",
        data: result,
      },
    };
  },
});

export const askExternalExpertTool = createAskExternalExpertTool();
