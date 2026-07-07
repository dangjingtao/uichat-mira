import { FastifyPluginAsync } from "fastify";
import { generalSettingsRepository } from "@/db/repositories/general-settings.repository.js";
import { errorEnvelope, successEnvelope } from "@/routes/schema-helpers.js";
import { success } from "@/utils/index.js";
import { routeHandler } from "@/utils/route-errors.js";

const generalSettingsSchema = {
  type: "object",
  required: ["socks5Host", "socks5Port", "socks5Username", "socks5Password"],
  properties: {
    socks5Host: { type: "string" },
    socks5Port: { type: "number" },
    socks5Username: { type: "string" },
    socks5Password: { type: "string" },
  },
} as const;

const generalSettingsUpdateSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    socks5Host: { type: "string" },
    socks5Port: { type: "number" },
    socks5Username: { type: "string" },
    socks5Password: { type: "string" },
  },
} as const;

const generalSettingsRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/general-settings",
    {
      schema: {
        tags: ["General Settings"],
        summary: "Get general settings",
        description:
          "Return backend-persisted general settings used by the desktop general settings page.",
        operationId: "getGeneralSettings",
        response: {
          200: successEnvelope(generalSettingsSchema),
          500: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to get general settings", async () =>
      success(generalSettingsRepository.get())),
  );

  app.put<{
    Body: {
      socks5Host?: string;
      socks5Port?: number;
      socks5Username?: string;
      socks5Password?: string;
    };
  }>(
    "/general-settings",
    {
      schema: {
        tags: ["General Settings"],
        summary: "Update general settings",
        description:
          "Persist backend general settings. For SOCKS5 proxy, leaving host or port empty means the proxy is not active.",
        operationId: "updateGeneralSettings",
        body: generalSettingsUpdateSchema,
        response: {
          200: successEnvelope(generalSettingsSchema),
          500: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to update general settings", async (request) =>
      success(
        generalSettingsRepository.update(request.body),
        "General settings updated",
      )),
  );
};

export default generalSettingsRoute;
