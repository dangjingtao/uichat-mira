import type { FastifyInstance } from "fastify";
import { providerSettingsService } from "@/services/provider-settings.service.js";
import { success } from "@/utils/index.js";
import { routeHandler } from "@/utils/route-errors.js";
import { providerSettingsRouteSchemas } from "./schemas.js";
import type {
  ProviderCodeParams,
  SaveProviderConnectionBody,
} from "./types.js";

export const registerProviderConnectionRoutes = async (
  app: FastifyInstance,
) => {
  app.get(
    "/providers",
    { schema: providerSettingsRouteSchemas.listProviders },
    routeHandler("Failed to get providers", async () =>
      success(providerSettingsService.getProviderSummaries())),
  );

  app.get<{ Params: ProviderCodeParams }>(
    "/providers/:providerCode",
    { schema: providerSettingsRouteSchemas.getProviderDetail },
    routeHandler("Failed to get provider detail", async (request) =>
      success(
        providerSettingsService.getProviderDetail(
          request.params.providerCode,
        ),
      )),
  );

  app.put<{
    Params: ProviderCodeParams;
    Body: SaveProviderConnectionBody;
  }>(
    "/providers/:providerCode",
    { schema: providerSettingsRouteSchemas.saveProviderConnection },
    routeHandler("Failed to save provider config", async (request) => {
      const connection = providerSettingsService.saveProviderConnection(
        request.params.providerCode,
        request.body,
      );
      return success(connection, "Provider config saved");
    }),
  );
};
