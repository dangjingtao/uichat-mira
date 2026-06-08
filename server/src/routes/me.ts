import { FastifyPluginAsync } from "fastify";
import { requireAuth } from "@/db/auth.db.js";
import { success } from "@/utils/index.js";

const meRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/me",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["Auth"],
        summary: "Get current authenticated user",
        operationId: "getMe",
        description: "Return the authenticated user associated with the bearer token.",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            required: ["success", "data", "timestamp"],
            properties: {
              success: { type: "boolean", const: true },
              data: {
                type: "object",
                required: ["user"],
                properties: {
                  user: {
                    type: "object",
                    required: ["id", "username", "role"],
                    properties: {
                      id: { type: "number" },
                      username: { type: "string" },
                      role: { type: "string", enum: ["admin", "user"] },
                    },
                  },
                },
              },
              message: { type: "string" },
              timestamp: { type: "string", format: "date-time" },
            },
          },
          401: {
            type: "object",
            properties: {
              ok: { type: "boolean" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request) => success({ user: request.authUser }),
  );
};

export default meRoute;
