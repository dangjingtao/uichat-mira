import type { FastifyInstance } from "fastify";
import { providerSettingsService } from "@/services/provider-settings.service.js";
import { success } from "@/utils/index.js";
import { createRouteError, routeHandler } from "@/utils/route-errors.js";
import { normalizeModelSettingsBackup } from "./model-settings-backup.js";
import { providerSettingsRouteSchemas } from "./schemas.js";
import type {
  CreateProviderConnectionBody,
  ImportModelSettingsBody,
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

  app.get(
    "/providers/model-settings/export",
    { schema: providerSettingsRouteSchemas.exportModelSettings },
    routeHandler("Failed to export model settings", async () =>
      success(
        normalizeModelSettingsBackup(
          providerSettingsService.exportModelSettings(),
        ),
      )),
  );

  app.put<{ Body: ImportModelSettingsBody }>(
    "/providers/model-settings/import",
    { schema: providerSettingsRouteSchemas.importModelSettings },
    routeHandler("Failed to import model settings", async (request) => {
      try {
        return success(
          providerSettingsService.importModelSettings(
            normalizeModelSettingsBackup(request.body),
          ),
          "Model settings imported",
        );
      } catch (error) {
        throw createRouteError({
          statusCode: 400,
          code: "MODEL_SETTINGS_IMPORT_INVALID",
          message:
            error instanceof Error
              ? error.message
              : "Invalid model settings backup",
          cause: error,
          logMessage: "Failed to import model settings",
        });
      }
    }),
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
