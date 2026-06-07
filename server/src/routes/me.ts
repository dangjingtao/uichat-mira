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
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => success({ user: request.authUser }),
  );
};

export default meRoute;
