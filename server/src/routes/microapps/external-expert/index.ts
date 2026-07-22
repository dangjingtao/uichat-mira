import type { FastifyPluginAsync } from "fastify";
import { badRequest, routeHandler } from "@/utils/route-errors.js";
import { success } from "@/utils/index.js";
import type { ExternalExpertService } from "@/microapps/external-expert/index.js";

type RouteOptions = { service: ExternalExpertService };

const externalExpertRoutes: FastifyPluginAsync<RouteOptions> = async (app, options) => {
  const service = options.service;

  app.get(
    "/microapps/external-experts",
    routeHandler("Failed to list external experts", async (request) =>
      success(service.list(request.authUser!.id)),
    ),
  );

  app.post<{ Body: { name?: string; provider?: string } }>(
    "/microapps/external-experts",
    routeHandler("Failed to create external expert", async (request) => {
      const body = request.body as { name?: string; provider?: string };
      if (typeof body?.name !== "string" || typeof body?.provider !== "string") {
        throw badRequest("专家名称和 Provider 必填");
      }
      return success(service.create({
        userId: request.authUser!.id,
        name: body.name,
        provider: body.provider,
      }), "External expert created");
    }),
  );

  app.post<{ Params: { id: string } }>(
    "/microapps/external-experts/:id/connect",
    routeHandler("Failed to connect external expert", async (request) => {
      const params = request.params as { id: string };
      return success(await service.connect({
        userId: request.authUser!.id,
        expertId: params.id,
      }), "External expert connected");
    }),
  );

  app.post<{ Params: { id: string }; Body: { message?: string } }>(
    "/microapps/external-experts/:id/consult",
    routeHandler("Failed to consult external expert", async (request) => {
      const params = request.params as { id: string };
      const body = request.body as { message?: string };
      if (typeof body?.message !== "string" || !body.message.trim()) throw badRequest("咨询内容不能为空");
      return success(await service.consult({
        userId: request.authUser!.id,
        expertId: params.id,
        message: body.message,
      }), "External expert replied");
    }),
  );
};

export default externalExpertRoutes;
