import { FastifyPluginAsync } from "fastify";
import { changeUserPassword, requireAuth } from "@/db/auth.db.js";
import {
  error,
  ErrorCodes,
  success,
  handleValidationError,
} from "@/utils/index.js";

type ChangePasswordBody = {
  currentPassword: string;
  newPassword: string;
};

const accountRoute: FastifyPluginAsync = async (app) => {
  app.post<{ Body: ChangePasswordBody }>(
    "/account/change-password",
    {
      preHandler: requireAuth,
      attachValidation: true,
      schema: {
        tags: ["Auth"],
        summary: "Change current user password",
        operationId: "changePassword",
        description:
          "Validate the current password and update the authenticated user's password.",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          additionalProperties: false,
          required: ["currentPassword", "newPassword"],
          properties: {
            currentPassword: { type: "string", minLength: 1 },
            newPassword: { type: "string", minLength: 6 },
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

      const authUser = request.authUser;
      const payload = request.body;

      if (!authUser) {
        return reply
          .code(401)
          .send(error("Unauthorized", ErrorCodes.UNAUTHORIZED));
      }

      if (
        !payload.currentPassword.trim() ||
        !payload.newPassword.trim() ||
        payload.currentPassword === payload.newPassword
      ) {
        return reply
          .code(400)
          .send(error("Invalid request payload", ErrorCodes.VALIDATION_ERROR));
      }

      const result = changeUserPassword(
        authUser.id,
        payload.currentPassword,
        payload.newPassword,
      );

      if (!result.ok) {
        if (result.reason === "INVALID_CURRENT_PASSWORD") {
          return reply
            .code(401)
            .send(
              error("Current password is incorrect", ErrorCodes.UNAUTHORIZED),
            );
        }

        return reply
          .code(400)
          .send(
            error(
              "New password must be different",
              ErrorCodes.VALIDATION_ERROR,
            ),
          );
      }

      return success({ user: result.user }, "Password updated successfully");
    },
  );
};

export default accountRoute;
