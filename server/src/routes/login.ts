import { FastifyPluginAsync } from "fastify";
import { authenticateUser, createAccessToken } from "@/db/auth.db.js";
import {
  success,
  error,
  ErrorCodes,
  handleValidationError,
} from "@/utils/index.js";

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
        operationId: "login",
        description:
          "Authenticate a local user and return a JWT access token for subsequent API requests.",
        body: {
          type: "object",
          additionalProperties: false,
          required: ["username", "password"],
          properties: {
            username: { type: "string", minLength: 1 },
            password: { type: "string", minLength: 1 },
          },
        },
        response: {
          200: {
            type: "object",
            required: ["success", "data", "timestamp"],
            properties: {
              success: { type: "boolean", const: true },
              data: {
                type: "object",
                required: ["tokenType", "token", "user", "expiresIn"],
                properties: {
                  tokenType: { type: "string" },
                  token: { type: "string" },
                  expiresIn: { type: "string" },
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
          400: {
            type: "object",
            required: ["success", "message", "timestamp"],
            properties: {
              success: { type: "boolean", const: false },
              message: { type: "string" },
              code: { type: "string" },
              errors: { type: "array", items: {} },
              timestamp: { type: "string", format: "date-time" },
            },
          },
          401: {
            type: "object",
            required: ["success", "message", "timestamp"],
            properties: {
              success: { type: "boolean", const: false },
              message: { type: "string" },
              code: { type: "string" },
              timestamp: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const validationResponse = handleValidationError(request, reply);
      if (validationResponse) {
        return validationResponse;
      }

      const payload = request.body;

      if (!payload.username.trim() || !payload.password.trim()) {
        return reply
          .code(400)
          .send(error("Invalid request payload", ErrorCodes.VALIDATION_ERROR));
      }

      const found = authenticateUser(payload.username, payload.password);

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
