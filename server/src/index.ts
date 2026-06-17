import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fs from "node:fs/promises";
import path from "node:path";
import healthRoute from "@/routes/health";
import appMetaRoute from "@/routes/app-meta";
import dbHealthRoute from "@/routes/dbHealth";
import logsRoute from "@/routes/logs";
import loginRoute from "@/routes/login";
import meRoute from "@/routes/me";
import proxyProviderRoute from "@/routes/proxy-provider/index.js";
import accountRoute from "@/routes/account";
import knowledgeBaseRoute from "@/routes/knowledge-base/index.js";
import modelConfigRoute from "@/routes/model-config";
import providerSettingsRoute from "@/routes/provider-settings/index.js";
import threadRoute from "@/routes/thread/index.js";
import chatRagRoute from "@/routes/chat-rag";
import ragRuntimeRoute from "@/routes/rag-runtime/index.js";
import evaluationRoute from "@/routes/evaluation/index.js";
import toolsRoute from "@/routes/tools";
import { getAuthUserFromRequest, initializeAuthDatabase } from "@/db/auth.db";
import { initializeEvaluationDatabase } from "@/db/evaluation.db";
import { initializeKnowledgeBaseDatabase } from "@/db/knowledge-base.db";
import { initializeModelConfigDatabase } from "@/db/model-config.db";
import { initializeThreadDatabase } from "@/db/thread.db";
import { initializeVectorStore } from "@/db";
import CONFIG from "@/config";
import { isAuthExemptPath, OPENAPI_PUBLIC_TAGS } from "@/config/public-api.js";
import { getLoggerConfig } from "@/logger";
import { evaluationService } from "@/services/evaluation.service.js";
import { getAppMeta } from "@/utils/index.js";
import { sendRouteError, unauthorized } from "@/utils/route-errors.js";
import { MAX_UPLOAD_FILE_BYTES } from "@/constants/knowledge-base.js";

const app = Fastify({
  logger: getLoggerConfig(),
  serializerOpts: { encoding: "utf8" },
});
const enableSwagger = process.env.NODE_ENV !== "production";

app.setErrorHandler(sendRouteError);

const setupPlugins = async () => {
  const appMeta = getAppMeta();

  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposedHeaders: ["Content-Disposition", "Content-Length"],
  });

  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: MAX_UPLOAD_FILE_BYTES,
    },
  });

  app.addHook("preHandler", async (request, reply) => {
    if (request.method === "OPTIONS" || isAuthExemptPath(request.url)) {
      return;
    }

    const user = getAuthUserFromRequest(request);
    if (!user) {
      const authHeader = request.headers.authorization;
      throw unauthorized(
        authHeader && authHeader.startsWith("Bearer ")
          ? "Invalid auth token"
          : "Missing auth token",
      );
    }

    request.authUser = user;
  });

  if (!enableSwagger) {
    return;
  }

  await app.register(swagger, {
    openapi: {
      info: {
        title: "UIChat Rag Tester Server API",
        description:
          "Backend APIs for UIChat Rag Tester desktop/server integration",
        version: appMeta.version,
      },
      servers: [{ url: `http://127.0.0.1:${CONFIG.PORT}` }],
      tags: [
        { name: "System", description: "系统健康检查与状态" },
        { name: "Auth", description: "用户鉴权与账户管理" },
        { name: "Knowledge Base", description: "知识库与文档管理" },
        { name: "Model Settings", description: "模型配置与参数模板" },
        {
          name: "Provider Settings",
          description: "服务商连接与模型同步",
        },
        ...OPENAPI_PUBLIC_TAGS,
        { name: "Thread", description: "对话会话与消息管理" },
        { name: "Chat", description: "RAG 增强聊天与检索" },
        { name: "Evaluation", description: "评测工作台与评测任务" },
        { name: "Tools", description: "Built-in agent tools" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: CONFIG.SWAGGER_PREFIX,
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });
};

const setupRoutes = async () => {
  await app.register(proxyProviderRoute);
  await app.register(healthRoute);
  await app.register(appMetaRoute);
  await app.register(dbHealthRoute);
  await app.register(logsRoute);
  await app.register(loginRoute);
  await app.register(meRoute);
  await app.register(accountRoute);
  await app.register(knowledgeBaseRoute);
  await app.register(modelConfigRoute);
  await app.register(providerSettingsRoute);
  await app.register(threadRoute);
  await app.register(chatRagRoute);
  await app.register(ragRuntimeRoute);
  await app.register(evaluationRoute);
  await app.register(toolsRoute);
};

const setupDatabase = async () => {
  if (!process.env.DATABASE_URL) {
    const dbDir = path.resolve(process.cwd(), CONFIG.DATABASE_DIR);
    await fs.mkdir(dbDir, { recursive: true });

    const dbPath = path.join(dbDir, CONFIG.DATABASE_NAME);
    const handle = await fs.open(dbPath, "a");
    await handle.close();

    process.env.DATABASE_URL = `file:${dbPath}`;
    app.log.info(`Database initialized at ${dbPath}`);
  }

  initializeAuthDatabase();
  initializeEvaluationDatabase();
  initializeModelConfigDatabase();
  initializeKnowledgeBaseDatabase();
  initializeThreadDatabase();
  evaluationService.initializePersistence();

  const vectorStoreHealth = initializeVectorStore();
  if (vectorStoreHealth.ok) {
    app.log.info(
      {
        provider: vectorStoreHealth.provider,
        extensionPath: vectorStoreHealth.extensionPath,
      },
      vectorStoreHealth.detail,
    );
  } else {
    app.log.warn(
      {
        provider: vectorStoreHealth.provider,
      },
      vectorStoreHealth.detail,
    );
  }
};

const isExistingBackendHealthy = async (port: number): Promise<boolean> => {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    return response.ok || response.status === 401;
  } catch {
    return false;
  }
};

const startServer = async () => {
  await app.listen({ host: CONFIG.HOST, port: CONFIG.PORT });
  app.log.info(`Server running on http://${CONFIG.HOST}:${CONFIG.PORT}`);
  if (enableSwagger) {
    app.log.info(
      `API docs available at http://127.0.0.1:${CONFIG.PORT}${CONFIG.SWAGGER_PREFIX}`,
    );
  }
};

const start = async () => {
  try {
    await setupPlugins();
    await setupRoutes();
    await setupDatabase();
    await startServer();
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "EADDRINUSE" &&
      (await isExistingBackendHealthy(CONFIG.PORT))
    ) {
      app.log.info(
        `Port ${CONFIG.PORT} is already in use by a healthy backend. Reusing existing service.`,
      );
      return;
    }

    app.log.error({ err: error as Error }, "Failed to start server");
    process.exit(1);
  }
};

process.on("SIGINT", async () => {
  app.log.info("Shutting down gracefully...");
  await app.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  app.log.info("Shutting down gracefully...");
  await app.close();
  process.exit(0);
});

void start();
