import { FastifyPluginAsync } from "fastify";
import { authenticateUser, createAccessToken } from "@/db/auth.db.js";
import { successEnvelope, errorEnvelope, userSchema } from "@/routes/schema-helpers.js";
import {
  success,
  handleValidationError,
  INVALID_REQUEST_PAYLOAD_MESSAGE,
} from "@/utils/index.js";
import { badRequest, routeHandler, unauthorized } from "@/utils/route-errors.js";

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
          200: successEnvelope({
            type: "object",
            required: ["tokenType", "token", "user", "expiresIn"],
            properties: {
              tokenType: { type: "string" },
              token: { type: "string" },
              expiresIn: { type: "string" },
              user: userSchema,
            },
          }),
          400: errorEnvelope,
          401: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to login", async (request, reply) => {
      const validationResponse = handleValidationError(request, reply);
      if (validationResponse) {
        return validationResponse;
      }

      const payload = request.body;

      if (!payload.username.trim() || !payload.password.trim()) {
        throw badRequest(INVALID_REQUEST_PAYLOAD_MESSAGE);
      }

      const found = authenticateUser(payload.username, payload.password);

      if (!found) {
        throw unauthorized("Invalid username or password");
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
    }),
  );
};

export default loginRoute;
