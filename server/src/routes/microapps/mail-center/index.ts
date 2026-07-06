import type { FastifyPluginAsync } from "fastify";
import { success } from "@/utils/index.js";
import { badRequest, notFound, routeHandler } from "@/utils/route-errors.js";
import { errorEnvelope, idParamsSchema, successEnvelope } from "@/routes/schema-helpers.js";
import type { MailAccountRecord } from "@/db/repositories/index.js";
import type {
  createMailCenterService,
  MailAccountUpsertInput,
} from "@/microapps/mail-center/index.js";

export type MailCenterRouteService = ReturnType<typeof createMailCenterService>;

const routeAccountSchema = {
  type: "object",
  required: [
    "id",
    "name",
    "emailAddress",
    "smtpHost",
    "smtpPort",
    "smtpSecure",
    "smtpUsername",
    "hasSmtpPassword",
    "imapHost",
    "imapPort",
    "imapSecure",
    "imapUsername",
    "hasImapPassword",
    "inboxFolderPath",
    "status",
    "lastError",
    "lastSyncedAt",
    "isDefault",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    emailAddress: { type: "string" },
    smtpHost: { type: "string" },
    smtpPort: { type: "number" },
    smtpSecure: { type: "boolean" },
    smtpUsername: { type: "string" },
    hasSmtpPassword: { type: "boolean" },
    imapHost: { type: "string" },
    imapPort: { type: "number" },
    imapSecure: { type: "boolean" },
    imapUsername: { type: "string" },
    hasImapPassword: { type: "boolean" },
    inboxFolderPath: { type: "string" },
    status: { type: "string", enum: ["idle", "connected", "error"] },
    lastError: { type: ["string", "null"] },
    lastSyncedAt: { type: ["string", "null"] },
    isDefault: { type: "boolean" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
} as const;

const inboxMessageSchema = {
  type: "object",
  required: [
    "id",
    "remoteUid",
    "messageId",
    "subject",
    "fromDisplay",
    "fromAddress",
    "previewText",
    "sentAt",
    "receivedAt",
    "isRead",
    "isFlagged",
    "hasAttachments",
  ],
  properties: {
    id: { type: "string" },
    remoteUid: { type: "number" },
    messageId: { type: ["string", "null"] },
    subject: { type: "string" },
    fromDisplay: { type: "string" },
    fromAddress: { type: "string" },
    previewText: { type: "string" },
    sentAt: { type: ["string", "null"] },
    receivedAt: { type: ["string", "null"] },
    isRead: { type: "boolean" },
    isFlagged: { type: "boolean" },
    hasAttachments: { type: "boolean" },
  },
} as const;

const accountBodySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "name",
    "emailAddress",
    "smtpHost",
    "smtpPort",
    "smtpSecure",
    "smtpUsername",
    "imapHost",
    "imapPort",
    "imapSecure",
    "imapUsername",
  ],
  properties: {
    name: { type: "string" },
    emailAddress: { type: "string" },
    smtpHost: { type: "string" },
    smtpPort: { type: "number" },
    smtpSecure: { type: "boolean" },
    smtpUsername: { type: "string" },
    smtpPassword: { type: "string" },
    imapHost: { type: "string" },
    imapPort: { type: "number" },
    imapSecure: { type: "boolean" },
    imapUsername: { type: "string" },
    imapPassword: { type: "string" },
    inboxFolderPath: { type: "string" },
    isDefault: { type: "boolean" },
  },
} as const;

const mapRouteAccount = (account: MailAccountRecord) => ({
  id: account.id,
  name: account.name,
  emailAddress: account.emailAddress,
  smtpHost: account.smtpHost,
  smtpPort: account.smtpPort,
  smtpSecure: account.smtpSecure,
  smtpUsername: account.smtpUsername,
  hasSmtpPassword: Boolean(account.smtpPassword),
  imapHost: account.imapHost,
  imapPort: account.imapPort,
  imapSecure: account.imapSecure,
  imapUsername: account.imapUsername,
  hasImapPassword: Boolean(account.imapPassword),
  inboxFolderPath: account.inboxFolderPath,
  status: account.status,
  lastError: account.lastError,
  lastSyncedAt: account.lastSyncedAt,
  isDefault: account.isDefault,
  createdAt: account.createdAt,
  updatedAt: account.updatedAt,
});

