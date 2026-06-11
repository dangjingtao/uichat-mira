import { FastifyPluginAsync } from "fastify";
import { changeUserPassword, requireAuth } from "@/db/auth.db.js";
import { successEnvelope, errorEnvelope, userSchema } from "@/routes/schema-helpers.js";
import {
  error,
  ErrorCodes,
  success,
  handleValidationError,
  INVALID_REQUEST_PAYLOAD_MESSAGE,
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
          200: successEnvelope({
            type: "object",
            required: ["user"],
            properties: {
              user: userSchema,
            },
          }),
          400: errorEnvelope,
          401: errorEnvelope,
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
          .send(
            error(
              INVALID_REQUEST_PAYLOAD_MESSAGE,
              ErrorCodes.VALIDATION_ERROR,
            ),
          );
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
