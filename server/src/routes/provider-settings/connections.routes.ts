import type { FastifyInstance } from "fastify";
import { providerSettingsService } from "@/services/provider-settings.service.js";
import { success } from "@/utils/index.js";
import { routeHandler } from "@/utils/route-errors.js";
import { providerSettingsRouteSchemas } from "./schemas.js";
import type {
  CreateProviderConnectionBody,
  ProviderIdParams,
  SaveProviderConnectionBody,
} from "./types.js";

export const registerProviderConnectionRoutes = async (
  app: FastifyInstance,
) => {
  app.get(
    "/provider-templates",
    { schema: providerSettingsRouteSchemas.listProviderTemplates },
    routeHandler("Failed to get provider templates", async () =>
      success(providerSettingsService.listProviderTemplates())),
  );

  app.get(
    "/providers",
    { schema: providerSettingsRouteSchemas.listProviders },
    routeHandler("Failed to get providers", async () =>
      success(providerSettingsService.getProviderSummaries())),
  );

  app.post<{ Body: CreateProviderConnectionBody }>(
    "/providers",
    { schema: providerSettingsRouteSchemas.createProviderConnection },
    routeHandler("Failed to create provider connection", async (request) =>
      success(
        providerSettingsService.createProviderConnection(request.body),
        "Provider connection created",
      )),
  );

  app.get<{ Params: ProviderIdParams }>(
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
    Params: ProviderIdParams;
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

  app.delete<{ Params: ProviderIdParams }>(
    "/providers/:providerCode",
    { schema: providerSettingsRouteSchemas.deleteProviderConnection },
    routeHandler("Failed to delete provider connection", async (request) => {
      providerSettingsService.deleteProviderConnection(request.params.providerCode);
      return success({ id: request.params.providerCode }, "Provider connection deleted");
    }),
  );
};
