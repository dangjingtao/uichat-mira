import type { FastifyInstance } from "fastify";
import { providerSettingsService } from "@/services/provider-settings.service.js";
import {
  FAILED_SELECT_DEFAULT_MODEL_MESSAGE,
  getErrorMessage,
  success,
} from "@/utils/index.js";
import { createRouteError, routeHandler } from "@/utils/route-errors.js";
import { providerSettingsRouteSchemas } from "./schemas.js";
import type {
  ResetRoleModelParams,
  SelectRoleModelBody,
  SelectRoleModelParams,
} from "./types.js";

export const registerProviderAssignmentRoutes = async (
  app: FastifyInstance,
) => {
  app.put<{
    Params: SelectRoleModelParams;
    Body: SelectRoleModelBody;
  }>(
    "/providers/:providerCode/select-model/:role",
    { schema: providerSettingsRouteSchemas.selectRoleModel },
    routeHandler("Failed to select default model", async (request) => {
      try {
        const config = providerSettingsService.selectRoleModel(
          request.params.providerCode,
          request.params.role,
          request.body.remoteModelId,
          {
            displayName: request.body.displayName,
            baseUrl: request.body.baseUrl,
            apiKey: request.body.apiKey,
          },
        );

        return success(config, "Default model updated");
      } catch (err) {
        const message = getErrorMessage(
          err,
          FAILED_SELECT_DEFAULT_MODEL_MESSAGE,
        );
        throw createRouteError({
          statusCode: 400,
          code: "PROVIDER_MODEL_SELECTION_FAILED",
          message,
          cause: err,
          logMessage: FAILED_SELECT_DEFAULT_MODEL_MESSAGE,
        });
      }
    }),
  );

  app.put<{ Params: ResetRoleModelParams }>(
    "/providers/reset-model/:role",
    { schema: providerSettingsRouteSchemas.resetRoleModel },
    routeHandler("Failed to reset default model", async (request) => {
      try {
        const config = providerSettingsService.resetRoleModel(
          request.params.role,
        );

        return success(config, "Default model reset");
      } catch (err) {
        const message = getErrorMessage(
          err,
          FAILED_SELECT_DEFAULT_MODEL_MESSAGE,
        );
        throw createRouteError({
          statusCode: 400,
          code: "PROVIDER_MODEL_RESET_FAILED",
          message,
          cause: err,
          logMessage: FAILED_SELECT_DEFAULT_MODEL_MESSAGE,
        });
      }
    }),
  );
};
