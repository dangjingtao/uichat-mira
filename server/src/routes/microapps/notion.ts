import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "@/db/auth.db.js";
import { notionConnectionRepository, type NotionConnectionRecord } from "@/db/repositories/notion-connection.repository.js";
import { notionAccessPointsRepository, type NotionAccessPointType } from "@/db/repositories/notion-access-points.repository.js";
import { notionActivitiesRepository } from "@/db/repositories/notion-activities.repository.js";
import { notionAppendBlocks, notionCreatePage, notionDatabase, notionPage, notionQueryDatabase, readNotionPageText } from "@/microapps/notion/client.js";
import { knowledgeBaseService } from "@/services/knowledge-base.service.js";
import { previewNotionResource } from "@/microapps/notion/preview.js";
import { badRequest, notFound, routeHandler } from "@/utils/route-errors.js";
import { success } from "@/utils/index.js";

type NotionValidation = { workspaceId: string | null; workspaceName: string | null };

const validateToken = async (token: string): Promise<NotionValidation> => {
  const response = await fetch("https://api.notion.com/v1/users/me", {
    headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28" },
  });
  if (!response.ok) {
    throw badRequest(response.status === 401 ? "Notion Token 无效或已撤销" : `Notion 连接验证失败（${response.status}）`);
  }
  const data = await response.json() as { bot?: { workspace?: { id?: string; name?: string } } };
  return { workspaceId: data.bot?.workspace?.id ?? null, workspaceName: data.bot?.workspace?.name ?? null };
};

const maskToken = (token: string) => token ? `${token.slice(0, 6)}${"*".repeat(Math.max(8, token.length - 10))}${token.slice(-4)}` : "";

const capabilities = (connection: NotionConnectionRecord) => {
  const points = notionAccessPointsRepository.list();
  const connected = connection.status === "connected" && connection.enabled;
  const hasAction = (types: string[], action: string) => points.some((point) => types.includes(point.type) && point.enabled && point.verificationStatus === "verified" && point.allowedActions.includes(action));
  return [
    { code: "search_read", label: "搜索与读取", status: connected ? "available" : "blocked", description: "连接成功后，可在已验证的页面范围内定位页面并读取内容。" },
    { code: "database_query", label: "数据库查询", status: !connected ? "blocked" : hasAction(["database"], "query") ? "available" : "reserved", description: "通过已验证的数据库接入点查询结构化记录。" },
    { code: "content_write", label: "内容写回", status: !connected ? "blocked" : hasAction(["database", "publish_target"], "append_content") || hasAction(["database", "publish_target"], "create_page") ? "available" : "reserved", description: "写入动作需要已验证的目标接入点和 Mira Policy 审批。" },
    { code: "knowledge_sync", label: "同步到知识库", status: !connected ? "blocked" : hasAction(["page_scope"], "sync_to_knowledge_base") ? "available" : "reserved", description: "通过已验证的页面接入点，将内容写入指定知识库。" },
  ];
};

const publicConnection = (connection: NotionConnectionRecord | null) => {
  const value = connection ?? notionConnectionRepository.upsert({});
  return {
    connection: {
      id: value.id,
      name: value.name,
      workspaceId: value.workspaceId,
      workspaceName: value.workspaceName,
      authMode: "internal_token" as const,
      enabled: value.enabled,
      defaultReadOnly: value.defaultReadOnly,
      status: value.status,
      hasToken: Boolean(value.token),
      maskedToken: maskToken(value.token),
      lastValidatedAt: value.lastValidatedAt,
      lastErrorCode: value.lastErrorCode,
      lastErrorMessage: value.lastErrorMessage,
    },
    capabilities: capabilities(value),
  };
};

