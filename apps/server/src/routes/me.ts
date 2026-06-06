import { FastifyPluginAsync } from "fastify";
import { requireAuth } from "@/db/auth.db";

const meRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/api/me",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["Auth"],
        summary: "Get current authenticated user",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            required: ["ok", "user"],
            properties: {
              ok: { type: "boolean", const: true },
              user: {
                type: "object",
                required: ["id", "username", "role"],
                properties: {
                  id: { type: "integer" },
                  username: { type: "string" },
                  role: { type: "string", enum: ["admin", "user"] },
                },
              },
            },
          },
          401: {
            type: "object",
            required: ["ok", "message"],
            properties: {
              ok: { type: "boolean", const: false },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request) => ({
      ok: true,
      user: request.authUser,
    }),
  );
};

export default meRoute;
