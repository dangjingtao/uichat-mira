import type { FastifyInstance } from "fastify";
import { PUBLIC_API_ROUTES } from "@/config/public-api.js";
import { providerProxyService } from "@/services/provider-proxy.service/index.js";
import {
  handleValidationError,
  success,
} from "@/utils/index.js";
import { routeHandler } from "@/utils/route-errors.js";
import { proxyProviderRouteSchemas } from "./schemas.js";
import type {
  ProviderChatParams,
  ProviderEmbeddingsBody,
} from "./types.js";

export const registerProxyProviderEmbeddingRoutes = async (
  app: FastifyInstance,
) => {
  const providerEmbeddingsRoute = PUBLIC_API_ROUTES.providerEmbeddings;

  app.post<{
    Params: ProviderChatParams;
    Body: ProviderEmbeddingsBody;
  }>(
    providerEmbeddingsRoute.path,
    {
      attachValidation: true,
      schema: proxyProviderRouteSchemas.providerEmbeddings,
    },
    routeHandler("Failed to create embeddings", async (request, reply) => {
      const validationResponse = handleValidationError(request, reply);
      if (validationResponse) {
        return validationResponse;
      }

      const input = Array.isArray(request.body.input)
        ? request.body.input
        : [request.body.input];

      const result = await providerProxyService.createEmbeddings(
        request.params.provider,
        input,
      );

      return success(result);
    }),
  );
};
