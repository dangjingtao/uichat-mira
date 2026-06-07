import { FastifyPluginAsync } from "fastify";
import { authenticateUser, createAccessToken } from "@/db/auth.db.js";
import { success, error, ErrorCodes } from "@/utils/index.js";

type LoginBody = {
  username: string;
  password: string;
};

const loginRoute: FastifyPluginAsync = async (app) => {
  app.post<{ Body: LoginBody }>(
    "/login",
    {
      attachValidation: true,
      schema: {
        tags: ["Auth"],
        summary: "Login and issue JWT access token",
        body: {
          type: "object",
          additionalProperties: false,
          required: ["username", "password"],
          properties: {
            username: { type: "string", minLength: 1 },
            password: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      if (request.validationError) {
        const validationError = request.validationError as {
          validation?: unknown[];
        };

        return reply
          .code(400)
          .send(
            error(
              "Invalid request payload",
              ErrorCodes.VALIDATION_ERROR,
              validationError.validation,
            ),
          );
      }

      const payload = request.body;

      if (!payload.username.trim() || !payload.password.trim()) {
        return reply
          .code(400)
          .send(error("Invalid request payload", ErrorCodes.VALIDATION_ERROR));
      }

      const found = await authenticateUser(payload.username, payload.password);

      if (!found) {
        return reply
          .code(401)
          .send(error("Invalid username or password", ErrorCodes.UNAUTHORIZED));
      }

      const token = createAccessToken(found);

      return success(
        {
          tokenType: "Bearer",
          token,
          user: found,
          expiresIn: "8h",
        },
        "Login successful",
      );
    },
  );
};

export default loginRoute;
