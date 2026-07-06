import type { FastifyInstance } from "fastify";
import { providerSettingsService } from "@/services/provider-settings.service.js";
import {
  FAILED_SYNC_PROVIDER_MODELS_MESSAGE,
  getErrorMessage,
  success,
} from "@/utils/index.js";
import { badRequest, routeHandler } from "@/utils/route-errors.js";
import { providerSettingsRouteSchemas } from "./schemas.js";
import type { ProviderIdParams } from "./types.js";

export const registerProviderModelRoutes = async (app: FastifyInstance) => {
  app.post<{ Params: ProviderIdParams }>(
    "/providers/:providerCode/sync-models",
    { schema: providerSettingsRouteSchemas.syncProviderModels },
    routeHandler("Failed to sync provider models", async (request) => {
      try {
        const data = await providerSettingsService.syncProviderModels(
          request.params.providerCode,
        );
        return success(data, "Models synced successfully");
      } catch (err) {
        const message = getErrorMessage(
          err,
          FAILED_SYNC_PROVIDER_MODELS_MESSAGE,
        );
        throw badRequest(message, {
          cause: err,
          logMessage: FAILED_SYNC_PROVIDER_MODELS_MESSAGE,
        });
      }
    }),
  );
};
