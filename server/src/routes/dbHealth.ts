import { FastifyPluginAsync } from "fastify";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { success } from "@/utils/index.js";

const DEFAULT_PORT_TIMEOUT = 1500;
const DEFAULT_POSTGRES_PORT = 5432;
const DEFAULT_MYSQL_PORT = 3306;

interface DatabaseHealthData {
  ok: boolean;
  configured: boolean;
  mode: string;
  detail: string;
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
});

const checkSqliteFile = async (filePath: string) => {
  try {
    await fs.access(filePath);
    return buildHealthData(
      true,
      true,
      "sqlite",
      `SQLite 文件可访问: ${filePath}`,
    );
  } catch {
    return buildHealthData(
      false,
      true,
      "sqlite",
      `SQLite 文件不可访问: ${filePath}`,
    );
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
        response: {
          200: {
            type: "object",
            required: ["success", "data", "timestamp"],
            properties: {
              success: { type: "boolean", const: true },
              data: {
                type: "object",
                required: ["ok", "configured", "mode", "detail"],
                properties: {
                  ok: { type: "boolean" },
                  configured: { type: "boolean" },
                  mode: { type: "string" },
                  detail: { type: "string" },
                },
              },
              timestamp: { type: "string", format: "date-time" },
            },
          },
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
            "DATABASE_URL 未配置（服务启动后会默认使用本地 SQLite）",
          ),
        );
      }

      if (databaseUrl.startsWith("file:")) {
        const filePath = databaseUrl.replace("file:", "");
        const data = await checkSqliteFile(filePath);
        return success(data);
      }

      if (databaseUrl.endsWith(".db") || databaseUrl.endsWith(".sqlite")) {
        const dbPath = path.resolve(databaseUrl);
        const data = await checkSqliteFile(dbPath);
        return success(data);
      }

      try {
        const parsed = new URL(databaseUrl);
        const host = parsed.hostname;

        if (!host) {
          throw new Error("缺少主机名");
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
              `无法推断端口: ${databaseUrl}`,
            ),
          );
        }

        const reachable = await tryTcpConnect(host, port);

        console.log(
          buildHealthData(
            reachable,
            true,
            parsed.protocol.replace(":", ""),
            reachable
              ? `数据库地址可连接: ${host}:${port}`
              : `数据库地址不可达: ${host}:${port}`,
          ),
          "<=================",
        );

        return success(
          buildHealthData(
            reachable,
            true,
            parsed.protocol.replace(":", ""),
            reachable
              ? `数据库地址可连接: ${host}:${port}`
              : `数据库地址不可达: ${host}:${port}`,
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
