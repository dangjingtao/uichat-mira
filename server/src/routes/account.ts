import { FastifyPluginAsync } from "fastify";
import { changeUserPassword, requireAuth } from "@/db/auth.db.js";
import { successEnvelope, errorEnvelope, userSchema } from "@/routes/schema-helpers.js";
import {
  success,
  handleValidationError,
  INVALID_REQUEST_PAYLOAD_MESSAGE,
} from "@/utils/index.js";
import {
  badRequest,
  routeHandler,
  unauthorized,
} from "@/utils/route-errors.js";

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
    routeHandler("Failed to change password", async (request, reply) => {
      const validationResponse = handleValidationError(request, reply);
      if (validationResponse) {
        return validationResponse;
      }

      const authUser = request.authUser;
      const payload = request.body;

      if (!authUser) {
        throw unauthorized("Unauthorized");
      }

      if (
        !payload.currentPassword.trim() ||
        !payload.newPassword.trim() ||
        payload.currentPassword === payload.newPassword
      ) {
        throw badRequest(INVALID_REQUEST_PAYLOAD_MESSAGE);
      }

      const result = changeUserPassword(
        authUser.id,
        payload.currentPassword,
        payload.newPassword,
      );

      if (!result.ok) {
        if (result.reason === "INVALID_CURRENT_PASSWORD") {
          throw unauthorized("Current password is incorrect");
        }

        throw badRequest("New password must be different");
      }

      return success({ user: result.user }, "Password updated successfully");
    }),
  );
};

export default accountRoute;
