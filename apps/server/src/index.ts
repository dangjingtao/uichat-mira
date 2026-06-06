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
import modelConfigRoute from "@/routes/model-config";
import { initializeAuthDatabase } from "@/db/auth.db";
import { initializeModelConfigDatabase } from "@/db/model-config.db";
import CONFIG from "@/config";
import { getLoggerConfig } from "@/logger";

const app = Fastify({ logger: getLoggerConfig() });

const setupPlugins = async () => {
  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "UIChat Rag Test Server API",
        description:
          "Backend APIs for UIChat Rag Test desktop/server integration",
        version: "0.1.0",
      },
      servers: [{ url: `http://127.0.0.1:${CONFIG.PORT}` }],
      tags: [{ name: "System" }, { name: "Auth" }, { name: "Models" }],
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
  await app.register(healthRoute);
  await app.register(dbHealthRoute);
  await app.register(loginRoute);
  await app.register(meRoute);
  await app.register(modelConfigRoute);
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

  await Promise.all([
    initializeAuthDatabase(),
    initializeModelConfigDatabase(),
  ]);
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
  app.log.info(
    `API docs available at http://127.0.0.1:${CONFIG.PORT}${CONFIG.SWAGGER_PREFIX}`,
  );
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
