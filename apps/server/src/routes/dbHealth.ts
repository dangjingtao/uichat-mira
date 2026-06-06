import { FastifyPluginAsync } from "fastify";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";

// 默认端口连接超时时间（毫秒）
const DEFAULT_PORT_TIMEOUT = 1500;
// PostgreSQL 默认端口
const DEFAULT_POSTGRES_PORT = 5432;
// MySQL 默认端口
const DEFAULT_MYSQL_PORT = 3306;

// 数据库健康检查响应接口
interface HealthCheckResponse {
  ok: boolean;          // 数据库是否可用
  configured: boolean;  // 数据库是否已配置
  mode: string;         // 数据库模式（sqlite/postgres/mysql/unknown/unconfigured）
  detail: string;       // 详细说明信息
  now: string;          // 当前时间（ISO格式）
}

// 尝试通过TCP连接到指定的主机和端口
const tryTcpConnect = (
  host: string,
  port: number,
  timeoutMs = DEFAULT_PORT_TIMEOUT,
) =>
  new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host, port });

    // 完成回调：清理资源并返回结果
    const done = (result: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));   // 连接成功
    socket.once("timeout", () => done(false));  // 连接超时
    socket.once("error", () => done(false));    // 连接失败
  });

// 构建健康检查响应对象的辅助函数
const buildHealthResponse = (
  ok: boolean,
  configured: boolean,
  mode: string,
  detail: string,
): HealthCheckResponse => ({
  ok,
  configured,
  mode,
  detail,
  now: new Date().toISOString(),
});

// 检查SQLite文件是否可访问
const checkSqliteFile = async (filePath: string) => {
  try {
    await fs.access(filePath);
    return buildHealthResponse(
      true,
      true,
      "sqlite",
      `SQLite 文件可访问: ${filePath}`,
    );
  } catch {
    return buildHealthResponse(
      false,
      true,
      "sqlite",
      `SQLite 文件不可访问: ${filePath}`,
    );
  }
};

// 根据协议类型获取默认端口
const getDefaultPort = (protocol: string) => {
  if (protocol.startsWith("postgres")) {
    return DEFAULT_POSTGRES_PORT;
  }
  if (protocol.startsWith("mysql")) {
    return DEFAULT_MYSQL_PORT;
  }
  return 0;
};

// 数据库健康检查路由插件
const dbHealthRoute: FastifyPluginAsync = async (app) => {
  // 注册GET /db/health路由
  app.get(
    "/db/health",
    {
      schema: {
        tags: ["System"],
        summary: "Database connectivity health check",
        response: {
          200: {
            type: "object",
            required: ["ok", "configured", "mode", "detail", "now"],
            properties: {
              ok: { type: "boolean" },
              configured: { type: "boolean" },
              mode: { type: "string" },
              detail: { type: "string" },
              now: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    async () => {
      const databaseUrl = process.env.DATABASE_URL;

      // 情况1：未配置DATABASE_URL
      if (!databaseUrl) {
        return buildHealthResponse(
          false,
          false,
          "unconfigured",
          "DATABASE_URL 未配置（服务启动后会默认使用本地 SQLite）",
        );
      }

      // 情况2：file:协议的SQLite数据库
      if (databaseUrl.startsWith("file:")) {
        const filePath = databaseUrl.replace("file:", "");
        return checkSqliteFile(filePath);
      }

      // 情况3：.db或.sqlite文件后缀的SQLite数据库
      if (databaseUrl.endsWith(".db") || databaseUrl.endsWith(".sqlite")) {
        const dbPath = path.resolve(databaseUrl);
        return checkSqliteFile(dbPath);
      }

      // 情况4：网络数据库（PostgreSQL/MySQL等）
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
          return buildHealthResponse(
            false,
            true,
            parsed.protocol.replace(":", ""),
            `无法推断端口: ${databaseUrl}`,
          );
        }

        // 尝试TCP连接
        const reachable = await tryTcpConnect(host, port);

        return buildHealthResponse(
          reachable,
          true,
          parsed.protocol.replace(":", ""),
          reachable
            ? `数据库地址可连接: ${host}:${port}`
            : `数据库地址不可达: ${host}:${port}`,
        );
      } catch (error) {
        // URL解析失败
        return buildHealthResponse(
          false,
          true,
          "unknown",
          error instanceof Error
            ? `数据库 URL 解析失败: ${error.message}`
            : "数据库 URL 解析失败",
        );
      }
    },
  );
};

export default dbHealthRoute;
