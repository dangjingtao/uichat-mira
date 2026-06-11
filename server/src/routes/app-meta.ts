import type { FastifyPluginAsync } from "fastify";
import { success, getAppMeta } from "@/utils/index.js";
import { successEnvelope } from "@/routes/schema-helpers.js";

const appMetaRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/app/meta",
    {
      schema: {
        tags: ["System"],
        summary: "Application metadata",
        operationId: "getAppMeta",
        response: {
          200: successEnvelope({
            type: "object",
            required: ["name", "version"],
            properties: {
              name: { type: "string" },
              version: { type: "string" },
            },
          }),
        },
      },
    },
    async () => success(getAppMeta()),
  );
};

export default appMetaRoute;
