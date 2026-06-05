import Fastify from "fastify";
import cors from "@fastify/cors";
import fs from "node:fs/promises";
import path from "node:path";
import healthRoute from "./routes/health";
import dbHealthRoute from "./routes/dbHealth";

const app = Fastify({ logger: true });

app.register(cors, {
  origin: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});

app.register(healthRoute);
app.register(dbHealthRoute);

const ensureDefaultDatabaseUrl = async () => {
  if (process.env.DATABASE_URL) {
    return;
  }

  const dbPath = path.resolve(process.cwd(), "data", "rag-demo.db");

  await fs.mkdir(path.dirname(dbPath), { recursive: true });

  const handle = await fs.open(dbPath, "a");
  await handle.close();

  process.env.DATABASE_URL = `file:${dbPath}`;
};

const isExistingBackendHealthy = async (port: number): Promise<boolean> => {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    return response.ok;
  } catch {
    return false;
  }
};

const start = async () => {
  try {
    await ensureDefaultDatabaseUrl();

    const port = Number(process.env.PORT ?? 8787);
    await app.listen({ host: "0.0.0.0", port });
  } catch (error) {
    const port = Number(process.env.PORT ?? 8787);

    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "EADDRINUSE" &&
      (await isExistingBackendHealthy(port))
    ) {
      app.log.info(
        `Port ${port} is already in use by a healthy backend. Reusing existing service.`,
      );
      return;
    }

    app.log.error(error);
    process.exit(1);
  }
};

void start();
