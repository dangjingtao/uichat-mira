import { FastifyPluginAsync } from "fastify";
import { requireAuth } from "@/db/auth.db.js";
import { success } from "@/utils/index.js";
import { errorEnvelope, successEnvelope, userSchema } from "@/routes/schema-helpers.js";

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
          200: successEnvelope({
            type: "object",
            required: ["user"],
            properties: {
              user: userSchema,
            },
          }),
          401: errorEnvelope,
        },
      },
    },
    async (request) => success({ user: request.authUser }),
  );
};

export default meRoute;