const toAccountInput = (
  body: Record<string, unknown>,
): MailAccountUpsertInput => ({
  name: String(body.name ?? ""),
  emailAddress: String(body.emailAddress ?? ""),
  smtpHost: String(body.smtpHost ?? ""),
  smtpPort: Number(body.smtpPort ?? 0),
  smtpSecure: Boolean(body.smtpSecure),
  smtpUsername: String(body.smtpUsername ?? ""),
  smtpPassword:
    typeof body.smtpPassword === "string" ? body.smtpPassword : undefined,
  imapHost: String(body.imapHost ?? ""),
  imapPort: Number(body.imapPort ?? 0),
  imapSecure: Boolean(body.imapSecure),
  imapUsername: String(body.imapUsername ?? ""),
  imapPassword:
    typeof body.imapPassword === "string" ? body.imapPassword : undefined,
  inboxFolderPath:
    typeof body.inboxFolderPath === "string" ? body.inboxFolderPath : undefined,
  isDefault:
    typeof body.isDefault === "boolean" ? body.isDefault : undefined,
});

const mailCenterRoutes: FastifyPluginAsync<{
  mailCenterService: MailCenterRouteService;
}> = async (app, options) => {
  const { mailCenterService } = options;
  if (!mailCenterService) {
    throw new Error("mailCenterRoutes requires mailCenterService");
  }

  app.get<{
    Querystring: { accountId?: string };
  }>(
    "/microapps/mail-center/overview",
    {
      schema: {
        tags: ["Tools"],
        summary: "Get mail center overview",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            accountId: { type: "string" },
          },
        },
        response: {
          200: successEnvelope({
            type: "object",
            required: ["accounts", "selectedAccountId", "inbox"],
            properties: {
              accounts: {
                type: "array",
                items: routeAccountSchema,
              },
              selectedAccountId: { type: ["string", "null"] },
              inbox: {
                anyOf: [
                  { type: "null" },
                  {
                    type: "object",
                    required: [
                      "messageCount",
                      "unreadCount",
                      "lastSyncedAt",
                      "syncStatus",
                      "lastError",
                      "messages",
                    ],
                    properties: {
                      messageCount: { type: "number" },
                      unreadCount: { type: "number" },
                      lastSyncedAt: { type: ["string", "null"] },
                      syncStatus: {
                        type: "string",
                        enum: ["idle", "syncing", "succeeded", "failed"],
                      },
                      lastError: { type: ["string", "null"] },
                      messages: {
                        type: "array",
                        items: inboxMessageSchema,
                      },
                    },
                  },
                ],
              },
            },
          }),
          401: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to get mail center overview", async (request) => {
      const overview = mailCenterService.getOverview(
        request.authUser!.id,
        request.query.accountId?.trim() || undefined,
      );

      return success({
        accounts: overview.accounts.map(mapRouteAccount),
        selectedAccountId: overview.selectedAccountId,
        inbox: overview.inbox,
      });
    }),
  );

  app.post<{
    Body: Record<string, unknown>;
  }>(
    "/microapps/mail-center/accounts",
    {
      schema: {
        tags: ["Tools"],
        summary: "Create a mail account",
        security: [{ bearerAuth: [] }],
        body: accountBodySchema,
        response: {
          200: successEnvelope({
            type: "object",
            required: ["account"],
            properties: {
              account: routeAccountSchema,
            },
          }),
          400: errorEnvelope,
          401: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to save mail account", async (request) => {
      try {
        const account = mailCenterService.saveAccount(
          request.authUser!.id,
          toAccountInput(request.body),
        );
        return success({ account: mapRouteAccount(account) });
      } catch (error) {
        throw badRequest(error instanceof Error ? error.message : "Invalid mail account config", {
          cause: error,
        });
      }
    }),
  );

  app.patch<{
    Params: { id: string };
    Body: Record<string, unknown>;
  }>(
    "/microapps/mail-center/accounts/:id",
    {
      schema: {
        tags: ["Tools"],
        summary: "Update a mail account",
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        body: accountBodySchema,
        response: {
          200: successEnvelope({
            type: "object",
            required: ["account"],
            properties: {
              account: routeAccountSchema,
            },
          }),
          400: errorEnvelope,
          401: errorEnvelope,
          404: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to update mail account", async (request) => {
      try {
        const account = mailCenterService.saveAccount(
          request.authUser!.id,
          toAccountInput(request.body),
          request.params.id,
        );
        if (!account) {
          throw notFound(`Mail account not found: ${request.params.id}`);
        }
        return success({ account: mapRouteAccount(account) });
      } catch (error) {
        if (error instanceof Error && error.message === `Mail account not found: ${request.params.id}`) {
          throw notFound(error.message, { cause: error });
        }
        throw badRequest(error instanceof Error ? error.message : "Invalid mail account config", {
          cause: error,
        });
      }
    }),
  );

  app.post<{
    Params: { id: string };
    Body: {
      to?: string;
      subject?: string;
      content?: string;
    };
  }>(
    "/microapps/mail-center/accounts/:id/test-send",
    {
      schema: {
        tags: ["Tools"],
        summary: "Send a test mail for the account",
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            to: { type: "string" },
            subject: { type: "string" },
            content: { type: "string" },
          },
        },
        response: {
          200: successEnvelope({
            type: "object",
            required: ["accountId", "accepted", "rejected", "response", "messageId", "target"],
            properties: {
              accountId: { type: "string" },
              accepted: { type: "array", items: { type: "string" } },
              rejected: { type: "array", items: { type: "string" } },
              response: { type: "string" },
              messageId: { type: "string" },
              target: { type: "string" },
            },
          }),
          400: errorEnvelope,
          401: errorEnvelope,
          404: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to send mail test message", async (request) => {
      try {
        const result = await mailCenterService.sendTestMail(
          request.authUser!.id,
          request.params.id,
          request.body ?? {},
        );
        return success(result);
      } catch (error) {
        if (error instanceof Error && error.message === `Mail account not found: ${request.params.id}`) {
          throw notFound(error.message, { cause: error });
        }
        throw badRequest(error instanceof Error ? error.message : "Failed to send test mail", {
          cause: error,
        });
      }
    }),
  );

  app.post<{
    Params: { id: string };
  }>(
    "/microapps/mail-center/accounts/:id/sync-inbox",
    {
      schema: {
        tags: ["Tools"],
        summary: "Sync recent inbox messages",
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        response: {
          200: successEnvelope({
            type: "object",
            required: [
              "accountId",
              "messageCount",
              "unreadCount",
              "syncedCount",
              "lastSyncedAt",
              "messages",
            ],
            properties: {
              accountId: { type: "string" },
              messageCount: { type: "number" },
              unreadCount: { type: "number" },
              syncedCount: { type: "number" },
              lastSyncedAt: { type: "string" },
              messages: {
                type: "array",
                items: inboxMessageSchema,
              },
            },
          }),
          400: errorEnvelope,
          401: errorEnvelope,
          404: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to sync inbox", async (request) => {
      try {
        const result = await mailCenterService.syncInbox(
          request.authUser!.id,
          request.params.id,
        );
        return success(result);
      } catch (error) {
        if (error instanceof Error && error.message === `Mail account not found: ${request.params.id}`) {
          throw notFound(error.message, { cause: error });
        }
        throw badRequest(error instanceof Error ? error.message : "Failed to sync inbox", {
          cause: error,
        });
      }
    }),
  );
};

export default mailCenterRoutes;
