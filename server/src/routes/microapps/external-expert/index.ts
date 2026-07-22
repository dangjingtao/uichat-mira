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

  app.post<{ Params: { id: string }; Body: { tabId?: number } }>(
    "/microapps/external-experts/:id/bind-tab",
    routeHandler("Failed to bind external expert tab", async (request) => {
      const params = request.params as { id: string };
      const body = request.body as { tabId?: number };
      if (!Number.isInteger(body?.tabId)) throw badRequest("tabId 必须是有效的浏览器标签页 ID");
      const tabId = body.tabId as number;
      return success(await service.bind({
        userId: request.authUser!.id,
        expertId: params.id,
        tabId,
      }), "External expert bound");
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
