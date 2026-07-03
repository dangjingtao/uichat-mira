import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "@/db/auth.db.js";
import { success } from "@/utils/index.js";
import { successEnvelope, errorEnvelope, idParamsSchema } from "@/routes/schema-helpers.js";
import { routeHandler, badRequest } from "@/utils/route-errors.js";
import { wecomIdentityBindingsRepository } from "@/db/repositories/wecom-identity-bindings.repository.js";
import {
  bindWecomUserToUser,
  getBoundWecomUserForUser,
} from "@/integrations/wecom/bind-store.js";
import { startWecomOAuthRelay, pollWecomOAuthRelay } from "@/integrations/wecom/bind-relay.js";
import { getWecomUserByUserId } from "@/integrations/wecom/client.js";
import { resolveWecomConfig } from "@/integrations/wecom/config.js";
import {
  sendWecomRobotMarkdownMessage,
  sendWecomRobotTextMessage,
  sendWecomRobotTestMessageByCapability,
} from "@/integrations/wecom/robot.js";
import { hasWecomSmartRobotConfig } from "@/integrations/wecom/config.js";
import {
  getSmartRobotStatus,
  startWecomSmartRobot,
  stopWecomSmartRobot,
} from "@/integrations/wecom/smart-robot.js";

const wecomRoute: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get(
    "/integrations/wecom/status",
    {
      schema: {
        tags: ["Tools"],
        summary: "Get WeCom integration status",
        response: {
          200: successEnvelope({
            type: "object",
            required: ["config", "binding", "smartRobot"],
            properties: {
              config: {
                type: "object",
                required: [
                  "corpId",
                  "agentId",
                  "hasAppSecret",
                  "hasContactsSecret",
                  "hasRobotWebhook",
                  "hasSmartRobot",
                ],
                properties: {
                  corpId: { type: "string" },
                  agentId: { type: "string" },
                  hasAppSecret: { type: "boolean" },
                  hasContactsSecret: { type: "boolean" },
                  hasRobotWebhook: { type: "boolean" },
                  hasSmartRobot: { type: "boolean" },
                },
              },
              smartRobot: {
                type: "object",
                required: [
                  "enabled",
                  "status",
                  "botId",
                  "hasSecret",
                  "lastError",
                  "lastConnectedAt",
                ],
                properties: {
                  enabled: { type: "boolean" },
                  status: { type: "string" },
                  botId: { type: "string" },
                  hasSecret: { type: "boolean" },
                  lastError: { type: ["string", "null"] },
                  lastConnectedAt: { type: ["string", "null"] },
                },
              },
              binding: {
                type: "object",
                required: ["bound"],
                properties: {
                  bound: { type: "boolean" },
                  externalUserId: { type: "string" },
                  bindSource: { type: "string" },
                },
              },
            },
          }),
          401: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to get WeCom status", async (request) => {
      const config = resolveWecomConfig();
      const binding = wecomIdentityBindingsRepository.getByUserId(
        request.authUser!.id,
      );

      return success({
        config: {
          corpId: config.corpId,
          agentId: config.agentId,
          hasAppSecret: Boolean(config.appSecret),
          hasContactsSecret: Boolean(config.contactsSecret),
          hasRobotWebhook: Boolean(config.robotWebhookUrl),
          hasSmartRobot: hasWecomSmartRobotConfig(),
        },
        smartRobot: getSmartRobotStatus(),
        binding: binding
          ? {
              bound: true,
              externalUserId: binding.externalUserId,
              bindSource: binding.bindSource,
            }
          : {
              bound: false,
            },
      });
    }),
  );

  app.post<{
    Params: { id: string };
    Body: {
      title?: string;
      content: string;
      mentionAll?: boolean;
      mentionedUserIds?: string[];
      format?: "markdown" | "text";
    };
  }>(
    "/integrations/wecom/capabilities/:id/test/send-message",
    {
      schema: {
        tags: ["Tools"],
        summary: "Send a WeCom webhook capability test message",
        params: idParamsSchema,
        body: {
          type: "object",
          additionalProperties: false,
          required: ["content"],
          properties: {
            title: { type: "string" },
            content: { type: "string" },
            mentionAll: { type: "boolean" },
            mentionedUserIds: {
              type: "array",
              items: { type: "string" },
            },
            format: {
              type: "string",
              enum: ["markdown", "text"],
            },
          },
        },
        response: {
          200: successEnvelope({
            type: "object",
            required: ["success", "target", "summary"],
            properties: {
              success: { type: "boolean" },
              target: { type: "string" },
              summary: { type: "string" },
            },
          }),
          401: errorEnvelope,
          404: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to send WeCom webhook capability test message", async (request) => {
      const content = request.body.content?.trim();
      if (!content) {
        throw badRequest("content is required");
      }

      await sendWecomRobotTestMessageByCapability(request.params.id, {
        title: request.body.title?.trim(),
        content,
        mentionAll: request.body.mentionAll,
        mentionedUserIds: request.body.mentionedUserIds,
        format: request.body.format,
      });

      return success({
        success: true,
        target: "webhook-capability",
        summary: "WeCom webhook capability test message sent",
      });
    }),
  );

  app.post<{
    Body: {
      title?: string;
      content: string;
      mentionAll?: boolean;
      mentionedUserIds?: string[];
      format?: "markdown" | "text";
    };
  }>(
    "/integrations/wecom/test/send-message",
    {
      schema: {
        tags: ["Tools"],
        summary: "Send a WeCom robot test message",
        body: {
          type: "object",
          additionalProperties: false,
          required: ["content"],
          properties: {
            title: { type: "string" },
            content: { type: "string" },
            mentionAll: { type: "boolean" },
            mentionedUserIds: {
              type: "array",
              items: { type: "string" },
            },
            format: {
              type: "string",
              enum: ["markdown", "text"],
            },
          },
        },
        response: {
          200: successEnvelope({
            type: "object",
            required: ["success", "target", "summary"],
            properties: {
              success: { type: "boolean" },
              target: { type: "string" },
              summary: { type: "string" },
            },
          }),
          401: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to send WeCom robot test message", async (request) => {
      const content = request.body.content?.trim();
      if (!content) {
        throw badRequest("content is required");
      }

      const format = request.body.format ?? "markdown";
      if (format === "text") {
        await sendWecomRobotTextMessage({
          content,
          mentionAll: request.body.mentionAll,
          mentionedUserIds: request.body.mentionedUserIds,
        });
      } else {
        await sendWecomRobotMarkdownMessage({
          title: request.body.title?.trim() || "WeCom test message",
          content,
        });
      }

      return success({
        success: true,
        target: "robot-webhook",
        summary: "WeCom robot test message sent",
      });
    }),
  );

  app.get(
    "/integrations/wecom/smart-robot/status",
    {
      schema: {
        tags: ["Tools"],
        summary: "Get WeCom smart robot connection status",
        response: {
          200: successEnvelope({
            type: "object",
            required: [
              "enabled",
              "status",
              "botId",
              "hasSecret",
              "lastError",
              "lastConnectedAt",
            ],
            properties: {
              enabled: { type: "boolean" },
              status: { type: "string" },
              botId: { type: "string" },
              hasSecret: { type: "boolean" },
              lastError: { type: ["string", "null"] },
              lastConnectedAt: { type: ["string", "null"] },
            },
          }),
          401: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to get WeCom smart robot status", async () =>
      success(getSmartRobotStatus()),
    ),
  );

  app.post(
    "/integrations/wecom/smart-robot/start",
    {
      schema: {
        tags: ["Tools"],
        summary: "Start WeCom smart robot connection",
        response: {
          200: successEnvelope({
            type: "object",
            required: [
              "enabled",
              "status",
              "botId",
              "hasSecret",
              "lastError",
              "lastConnectedAt",
            ],
            properties: {
              enabled: { type: "boolean" },
              status: { type: "string" },
              botId: { type: "string" },
              hasSecret: { type: "boolean" },
              lastError: { type: ["string", "null"] },
              lastConnectedAt: { type: ["string", "null"] },
            },
          }),
          401: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to start WeCom smart robot", async () =>
      success(await startWecomSmartRobot()),
    ),
  );

  app.post(
    "/integrations/wecom/smart-robot/stop",
    {
      schema: {
        tags: ["Tools"],
        summary: "Stop WeCom smart robot connection",
        response: {
          200: successEnvelope({
            type: "object",
            required: [
              "enabled",
              "status",
              "botId",
              "hasSecret",
              "lastError",
              "lastConnectedAt",
            ],
            properties: {
              enabled: { type: "boolean" },
              status: { type: "string" },
              botId: { type: "string" },
              hasSecret: { type: "boolean" },
              lastError: { type: ["string", "null"] },
              lastConnectedAt: { type: ["string", "null"] },
            },
          }),
          401: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to stop WeCom smart robot", async () =>
      success(stopWecomSmartRobot()),
    ),
  );

  app.post<{
    Body: {
      externalUserId: string;
      externalUnionId?: string;
      bindSource?: "manual" | "oauth";
    };
  }>(
    "/integrations/wecom/bind/manual",
    {
      schema: {
        tags: ["Tools"],
        summary: "Bind current user to a WeCom userid manually",
        response: {
          200: successEnvelope({
            type: "object",
            properties: {
              bound: { type: "boolean" },
              externalUserId: { type: "string" },
              bindSource: { type: "string" },
            },
          }),
          401: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to bind WeCom user", async (request) => {
      const externalUserId = request.body.externalUserId?.trim();
      if (!externalUserId) {
        throw badRequest("externalUserId is required");
      }

      const user = await getWecomUserByUserId(externalUserId);
      const binding = wecomIdentityBindingsRepository.upsertByUserId({
        userId: request.authUser!.id,
        externalUserId,
        externalUnionId: request.body.externalUnionId ?? null,
        bindSource: request.body.bindSource ?? "manual",
      });
      bindWecomUserToUser(request.authUser!.id, binding.externalUserId);

      return success({
        bound: true,
        externalUserId: binding.externalUserId,
        bindSource: binding.bindSource,
        user: {
          userid: user.userid ?? externalUserId,
          name: user.name ?? "",
          department: user.department ?? [],
        },
      });
    }),
  );

  app.get(
    "/integrations/wecom/bind/me",
    {
      schema: {
        tags: ["Tools"],
        summary: "Get current user's WeCom binding",
        response: {
          200: successEnvelope({
            type: "object",
            properties: {
              bound: { type: "boolean" },
            },
          }),
          401: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to get WeCom binding", async (request) => {
      const binding = wecomIdentityBindingsRepository.getByUserId(
        request.authUser!.id,
      );
      const boundUserId = getBoundWecomUserForUser(request.authUser!.id);
      return success(
        binding
          ? {
              bound: true,
              externalUserId: binding.externalUserId,
              externalUnionId: binding.externalUnionId,
              bindSource: binding.bindSource,
              threadBoundUserId: boundUserId,
            }
          : { bound: false, threadBoundUserId: boundUserId },
      );
    }),
  );

  app.delete(
    "/integrations/wecom/bind/me",
    {
      schema: {
        tags: ["Tools"],
        summary: "Unbind current user's WeCom binding",
        response: {
          200: successEnvelope({
            type: "object",
            properties: {
              deleted: { type: "boolean" },
            },
          }),
          401: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to unbind WeCom user", async (request) => {
      const deleted = wecomIdentityBindingsRepository.deleteByUserId(
        request.authUser!.id,
      );
      return success({ deleted: deleted > 0 });
    }),
  );

  app.post(
    "/integrations/wecom/bind/oauth/start",
    {
      schema: {
        tags: ["Tools"],
        summary: "Start WeCom OAuth relay binding",
        response: {
          200: successEnvelope({
            type: "object",
            properties: {
              authorizeUrl: { type: "string" },
              ticket: { type: "string" },
            },
          }),
          401: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to start WeCom OAuth binding", async () =>
      success(await startWecomOAuthRelay()),
    ),
  );

  app.post<{
    Body: {
      ticket: string;
    };
  }>(
    "/integrations/wecom/bind/oauth/poll",
    {
      schema: {
        tags: ["Tools"],
        summary: "Poll WeCom OAuth relay binding result",
        response: {
          200: successEnvelope({
            type: "object",
            properties: {
              status: { type: "string" },
              ticket: { type: "string" },
              userid: { type: "string" },
              externalUnionId: { type: "string" },
              bindSource: { type: "string" },
            },
          }),
          401: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to poll WeCom OAuth binding", async (request) => {
      const ticket = request.body.ticket?.trim();
      if (!ticket) {
        throw badRequest("ticket is required");
      }

      const result = await pollWecomOAuthRelay(ticket);
      if (result.status === "ready" && result.userid) {
        const binding = wecomIdentityBindingsRepository.upsertByUserId({
          userId: request.authUser!.id,
          externalUserId: result.userid,
          externalUnionId: result.externalUnionId ?? null,
          bindSource: "oauth",
        });
        bindWecomUserToUser(request.authUser!.id, binding.externalUserId);

        return success({
          status: result.status,
          ticket: result.ticket,
          userid: binding.externalUserId,
          externalUnionId: binding.externalUnionId,
          bindSource: binding.bindSource,
        });
      }

      return success({
        status: result.status,
        ticket: result.ticket,
        userid: result.userid ?? null,
        externalUnionId: result.externalUnionId ?? null,
        bindSource: "oauth",
      });
    }),
  );
};

export default wecomRoute;
