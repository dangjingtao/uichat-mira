import { FastifyPluginAsync } from "fastify";
import { authenticateUser, createAccessToken } from "@/db/auth.db";

type LoginBody = {
  user: string;
  password: string;
};

const loginRoute: FastifyPluginAsync = async (app) => {
  app.post<{ Body: LoginBody }>(
    "/api/login",
    {
      attachValidation: true,
      schema: {
        tags: ["Auth"],
        summary: "Login and issue JWT access token",
        body: {
          type: "object",
          additionalProperties: false,
          required: ["user", "password"],
          properties: {
            user: { type: "string", minLength: 1 },
            password: { type: "string", minLength: 1 },
          },
        },
        response: {
          200: {
            type: "object",
            required: ["ok", "tokenType", "token", "user", "expiresIn"],
            properties: {
              ok: { type: "boolean", const: true },
              tokenType: { type: "string", const: "Bearer" },
              token: { type: "string" },
              expiresIn: { type: "string", const: "8h" },
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
          400: {
            type: "object",
            required: ["ok", "message"],
            properties: {
              ok: { type: "boolean", const: false },
              message: { type: "string" },
              issues: {
                type: "array",
                items: { type: "object", additionalProperties: true },
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
    async (request, reply) => {
      if (request.validationError) {
        const validationError = request.validationError as {
          validation?: unknown[];
        };

        return reply.code(400).send({
          ok: false,
          message: "Invalid request payload",
          issues: validationError.validation ?? [],
        });
      }

      const payload = request.body;

      if (!payload.user.trim() || !payload.password.trim()) {
        return reply.code(400).send({
          ok: false,
          message: "Invalid request payload",
        });
      }

      const found = await authenticateUser(payload.user, payload.password);

      if (!found) {
        return reply.code(401).send({
          ok: false,
          message: "Invalid username or password",
        });
      }

      const token = createAccessToken(found);

      return {
        ok: true,
        tokenType: "Bearer",
        token,
        user: found,
        expiresIn: "8h",
      };
    },
  );
};

export default loginRoute;
