import { FastifyPluginAsync } from "fastify";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { getVectorStoreHealth } from "@/db";
import { success } from "@/utils/index.js";
import { successEnvelope } from "@/routes/schema-helpers.js";

const DEFAULT_PORT_TIMEOUT = 1500;
const DEFAULT_POSTGRES_PORT = 5432;
const DEFAULT_MYSQL_PORT = 3306;

interface DatabaseHealthData {
  ok: boolean;
  configured: boolean;
  mode: string;
  detail: string;
  vectorStore: {
    ok: boolean;
    provider: "sqlite-vec";
    detail: string;
    extensionPath?: string;
  };
}

const tryTcpConnect = (
  host: string,
  port: number,
  timeoutMs = DEFAULT_PORT_TIMEOUT,
) =>
  new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host, port });

    const done = (result: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });

const buildHealthData = (
  ok: boolean,
  configured: boolean,
  mode: string,
  detail: string,
): DatabaseHealthData => ({
  ok,
  configured,
  mode,
  detail,
  vectorStore: getVectorStoreHealth(),
});

const checkSqliteFile = async (filePath: string) => {
  try {
    await fs.access(filePath);
    return buildHealthData(true, true, "sqlite", `SQLite 文件可访问: ${filePath}`);
  } catch {
    return buildHealthData(false, true, "sqlite", `SQLite 文件不可访问: ${filePath}`);
  }
};

const getDefaultPort = (protocol: string) => {
  if (protocol.startsWith("postgres")) {
    return DEFAULT_POSTGRES_PORT;
  }
  if (protocol.startsWith("mysql")) {
    return DEFAULT_MYSQL_PORT;
  }
  return 0;
};

const dbHealthRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/db/health",
    {
      schema: {
        tags: ["System"],
        summary: "Database connectivity health check",
        operationId: "getDatabaseHealth",
        response: {
          200: successEnvelope({
            type: "object",
            required: ["ok", "configured", "mode", "detail", "vectorStore"],
            properties: {
              ok: { type: "boolean" },
              configured: { type: "boolean" },
              mode: { type: "string" },
              detail: { type: "string" },
              vectorStore: {
                type: "object",
                required: ["ok", "provider", "detail"],
                properties: {
                  ok: { type: "boolean" },
                  provider: { type: "string", const: "sqlite-vec" },
                  detail: { type: "string" },
                  extensionPath: { type: "string" },
                },
              },
            },
          }),
        },
      },
    },
    async () => {
      const databaseUrl = process.env.DATABASE_URL;

      if (!databaseUrl) {
        return success(
          buildHealthData(
            false,
            false,
            "unconfigured",
            "DATABASE_URL 未设置，当前未配置数据库连接。",
          ),
        );
      }

      if (databaseUrl.startsWith("file:")) {
        const filePath = databaseUrl.replace("file:", "");
        return success(await checkSqliteFile(filePath));
      }

      if (databaseUrl.endsWith(".db") || databaseUrl.endsWith(".sqlite")) {
        const dbPath = path.resolve(databaseUrl);
        return success(await checkSqliteFile(dbPath));
      }

      try {
        const parsed = new URL(databaseUrl);
        const host = parsed.hostname;

        if (!host) {
          throw new Error("数据库地址缺少主机名");
        }

        let port = Number(parsed.port);
        if (!port) {
          port = getDefaultPort(parsed.protocol);
        }

        if (!port) {
          return success(
            buildHealthData(
              false,
              true,
              parsed.protocol.replace(":", ""),
              `数据库地址缺少端口: ${databaseUrl}`,
            ),
          );
        }

        const reachable = await tryTcpConnect(host, port);
        return success(
          buildHealthData(
            reachable,
            true,
            parsed.protocol.replace(":", ""),
            reachable
              ? `数据库连接正常: ${host}:${port}`
              : `数据库无法访问: ${host}:${port}`,
          ),
        );
      } catch (error) {
        return success(
          buildHealthData(
            false,
            true,
            "unknown",
            error instanceof Error
              ? `数据库 URL 解析失败: ${error.message}`
              : "数据库 URL 解析失败",
          ),
        );
      }
    },
  );
};

export default dbHealthRoute;
