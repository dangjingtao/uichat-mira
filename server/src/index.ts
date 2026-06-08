import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fs from "node:fs/promises";
import path from "node:path";
import healthRoute from "@/routes/health";
import dbHealthRoute from "@/routes/dbHealth";
import loginRoute from "@/routes/login";
import meRoute from "@/routes/me";
// Proxy Ollama chat endpoint
import proxyOllamaRoute from "@/routes/proxy-ollama";
import accountRoute from "@/routes/account";
import knowledgeBaseRoute from "@/routes/knowledge-base";
import modelConfigRoute from "@/routes/model-config";
import providerSettingsRoute from "@/routes/provider-settings";
import { initializeAuthDatabase } from "@/db/auth.db";
import { initializeKnowledgeBaseDatabase } from "@/db/knowledge-base.db";
import { initializeModelConfigDatabase } from "@/db/model-config.db";
import { initializeVectorStore } from "@/db";
import CONFIG from "@/config";
import { getLoggerConfig } from "@/logger";

const app = Fastify({ logger: getLoggerConfig() });
const enableSwagger = process.env.NODE_ENV !== "production";

const setupPlugins = async () => {
  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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
        version: "0.0.2",
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
        {
          name: "Proxy Ollama",
          description: "代理聊天接口（Ollama / OpenAI 兼容）",
        },
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
  await app.register(proxyOllamaRoute);
  await app.register(healthRoute);
  await app.register(dbHealthRoute);
  await app.register(loginRoute);
  await app.register(meRoute);
  await app.register(accountRoute);
  await app.register(knowledgeBaseRoute);
  await app.register(modelConfigRoute);
  await app.register(providerSettingsRoute);
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
  initializeModelConfigDatabase();
  initializeKnowledgeBaseDatabase();

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
    return response.ok;
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