const notionRoute: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/microapps/notion", routeHandler("Failed to load Notion connection", async () => success(publicConnection(notionConnectionRepository.get()))));
  app.get<{ Querystring: { limit?: string } }>("/microapps/notion/activities", routeHandler("Failed to list Notion activities", async (request) => {
    const query = request.query as { limit?: string };
    return success({ activities: notionActivitiesRepository.list(Number(query.limit ?? 50)) });
  }));
  app.get<{ Params: { id: string } }>("/microapps/notion/access-points/:id/preview", routeHandler("Failed to preview Notion access point", async (request) => {
    const params = request.params as { id: string };
    const point = notionAccessPointsRepository.getById(params.id);
    if (!point) throw notFound("Notion 接入点不存在");
    const connection = getActiveConnection();
    return success({ preview: await previewNotionResource(connection.token, point) });
  }));

  app.post<{ Body: { token?: string } }>("/microapps/notion/validate", routeHandler("Failed to validate Notion connection", async (request) => {
    const body = request.body as { token?: string };
    const current = notionConnectionRepository.get();
    const token = body.token?.trim() || current?.token || "";
    if (!token) throw badRequest("Notion Integration Token is required");
    const workspace = await validateToken(token);
    const preview: NotionConnectionRecord = {
      ...(current ?? notionConnectionRepository.upsert({})),
      token,
      workspaceId: workspace.workspaceId,
      workspaceName: workspace.workspaceName,
      status: "connected",
      lastValidatedAt: new Date().toISOString(),
      lastErrorCode: null,
      lastErrorMessage: null,
    };
    notionActivitiesRepository.create({ action: "connection_validate", accessPointId: null, resourceId: null, status: "completed", summary: `已验证 Workspace：${workspace.workspaceName || "未命名 Workspace"}`, traceId: null });
    return success(publicConnection(preview));
  }));

  app.put<{ Body: { name?: string; token?: string; enabled?: boolean; defaultReadOnly?: boolean } }>("/microapps/notion", routeHandler("Failed to save Notion connection", async (request) => {
    const body = request.body as { name?: string; token?: string; enabled?: boolean; defaultReadOnly?: boolean };
    const current = notionConnectionRepository.get();
    const token = body.token?.trim() || current?.token || "";
    if (!token) throw badRequest("请先填写 Notion Integration Token");
    let workspace = { workspaceId: current?.workspaceId ?? null, workspaceName: current?.workspaceName ?? null };
    if (body.token?.trim()) workspace = await validateToken(token);
    const saved = notionConnectionRepository.upsert({ name: body.name, token, enabled: body.enabled, defaultReadOnly: body.defaultReadOnly, ...workspace, status: body.enabled === false ? "disabled" : "connected", lastValidatedAt: body.token?.trim() ? new Date().toISOString() : current?.lastValidatedAt ?? null, lastErrorCode: null, lastErrorMessage: null });
    return success(publicConnection(saved));
  }));

  const getActiveConnection = () => {
    const connection = notionConnectionRepository.get();
    if (!connection?.token) throw badRequest("请先配置 Notion Integration Token");
    if (!connection.enabled) throw badRequest("Notion 微应用已停用");
    return connection;
  };

  app.get("/microapps/notion/access-points", routeHandler("Failed to list Notion access points", async () => success({ accessPoints: notionAccessPointsRepository.list() })));

  app.post<{ Body: { name: string; type: NotionAccessPointType; resourceId: string; resourceUrl?: string | null; includeChildren?: boolean; allowedActions: string[] } }>("/microapps/notion/access-points", routeHandler("Failed to create Notion access point", async (request) => {
    const body = request.body as { name: string; type: NotionAccessPointType; resourceId: string; resourceUrl?: string | null; includeChildren?: boolean; allowedActions: string[] };
    if (!body.name?.trim() || !body.resourceId?.trim() || !Array.isArray(body.allowedActions)) throw badRequest("接入点名称、资源 ID 和允许动作不能为空");
    const connection = getActiveConnection();
    let resourceTitle = body.resourceId;
    try {
      const resource = body.type === "database" ? await notionDatabase(connection.token, body.resourceId) : await notionPage(connection.token, body.resourceId);
      resourceTitle = typeof resource.object === "string" ? (typeof resource.id === "string" ? resource.id : body.resourceId) : body.resourceId;
      const titleCandidate = Object.values((resource.properties ?? {}) as Record<string, unknown>).find((item) => item && typeof item === "object" && (item as Record<string, unknown>).type === "title") as Record<string, unknown> | undefined;
      const titleItems = titleCandidate?.title;
      if (Array.isArray(titleItems) && typeof titleItems[0]?.plain_text === "string") resourceTitle = titleItems[0].plain_text;
    } catch (error) {
      throw badRequest(error instanceof Error ? error.message : "Notion 资源验证失败");
    }
    const accessPoint = notionAccessPointsRepository.create({ name: body.name, type: body.type, resourceId: body.resourceId, resourceUrl: body.resourceUrl ?? null, resourceTitle, enabled: true, includeChildren: Boolean(body.includeChildren), allowedActions: body.allowedActions, verificationStatus: "verified" });
    notionActivitiesRepository.create({ action: "access_point_create", accessPointId: accessPoint.id, resourceId: accessPoint.resourceId, status: "completed", summary: `已验证并添加接入点：${accessPoint.name}`, traceId: null });
    return success({ accessPoint });
  }));

  app.post<{ Params: { id: string } }>("/microapps/notion/access-points/:id/validate", routeHandler("Failed to validate Notion access point", async (request) => {
    const params = request.params as { id: string };
    const point = notionAccessPointsRepository.getById(params.id);
    if (!point) throw notFound("Notion 接入点不存在");
    const connection = getActiveConnection();
    try {
      const resource = point.type === "database" ? await notionDatabase(connection.token, point.resourceId) : await notionPage(connection.token, point.resourceId);
      const accessPoint = notionAccessPointsRepository.updateStatus(point.id, { verificationStatus: "verified", resourceTitle: typeof resource.id === "string" ? point.resourceTitle : point.resourceTitle, lastErrorMessage: null });
      notionActivitiesRepository.create({ action: "access_point_validate", accessPointId: point.id, resourceId: point.resourceId, status: "completed", summary: `已验证接入点：${point.name}`, traceId: null });
      return success({ accessPoint });
    } catch (error) {
      return success({ accessPoint: notionAccessPointsRepository.updateStatus(point.id, { verificationStatus: "error", lastErrorMessage: error instanceof Error ? error.message : "Notion 资源验证失败" }) });
    }
  }));

  app.delete<{ Params: { id: string } }>("/microapps/notion/access-points/:id", routeHandler("Failed to delete Notion access point", async (request) => {
    const params = request.params as { id: string };
    const point = notionAccessPointsRepository.getById(params.id);
    if (!point || !notionAccessPointsRepository.delete(params.id)) throw notFound("Notion 接入点不存在");
    notionActivitiesRepository.create({ action: "access_point_delete", accessPointId: point.id, resourceId: point.resourceId, status: "completed", summary: `已删除接入点：${point.name}`, traceId: null });
    return success({ deleted: true });
  }));

  app.post<{ Body: { accessPointId: string; filter?: Record<string, unknown>; sorts?: unknown[]; pageSize?: number } }>("/microapps/notion/capabilities/database-query", routeHandler("Failed to query Notion database", async (request) => {
    const body = request.body as { accessPointId: string; filter?: Record<string, unknown>; sorts?: unknown[]; pageSize?: number };
    const point = notionAccessPointsRepository.getById(body.accessPointId);
    if (!point || point.type !== "database") throw badRequest("数据库查询必须使用 database 接入点");
    if (!point.enabled || point.verificationStatus !== "verified" || !point.allowedActions.includes("query")) throw badRequest("数据库接入点未验证或未允许查询");
    const connection = getActiveConnection();
    const result = await notionQueryDatabase(connection.token, point.resourceId, { filter: body.filter, sorts: body.sorts, page_size: Math.min(Math.max(body.pageSize ?? 20, 1), 100) });
    notionActivitiesRepository.create({ action: "database_query", accessPointId: point.id, resourceId: point.resourceId, status: "completed", summary: `查询 ${point.name}，返回 ${(result.results as unknown[] | undefined)?.length ?? 0} 条记录`, traceId: null });
    return success({ accessPointId: point.id, result });
  }));

  app.post<{ Body: { accessPointId: string; action: "append_content" | "create_page" | "create_record"; resourceId?: string; title?: string; content: string; approved: boolean } }>("/microapps/notion/capabilities/content-write", routeHandler("Failed to write content to Notion", async (request) => {
    const body = request.body as { accessPointId: string; action: "append_content" | "create_page" | "create_record"; resourceId?: string; title?: string; content: string; approved: boolean };
    if (!body.approved) throw badRequest("Notion 写入必须经过确认");
    if (!body.content?.trim()) throw badRequest("写入内容不能为空");
    const point = notionAccessPointsRepository.getById(body.accessPointId);
    if (!point || !point.enabled || point.verificationStatus !== "verified" || !point.allowedActions.includes(body.action)) throw badRequest("接入点未验证或未允许该写入动作");
    const connection = getActiveConnection();
    const children = [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: body.content } }] } }];
    const result = body.action === "append_content" ? await notionAppendBlocks(connection.token, body.resourceId || point.resourceId, children) : await notionCreatePage(connection.token, { [point.type === "database" ? "database_id" : "page_id"]: point.resourceId }, { title: { title: [{ type: "text", text: { content: body.title?.trim() || point.name } }] } }, children);
    notionActivitiesRepository.create({ action: body.action, accessPointId: point.id, resourceId: body.resourceId || point.resourceId, status: "completed", summary: `已完成内容写回：${point.name}`, traceId: null });
    return success({ accessPointId: point.id, action: body.action, result });
  }));

  app.post<{ Body: { accessPointId: string; resourceIds?: string[]; knowledgeBaseId: string; approved: boolean } }>("/microapps/notion/capabilities/knowledge-sync", routeHandler("Failed to sync Notion content", async (request) => {
    const body = request.body as { accessPointId: string; resourceIds?: string[]; knowledgeBaseId: string; approved: boolean };
    if (!body.approved) throw badRequest("知识库同步必须经过确认");
    const point = notionAccessPointsRepository.getById(body.accessPointId);
    if (!point || point.type !== "page_scope" || !point.enabled || point.verificationStatus !== "verified" || !point.allowedActions.includes("sync_to_knowledge_base")) throw badRequest("页面接入点未验证或未允许知识库同步");
    const connection = getActiveConnection();
    const resourceIds = body.resourceIds?.length ? body.resourceIds : [point.resourceId];
    const documents = [];
    for (const resourceId of resourceIds) {
      const page = await readNotionPageText(connection.token, resourceId);
      if (!page.text.trim()) continue;
      documents.push(await knowledgeBaseService.createDocument(body.knowledgeBaseId, { name: page.title || point.resourceTitle, fileExt: "md", contentText: page.text, sourceType: "sync", sourceLabel: `Notion: ${resourceId}` }));
    }
    notionActivitiesRepository.create({ action: "sync_to_knowledge_base", accessPointId: point.id, resourceId: point.resourceId, status: "completed", summary: `已同步 ${documents.length} 个知识库文档：${point.name}`, traceId: null });
    return success({ accessPointId: point.id, syncedCount: documents.length, documents });
  }));
};

export default notionRoute;
